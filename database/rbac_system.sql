-- ============================================================================
-- SISTEMA DE CONTROL DE ACCESO BASADO EN ROLES (RBAC)
-- VitaliaGym - Sistema de Gestión de Gimnasio
-- ============================================================================

-- ============================================================================
-- PASO 1: CREAR TABLAS DEL SISTEMA RBAC
-- ============================================================================

-- Tabla de Roles
-- Almacena los roles del sistema (Admin, Secretaria, Entrenador, etc.)
CREATE TABLE IF NOT EXISTS roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE, -- Los roles del sistema no se pueden eliminar
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Permisos
-- Define todas las acciones posibles en el sistema
CREATE TABLE IF NOT EXISTS permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, -- Formato: modulo.accion (ej: users.create)
  name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL, -- Módulo del sistema (dashboard, clients, users, etc.)
  action TEXT NOT NULL, -- Acción específica (view, create, edit, delete)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Relación Roles-Permisos (Muchos a Muchos)
-- Define qué permisos tiene cada rol
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Tabla de Relación Usuarios-Roles (Muchos a Muchos)
-- Un usuario puede tener múltiples roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Tabla de Sobreescritura de Permisos por Usuario
-- Permite otorgar o denegar permisos específicos a un usuario
-- independientemente de sus roles
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL, -- TRUE = otorgado, FALSE = denegado
  reason TEXT, -- Razón de la sobreescritura
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, permission_id)
);

-- ============================================================================
-- PASO 2: CREAR ÍNDICES PARA OPTIMIZACIÓN
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_id ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);

-- ============================================================================
-- PASO 3: HABILITAR ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 4: POLÍTICAS RLS
-- ============================================================================

-- Políticas para roles (lectura pública para permitir registro, gestión solo admin)
CREATE POLICY "Anyone can view active roles"
  ON roles FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

-- Políticas para permissions (cualquier usuario autenticado puede leer)
CREATE POLICY "Authenticated users can view permissions"
  ON permissions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Políticas para role_permissions
CREATE POLICY "Authenticated users can view role_permissions"
  ON role_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage role_permissions"
  ON role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

-- Políticas para user_roles
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all user_roles"
  ON user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

-- Permitir que usuarios puedan insertar su propio rol (necesario para registro)
CREATE POLICY "Users can insert their own role"
  ON user_roles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage user_roles"
  ON user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

-- Políticas para user_permission_overrides
CREATE POLICY "Users can view their own permission overrides"
  ON user_permission_overrides FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all permission overrides"
  ON user_permission_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

CREATE POLICY "Admins can manage permission overrides"
  ON user_permission_overrides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

-- ============================================================================
-- PASO 5: INSERTAR ROLES INICIALES
-- ============================================================================

INSERT INTO roles (name, description, is_system_role) VALUES
  ('Admin', 'Administrador del sistema con acceso completo', TRUE),
  ('Secretaria', 'Personal administrativo con acceso a gestión de clientes y pagos', TRUE),
  ('Entrenador', 'Entrenador con acceso limitado a clientes y asistencia', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PASO 6: INSERTAR PERMISOS POR MÓDULO
-- ============================================================================

-- Permisos del Dashboard
INSERT INTO permissions (code, name, description, module, action) VALUES
  ('dashboard.view', 'Ver Dashboard', 'Permite ver el panel principal con métricas', 'dashboard', 'view'),
  ('dashboard.export', 'Exportar Métricas', 'Permite exportar métricas del dashboard', 'dashboard', 'export')
ON CONFLICT (code) DO NOTHING;

-- Permisos de Clientes
INSERT INTO permissions (code, name, description, module, action) VALUES
  ('clients.view', 'Ver Clientes', 'Permite ver la lista de clientes', 'clients', 'view'),
  ('clients.create', 'Crear Clientes', 'Permite registrar nuevos clientes', 'clients', 'create'),
  ('clients.edit', 'Editar Clientes', 'Permite modificar información de clientes', 'clients', 'edit'),
  ('clients.delete', 'Eliminar Clientes', 'Permite eliminar clientes del sistema', 'clients', 'delete')
ON CONFLICT (code) DO NOTHING;

-- Permisos de Asistencia
INSERT INTO permissions (code, name, description, module, action) VALUES
  ('attendance.view', 'Ver Asistencia', 'Permite ver registros de asistencia', 'attendance', 'view'),
  ('attendance.create', 'Registrar Asistencia', 'Permite registrar entradas/salidas', 'attendance', 'create'),
  ('attendance.edit', 'Editar Asistencia', 'Permite modificar registros de asistencia', 'attendance', 'edit'),
  ('attendance.delete', 'Eliminar Asistencia', 'Permite eliminar registros de asistencia', 'attendance', 'delete')
ON CONFLICT (code) DO NOTHING;

-- Permisos de Planes
INSERT INTO permissions (code, name, description, module, action) VALUES
  ('plans.view', 'Ver Planes', 'Permite ver los planes disponibles', 'plans', 'view'),
  ('plans.create', 'Crear Planes', 'Permite crear nuevos planes', 'plans', 'create'),
  ('plans.edit', 'Editar Planes', 'Permite modificar planes existentes', 'plans', 'edit'),
  ('plans.delete', 'Eliminar Planes', 'Permite eliminar planes', 'plans', 'delete')
ON CONFLICT (code) DO NOTHING;

-- Permisos de Usuarios
INSERT INTO permissions (code, name, description, module, action) VALUES
  ('users.view', 'Ver Usuarios', 'Permite ver la lista de usuarios del sistema', 'users', 'view'),
  ('users.create', 'Crear Usuarios', 'Permite registrar nuevos usuarios', 'users', 'create'),
  ('users.edit', 'Editar Usuarios', 'Permite modificar información de usuarios', 'users', 'edit'),
  ('users.delete', 'Eliminar Usuarios', 'Permite eliminar usuarios del sistema', 'users', 'delete'),
  ('users.manage_roles', 'Gestionar Roles de Usuarios', 'Permite asignar/quitar roles a usuarios', 'users', 'manage_roles')
ON CONFLICT (code) DO NOTHING;

-- Permisos de Pagos
INSERT INTO permissions (code, name, description, module, action) VALUES
  ('payments.view', 'Ver Pagos', 'Permite ver registros de pagos', 'payments', 'view'),
  ('payments.create', 'Registrar Pagos', 'Permite registrar nuevos pagos', 'payments', 'create'),
  ('payments.edit', 'Editar Pagos', 'Permite modificar registros de pagos', 'payments', 'edit'),
  ('payments.delete', 'Eliminar Pagos', 'Permite eliminar registros de pagos', 'payments', 'delete')
ON CONFLICT (code) DO NOTHING;

-- Permisos de Configuración
INSERT INTO permissions (code, name, description, module, action) VALUES
  ('settings.view', 'Ver Configuración', 'Permite ver la configuración del sistema', 'settings', 'view'),
  ('settings.edit', 'Editar Configuración', 'Permite modificar la configuración del sistema', 'settings', 'edit'),
  ('settings.manage_roles', 'Gestionar Roles', 'Permite crear, editar y eliminar roles del sistema', 'settings', 'manage_roles')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- PASO 7: ASIGNAR PERMISOS A ROLES
-- ============================================================================

-- Admin: Todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Secretaria: Dashboard, Clientes, Pagos, Planes (view), Asistencia
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Secretaria'
  AND (
    p.code IN (
      'dashboard.view',
      'clients.view', 'clients.create', 'clients.edit',
      'attendance.view', 'attendance.create',
      'plans.view',
      'payments.view', 'payments.create', 'payments.edit'
    )
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Entrenador: Dashboard (view), Clientes (view), Asistencia (view/create)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Entrenador'
  AND (
    p.code IN (
      'dashboard.view',
      'clients.view',
      'attendance.view', 'attendance.create'
    )
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- PASO 8: FUNCIONES AUXILIARES
-- ============================================================================

-- Función para obtener todos los permisos de un usuario (roles + overrides)
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE (
  permission_code TEXT,
  permission_name TEXT,
  module TEXT,
  action TEXT,
  source TEXT,
  granted BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH role_perms AS (
    -- Permisos que vienen de los roles del usuario
    SELECT DISTINCT
      p.code AS permission_code,
      p.name AS permission_name,
      p.module,
      p.action,
      'role' AS source,
      TRUE AS granted
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
  ),
  override_perms AS (
    -- Sobreescrituras de permisos del usuario
    SELECT
      p.code AS permission_code,
      p.name AS permission_name,
      p.module,
      p.action,
      'override' AS source,
      upo.granted
    FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id
    WHERE upo.user_id = p_user_id
  )
  -- Las sobreescrituras tienen prioridad sobre los roles
  SELECT COALESCE(o.permission_code, r.permission_code),
         COALESCE(o.permission_name, r.permission_name),
         COALESCE(o.module, r.module),
         COALESCE(o.action, r.action),
         COALESCE(o.source, r.source),
         COALESCE(o.granted, r.granted)
  FROM role_perms r
  FULL OUTER JOIN override_perms o ON r.permission_code = o.permission_code
  WHERE COALESCE(o.granted, r.granted, FALSE) = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si un usuario tiene un permiso específico
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
  v_override_exists BOOLEAN;
  v_override_granted BOOLEAN;
BEGIN
  -- Primero verificar si hay una sobreescritura
  SELECT EXISTS(
    SELECT 1 FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id
    WHERE upo.user_id = p_user_id AND p.code = p_permission_code
  ) INTO v_override_exists;

  IF v_override_exists THEN
    SELECT upo.granted INTO v_override_granted
    FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id
    WHERE upo.user_id = p_user_id AND p.code = p_permission_code;
    
    RETURN v_override_granted;
  END IF;

  -- Si no hay sobreescritura, verificar por roles
  SELECT EXISTS(
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id AND p.code = p_permission_code
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener los roles de un usuario
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id UUID)
RETURNS TABLE (
  role_id UUID,
  role_name TEXT,
  role_description TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.name, r.description, ur.assigned_at
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id AND r.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PASO 9: TRIGGER PARA ACTUALIZAR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_permission_overrides_updated_at
  BEFORE UPDATE ON user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PASO 10: TRIGGER PARA ASIGNAR ROL POR DEFECTO A NUEVOS USUARIOS
-- ============================================================================

-- Modificar la función handle_new_user existente para asignar rol
CREATE OR REPLACE FUNCTION handle_new_user_with_role()
RETURNS TRIGGER AS $$
DECLARE
  v_default_role_id UUID;
BEGIN
  -- Obtener el ID del rol "Entrenador" como rol por defecto
  -- (Puedes cambiar esto según tus necesidades)
  SELECT id INTO v_default_role_id FROM roles WHERE name = 'Entrenador' LIMIT 1;
  
  -- Si existe el rol, asignarlo al nuevo usuario
  IF v_default_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (NEW.id, v_default_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para asignar rol a nuevos usuarios (después del trigger de profiles)
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_with_role();

-- ============================================================================
-- PASO 11: VISTAS ÚTILES
-- ============================================================================

-- Vista para ver todos los permisos agrupados por módulo
CREATE OR REPLACE VIEW permissions_by_module AS
SELECT 
  module,
  json_agg(json_build_object(
    'id', id,
    'code', code,
    'name', name,
    'description', description,
    'action', action
  ) ORDER BY action) as permissions
FROM permissions
GROUP BY module
ORDER BY module;

-- Vista para ver roles con sus permisos
CREATE OR REPLACE VIEW roles_with_permissions AS
SELECT 
  r.id,
  r.name,
  r.description,
  r.is_system_role,
  r.is_active,
  COALESCE(
    json_agg(
      json_build_object(
        'permission_id', p.id,
        'code', p.code,
        'name', p.name,
        'module', p.module,
        'action', p.action
      )
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::json
  ) as permissions
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY r.id, r.name, r.description, r.is_system_role, r.is_active
ORDER BY r.name;

-- ============================================================================
-- FIN DEL SCRIPT RBAC
-- ============================================================================
