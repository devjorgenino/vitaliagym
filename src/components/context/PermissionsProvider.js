"use client";

import { createContext, useState, useEffect, useCallback, useMemo } from "react";
import client from "@/api/client";
import useAuth from "@/hooks/useAuth";

// Definición de permisos por módulo para referencia en el frontend
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_EXPORT: 'dashboard.export',
  
  // Clientes
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_EDIT: 'clients.edit',
  CLIENTS_DELETE: 'clients.delete',
  
  // Asistencia
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_CREATE: 'attendance.create',
  ATTENDANCE_EDIT: 'attendance.edit',
  ATTENDANCE_DELETE: 'attendance.delete',
  
  // Planes
  PLANS_VIEW: 'plans.view',
  PLANS_CREATE: 'plans.create',
  PLANS_EDIT: 'plans.edit',
  PLANS_DELETE: 'plans.delete',
  
  // Usuarios
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  USERS_MANAGE_ROLES: 'users.manage_roles',
  
  // Pagos
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_EDIT: 'payments.edit',
  PAYMENTS_DELETE: 'payments.delete',
  
  // Configuración
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  SETTINGS_MANAGE_ROLES: 'settings.manage_roles',

  // Administración
  ADMIN_VIEW: 'admin.view',
  ADMIN_STAFF_VIEW: 'admin.staff.view',
  ADMIN_STAFF_CREATE: 'admin.staff.create',
  ADMIN_STAFF_EDIT: 'admin.staff.edit',
  ADMIN_STAFF_DELETE: 'admin.staff.delete',
  ADMIN_STAFF_PAYMENTS_VIEW: 'admin.staff_payments.view',
  ADMIN_STAFF_PAYMENTS_CREATE: 'admin.staff_payments.create',
  ADMIN_STAFF_PAYMENTS_EDIT: 'admin.staff_payments.edit',
  ADMIN_STAFF_PAYMENTS_DELETE: 'admin.staff_payments.delete',
  ADMIN_EXPENSES_VIEW: 'admin.expenses.view',
  ADMIN_EXPENSES_CREATE: 'admin.expenses.create',
  ADMIN_EXPENSES_EDIT: 'admin.expenses.edit',
  ADMIN_EXPENSES_DELETE: 'admin.expenses.delete',
  ADMIN_REPORTS_VIEW: 'admin.reports.view',
  ADMIN_REPORTS_EXPORT: 'admin.reports.export',
};

// Mapeo de rutas a permisos requeridos
export const ROUTE_PERMISSIONS = {
  '/dashboard': [PERMISSIONS.DASHBOARD_VIEW],
  '/clientes': [PERMISSIONS.CLIENTS_VIEW],
  '/asistencia': [PERMISSIONS.ATTENDANCE_VIEW],
  '/planes': [PERMISSIONS.PLANS_VIEW],
  '/usuarios': [PERMISSIONS.USERS_VIEW],
  '/pagos': [PERMISSIONS.PAYMENTS_VIEW],
  '/configuracion/roles': [PERMISSIONS.SETTINGS_MANAGE_ROLES],
  '/administracion': [PERMISSIONS.ADMIN_VIEW],
  '/perfil': [], // Todos los usuarios autenticados pueden ver su perfil
};

// Mapeo de módulos para el sidebar
export const MODULE_PERMISSIONS = {
  dashboard: PERMISSIONS.DASHBOARD_VIEW,
  clients: PERMISSIONS.CLIENTS_VIEW,
  attendance: PERMISSIONS.ATTENDANCE_VIEW,
  plans: PERMISSIONS.PLANS_VIEW,
  users: PERMISSIONS.USERS_VIEW,
  payments: PERMISSIONS.PAYMENTS_VIEW,
  settings: PERMISSIONS.SETTINGS_VIEW,
  admin: PERMISSIONS.ADMIN_VIEW,
};

const PermissionsContext = createContext(null);

const PermissionsProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionOverrides, setPermissionOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar permisos del usuario
  const loadUserPermissions = useCallback(async () => {
    if (!user?.id) {
      setPermissions([]);
      setRoles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Obtener roles del usuario
      const { data: userRoles, error: rolesError } = await client
        .from('user_roles')
        .select(`
          id,
          assigned_at,
          roles (
            id,
            name,
            description,
            is_system_role
          )
        `)
        .eq('user_id', user.id);

      if (rolesError) throw rolesError;

      const formattedRoles = userRoles?.map(ur => ({
        id: ur.roles.id,
        name: ur.roles.name,
        description: ur.roles.description,
        isSystemRole: ur.roles.is_system_role,
        assignedAt: ur.assigned_at,
      })) || [];

      setRoles(formattedRoles);

      // Obtener permisos basados en los roles
      const roleIds = formattedRoles.map(r => r.id);
      
      let rolePermissions = [];
      if (roleIds.length > 0) {
        const { data: permData, error: permError } = await client
          .from('role_permissions')
          .select(`
            permissions (
              id,
              code,
              name,
              description,
              module,
              action
            )
          `)
          .in('role_id', roleIds);

        if (permError) throw permError;
        
        rolePermissions = permData?.map(rp => rp.permissions) || [];
      }

      // Obtener sobreescrituras de permisos del usuario
      const { data: overrides, error: overridesError } = await client
        .from('user_permission_overrides')
        .select(`
          id,
          granted,
          reason,
          permissions (
            id,
            code,
            name,
            module,
            action
          )
        `)
        .eq('user_id', user.id);

      if (overridesError) throw overridesError;

      setPermissionOverrides(overrides || []);

      // Calcular permisos efectivos (roles + overrides)
      const permissionMap = new Map();

      // Primero agregar permisos de roles
      rolePermissions.forEach(perm => {
        if (perm) {
          permissionMap.set(perm.code, {
            ...perm,
            source: 'role',
            granted: true,
          });
        }
      });

      // Aplicar sobreescrituras
      overrides?.forEach(override => {
        if (override.granted) {
          // Agregar o mantener permiso
          permissionMap.set(override.permissions.code, {
            ...override.permissions,
            source: 'override',
            granted: true,
          });
        } else {
          // Denegar permiso (eliminar de la lista efectiva)
          permissionMap.delete(override.permissions.code);
        }
      });

      setPermissions(Array.from(permissionMap.values()));
    } catch (err) {
      console.error('Error loading permissions:', err);
      setError(err.message);
      setPermissions([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Cargar permisos cuando el usuario cambia
  useEffect(() => {
    if (!authLoading) {
      loadUserPermissions();
    }
  }, [authLoading, loadUserPermissions]);

  // Verificar si el usuario tiene un permiso específico
  const hasPermission = useCallback((permissionCode) => {
    if (!permissionCode) return true;
    return permissions.some(p => p.code === permissionCode);
  }, [permissions]);

  // Verificar si el usuario tiene alguno de los permisos dados
  const hasAnyPermission = useCallback((permissionCodes) => {
    if (!permissionCodes || permissionCodes.length === 0) return true;
    return permissionCodes.some(code => hasPermission(code));
  }, [hasPermission]);

  // Verificar si el usuario tiene todos los permisos dados
  const hasAllPermissions = useCallback((permissionCodes) => {
    if (!permissionCodes || permissionCodes.length === 0) return true;
    return permissionCodes.every(code => hasPermission(code));
  }, [hasPermission]);

  // Verificar si el usuario tiene un rol específico
  const hasRole = useCallback((roleName) => {
    return roles.some(r => r.name === roleName);
  }, [roles]);

  // Verificar si el usuario es administrador
  const isAdmin = useCallback(() => {
    return hasRole('Admin');
  }, [hasRole]);

  // Verificar si puede acceder a una ruta
  const canAccessRoute = useCallback((pathname) => {
    // Encontrar la ruta base que coincide
    const routeKey = Object.keys(ROUTE_PERMISSIONS).find(route => 
      pathname === route || pathname.startsWith(route + '/')
    );

    if (!routeKey) return true; // Ruta no definida, permitir acceso
    
    const requiredPermissions = ROUTE_PERMISSIONS[routeKey];
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    
    return hasAnyPermission(requiredPermissions);
  }, [hasAnyPermission]);

  // Obtener permisos por módulo
  const getPermissionsByModule = useCallback((moduleName) => {
    return permissions.filter(p => p.module === moduleName);
  }, [permissions]);

  // Refrescar permisos
  const refreshPermissions = useCallback(async () => {
    await loadUserPermissions();
  }, [loadUserPermissions]);

  const value = useMemo(() => ({
    // Estado
    permissions,
    roles,
    permissionOverrides,
    loading: loading || authLoading,
    error,
    
    // Funciones de verificación
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isAdmin,
    canAccessRoute,
    getPermissionsByModule,
    
    // Acciones
    refreshPermissions,
    
    // Constantes
    PERMISSIONS,
    ROUTE_PERMISSIONS,
    MODULE_PERMISSIONS,
  }), [
    permissions,
    roles,
    permissionOverrides,
    loading,
    authLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isAdmin,
    canAccessRoute,
    getPermissionsByModule,
    refreshPermissions,
  ]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export { PermissionsContext, PermissionsProvider };
