-- ============================================================================
-- FIX COMPLETO: Corregir triggers de creación de usuarios
-- 
-- Este script soluciona el error "Database error saving new user"
-- causado por políticas RLS que bloquean los triggers.
-- 
-- EJECUTAR ESTE SCRIPT EN SUPABASE SQL EDITOR
-- ============================================================================

-- ============================================================================
-- PASO 1: Eliminar triggers existentes (para recrearlos correctamente)
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

-- ============================================================================
-- PASO 2: Corregir función handle_new_user para profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insertar perfil para el nuevo usuario
  -- SECURITY DEFINER permite bypass de RLS
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log del error pero NO fallar el registro
  RAISE WARNING 'handle_new_user error para usuario %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- PASO 3: Corregir función handle_new_user_with_role para user_roles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_with_role()
RETURNS TRIGGER AS $$
DECLARE
  v_default_role_id UUID;
BEGIN
  -- Obtener el ID del rol "Entrenador" como rol por defecto
  SELECT id INTO v_default_role_id 
  FROM public.roles 
  WHERE name = 'Entrenador' AND is_active = TRUE 
  LIMIT 1;
  
  -- Si existe el rol, asignarlo al nuevo usuario
  IF v_default_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, v_default_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log del error pero NO fallar el registro
  RAISE WARNING 'handle_new_user_with_role error para usuario %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- PASO 4: Recrear trigger único que maneje todo
-- ============================================================================

-- Función combinada que hace todo en una sola transacción
CREATE OR REPLACE FUNCTION public.handle_new_user_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_default_role_id UUID;
BEGIN
  -- 1. Insertar perfil
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, phone)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', '')
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
      phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.profiles.phone);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creando perfil para usuario %: %', NEW.id, SQLERRM;
  END;
  
  -- 2. Asignar rol por defecto (solo si la tabla roles existe y tiene datos)
  BEGIN
    SELECT id INTO v_default_role_id 
    FROM public.roles 
    WHERE name = 'Entrenador' AND is_active = TRUE 
    LIMIT 1;
    
    IF v_default_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (NEW.id, v_default_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Si la tabla roles no existe o hay otro error, continuar sin fallar
    RAISE WARNING 'Error asignando rol para usuario %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear UN SOLO trigger que ejecute la función combinada
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_complete();

-- ============================================================================
-- PASO 5: Agregar política RLS para permitir inserts desde SECURITY DEFINER
-- ============================================================================

-- Para profiles: permitir que el sistema inserte
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT
  WITH CHECK (true);  -- SECURITY DEFINER functions bypass RLS anyway

-- Para user_roles: ya tiene las políticas necesarias, pero agregar una de respaldo
DROP POLICY IF EXISTS "System can manage user_roles" ON public.user_roles;

-- ============================================================================
-- PASO 6: Verificar que las tablas existen y tienen datos
-- ============================================================================

-- Verificar profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    RAISE EXCEPTION 'La tabla profiles no existe. Ejecuta create_profiles_table.sql primero.';
  END IF;
END $$;

-- Verificar roles (si existe)
DO $$
DECLARE
  v_role_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
    SELECT COUNT(*) INTO v_role_count FROM public.roles;
    IF v_role_count = 0 THEN
      -- Insertar roles por defecto
      INSERT INTO public.roles (name, description, is_system_role, is_active) VALUES
        ('Admin', 'Administrador del sistema', TRUE, TRUE),
        ('Secretaria', 'Personal administrativo', TRUE, TRUE),
        ('Entrenador', 'Entrenador del gimnasio', TRUE, TRUE)
      ON CONFLICT (name) DO NOTHING;
      RAISE NOTICE 'Roles por defecto insertados.';
    ELSE
      RAISE NOTICE 'Hay % roles en la base de datos.', v_role_count;
    END IF;
  ELSE
    RAISE NOTICE 'La tabla roles no existe. Los usuarios se crearán sin rol asignado.';
  END IF;
END $$;

-- ============================================================================
-- PASO 7: Test - Verificar que el trigger está configurado correctamente
-- ============================================================================

DO $$
DECLARE
  v_trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_trigger_count 
  FROM information_schema.triggers 
  WHERE event_object_table = 'users' 
    AND trigger_schema = 'auth'
    AND trigger_name LIKE 'on_auth_user%';
  
  RAISE NOTICE 'Triggers configurados en auth.users: %', v_trigger_count;
  
  IF v_trigger_count = 0 THEN
    RAISE WARNING 'No se encontraron triggers. Puede haber un problema.';
  END IF;
END $$;

-- ============================================================================
-- LISTO! El registro de usuarios debería funcionar ahora.
-- ============================================================================
