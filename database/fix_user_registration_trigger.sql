-- ============================================================================
-- FIX: Trigger para asignar rol a nuevos usuarios
-- Este script corrige el problema de "Database error saving new user"
-- ============================================================================

-- Primero eliminar el trigger existente si existe
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

-- Eliminar la función existente
DROP FUNCTION IF EXISTS handle_new_user_with_role();

-- Crear una nueva versión de la función que no falle
-- Esta función se ejecuta con SECURITY DEFINER para bypasear RLS
CREATE OR REPLACE FUNCTION handle_new_user_with_role()
RETURNS TRIGGER AS $$
DECLARE
  v_default_role_id UUID;
BEGIN
  -- Usar un bloque de excepción para que no falle el registro si algo sale mal
  BEGIN
    -- Obtener el ID del rol "Entrenador" como rol por defecto
    SELECT id INTO v_default_role_id FROM public.roles WHERE name = 'Entrenador' LIMIT 1;
    
    -- Si existe el rol, asignarlo al nuevo usuario
    IF v_default_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (NEW.id, v_default_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log del error pero no fallar el registro
    RAISE WARNING 'Error asignando rol por defecto al usuario %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear el trigger (AFTER INSERT para no bloquear la creación del usuario)
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_with_role();

-- ============================================================================
-- Actualizar políticas RLS de user_roles para permitir insert desde triggers
-- ============================================================================

-- Primero eliminar las políticas existentes
DROP POLICY IF EXISTS "Users can insert their own role" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage user_roles" ON user_roles;
DROP POLICY IF EXISTS "System can insert user_roles" ON user_roles;

-- Política para permitir que usuarios inserten su propio rol durante el registro
-- (después de que se autentican)
CREATE POLICY "Users can insert their own role"
  ON user_roles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Política adicional para que SECURITY DEFINER functions puedan insertar
-- (Esto permite que el trigger funcione correctamente)
-- Nota: Las funciones SECURITY DEFINER ya bypass RLS, pero por si acaso

-- ============================================================================
-- Verificar que la tabla roles tenga los datos necesarios
-- ============================================================================
INSERT INTO public.roles (name, description, is_system_role) VALUES
  ('Admin', 'Administrador del sistema con acceso completo', TRUE),
  ('Secretaria', 'Personal administrativo con acceso a gestión de clientes y pagos', TRUE),
  ('Entrenador', 'Entrenador con acceso limitado a clientes y asistencia', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Verificación
-- ============================================================================
DO $$
DECLARE
  v_role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_role_count FROM public.roles;
  RAISE NOTICE 'Roles en la tabla: %', v_role_count;
  
  IF v_role_count = 0 THEN
    RAISE WARNING 'No hay roles en la tabla roles. El registro fallará.';
  END IF;
END $$;
