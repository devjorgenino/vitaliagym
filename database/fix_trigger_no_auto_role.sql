-- ============================================================================
-- FIX: Eliminar asignación automática de rol en el trigger
-- 
-- PROBLEMA: El trigger asigna "Entrenador" automáticamente, ignorando
--           el rol que el usuario seleccionó en el formulario de registro.
--
-- SOLUCIÓN: El trigger solo crea el perfil. El frontend asigna el rol.
--
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================================================

-- Eliminar trigger existente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear función que SOLO crea el perfil (sin asignar rol)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear el perfil, NO asignar rol
  -- El rol lo asigna el frontend después del registro
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
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger solo para profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar que el trigger existe
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' AND trigger_schema = 'auth';

-- ============================================================================
-- LISTO! Ahora el trigger NO asigna rol automáticamente.
-- El frontend (registro) asigna el rol seleccionado por el usuario.
-- ============================================================================
