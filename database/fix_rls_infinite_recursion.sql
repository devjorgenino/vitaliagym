-- ============================================================================
-- FIX: Corregir recursión infinita en políticas RLS de user_roles
-- 
-- ERROR: "infinite recursion detected in policy for relation user_roles"
-- 
-- CAUSA: Las políticas que verifican si el usuario es Admin consultan
--        la misma tabla user_roles, causando un loop infinito.
--
-- EJECUTAR ESTE SCRIPT EN SUPABASE SQL EDITOR
-- ============================================================================

-- ============================================================================
-- PASO 1: Eliminar TODAS las políticas existentes en user_roles
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON user_roles;
DROP POLICY IF EXISTS "System can manage user_roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage user_roles" ON user_roles;

-- ============================================================================
-- PASO 2: Crear función auxiliar para verificar si es Admin SIN recursión
-- Esta función usa SECURITY DEFINER para bypass RLS
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Esta función tiene SECURITY DEFINER, así que bypasea RLS
  SELECT EXISTS(
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = check_user_id 
      AND r.name = 'Admin'
      AND r.is_active = TRUE
  ) INTO v_is_admin;
  
  RETURN COALESCE(v_is_admin, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- PASO 3: Crear políticas simples SIN recursión
-- ============================================================================

-- Política 1: Usuarios pueden ver sus propios roles
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Política 2: Usuarios pueden insertar su propio rol (para registro)
CREATE POLICY "Users can insert own role"
  ON user_roles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Política 3: Service role puede hacer todo (para triggers/funciones del sistema)
-- Nota: El service role ya bypasea RLS, pero esto es por claridad
CREATE POLICY "Service role full access"
  ON user_roles FOR ALL
  USING (auth.role() = 'service_role');

-- Política 4: Admins pueden ver todos los roles (usando función sin recursión)
-- IMPORTANTE: Usamos una función que ya tiene SECURITY DEFINER
CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  USING (is_admin(auth.uid()));

-- Política 5: Admins pueden gestionar roles de otros usuarios
CREATE POLICY "Admins can manage roles"
  ON user_roles FOR ALL
  USING (is_admin(auth.uid()));

-- ============================================================================
-- PASO 4: Hacer lo mismo para role_permissions (puede tener el mismo problema)
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON role_permissions;

-- Cualquier usuario autenticado puede ver role_permissions (necesario para cargar permisos)
CREATE POLICY "Anyone authenticated can view role_permissions"
  ON role_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Solo admins pueden modificar
CREATE POLICY "Admins can manage role_permissions"
  ON role_permissions FOR ALL
  USING (is_admin(auth.uid()));

-- ============================================================================
-- PASO 5: Corregir políticas de permissions
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view permissions" ON permissions;

CREATE POLICY "Anyone authenticated can view permissions"
  ON permissions FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- PASO 6: Corregir políticas de user_permission_overrides
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can view all permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can manage permission overrides" ON user_permission_overrides;

-- Usuarios ven sus propios overrides
CREATE POLICY "Users can view own overrides"
  ON user_permission_overrides FOR SELECT
  USING (user_id = auth.uid());

-- Admins pueden ver y gestionar todos
CREATE POLICY "Admins can manage all overrides"
  ON user_permission_overrides FOR ALL
  USING (is_admin(auth.uid()));

-- ============================================================================
-- PASO 7: Verificar que todo está correcto
-- ============================================================================

DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count 
  FROM pg_policies 
  WHERE tablename = 'user_roles';
  
  RAISE NOTICE 'Políticas en user_roles: %', v_policy_count;
  
  IF v_policy_count = 0 THEN
    RAISE WARNING 'No hay políticas en user_roles. RLS bloqueará todo.';
  END IF;
END $$;

-- Mostrar las políticas creadas
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('user_roles', 'role_permissions', 'permissions', 'user_permission_overrides')
ORDER BY tablename, policyname;

-- ============================================================================
-- LISTO! La recursión infinita debería estar solucionada.
-- ============================================================================
