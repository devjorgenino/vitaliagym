-- ============================================================================
-- DIAGNÓSTICO Y FIX COMPLETO PARA RBAC
-- 
-- Ejecuta este script en Supabase SQL Editor para:
-- 1. Diagnosticar el problema
-- 2. Arreglar las políticas RLS
-- 3. Asignar rol al usuario existente
-- ============================================================================

-- ============================================================================
-- PARTE 1: DIAGNÓSTICO
-- ============================================================================

-- Ver usuarios sin rol
SELECT 
  u.id,
  u.email,
  u.created_at,
  ur.role_id,
  r.name as role_name
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
ORDER BY u.created_at DESC
LIMIT 10;

-- Ver roles disponibles
SELECT * FROM public.roles;

-- Ver políticas actuales en user_roles
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_roles';

-- ============================================================================
-- PARTE 2: ELIMINAR TODAS LAS POLÍTICAS PROBLEMÁTICAS
-- ============================================================================

-- Eliminar TODAS las políticas de user_roles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Eliminar políticas de role_permissions
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'role_permissions' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.role_permissions', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Eliminar políticas de permissions
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'permissions' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.permissions', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Eliminar políticas de user_permission_overrides
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'user_permission_overrides' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_permission_overrides', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- ============================================================================
-- PARTE 3: CREAR FUNCIÓN HELPER (SIN RECURSIÓN)
-- ============================================================================

-- Función para verificar si un usuario es admin SIN causar recursión
CREATE OR REPLACE FUNCTION public.check_is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- SECURITY DEFINER bypasea RLS, evitando la recursión
  RETURN EXISTS(
    SELECT 1 
    FROM public.user_roles ur
    INNER JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = check_user_id 
      AND r.name = 'Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PARTE 4: CREAR POLÍTICAS SIMPLES Y FUNCIONALES
-- ============================================================================

-- === ROLES (tabla roles) ===
-- Cualquiera puede ver roles activos (necesario para registro)
CREATE POLICY "public_read_roles" ON public.roles
  FOR SELECT USING (is_active = true);

-- === PERMISSIONS ===
-- Cualquier usuario autenticado puede leer permisos
CREATE POLICY "authenticated_read_permissions" ON public.permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- === ROLE_PERMISSIONS ===
-- Cualquier usuario autenticado puede leer (necesario para cargar permisos)
CREATE POLICY "authenticated_read_role_permissions" ON public.role_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- === USER_ROLES ===
-- 1. Usuarios ven SUS propios roles
CREATE POLICY "users_read_own_roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- 2. Usuarios pueden insertar SU propio rol (registro)
CREATE POLICY "users_insert_own_role" ON public.user_roles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 3. Admins pueden ver TODOS los roles (usa función SECURITY DEFINER)
CREATE POLICY "admins_read_all_roles" ON public.user_roles
  FOR SELECT USING (public.check_is_admin(auth.uid()));

-- 4. Admins pueden insertar/actualizar/eliminar roles
CREATE POLICY "admins_manage_roles" ON public.user_roles
  FOR ALL USING (public.check_is_admin(auth.uid()));

-- === USER_PERMISSION_OVERRIDES ===
-- Usuarios ven sus propios overrides
CREATE POLICY "users_read_own_overrides" ON public.user_permission_overrides
  FOR SELECT USING (user_id = auth.uid());

-- Admins gestionan todos
CREATE POLICY "admins_manage_overrides" ON public.user_permission_overrides
  FOR ALL USING (public.check_is_admin(auth.uid()));

-- ============================================================================
-- PARTE 5: ASIGNAR ROL POR DEFECTO A USUARIOS SIN ROL
-- ============================================================================

-- Insertar rol "Entrenador" a todos los usuarios que no tienen rol
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
  u.id,
  (SELECT id FROM public.roles WHERE name = 'Entrenador' LIMIT 1)
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
)
AND (SELECT id FROM public.roles WHERE name = 'Entrenador' LIMIT 1) IS NOT NULL;

-- Verificar resultado
SELECT 
  u.email,
  r.name as role_name
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
ORDER BY u.created_at DESC;

-- ============================================================================
-- PARTE 6: ARREGLAR EL TRIGGER PARA NUEVOS USUARIOS
-- ============================================================================

-- Eliminar triggers existentes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

-- Crear función combinada
CREATE OR REPLACE FUNCTION public.handle_new_user_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_role_id UUID;
BEGIN
  -- 1. Crear perfil
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);
  
  -- 2. Asignar rol por defecto
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Entrenador' LIMIT 1;
  
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca fallar el registro del usuario
  RAISE WARNING 'handle_new_user_complete error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_complete();

-- ============================================================================
-- PARTE 7: VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar políticas creadas
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('roles', 'permissions', 'role_permissions', 'user_roles', 'user_permission_overrides')
ORDER BY tablename, policyname;

-- Verificar usuarios y sus roles
SELECT 
  u.email,
  array_agg(r.name) as roles
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
GROUP BY u.email;

-- ============================================================================
-- LISTO! Ahora:
-- 1. Los usuarios existentes tienen rol asignado
-- 2. Las políticas RLS no causan recursión
-- 3. Los nuevos usuarios recibirán rol automáticamente
-- ============================================================================
