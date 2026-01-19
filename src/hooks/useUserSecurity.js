import { useState, useCallback } from "react";
import client from "@/api/client";

/**
 * Hook para gestionar roles y permisos de un usuario específico
 * 
 * @param {string} userId - ID del usuario
 */
const useUserSecurity = (userId) => {
  const [userRoles, setUserRoles] = useState([]);
  const [userPermissionOverrides, setUserPermissionOverrides] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar roles del usuario
  const fetchUserRoles = useCallback(async () => {
    if (!userId) return [];

    try {
      const { data, error: fetchError } = await client
        .from('user_roles')
        .select(`
          id,
          assigned_at,
          assigned_by,
          roles (
            id,
            name,
            description,
            is_system_role
          )
        `)
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      const formattedRoles = data?.map(ur => ({
        id: ur.id,
        roleId: ur.roles.id,
        roleName: ur.roles.name,
        roleDescription: ur.roles.description,
        isSystemRole: ur.roles.is_system_role,
        assignedAt: ur.assigned_at,
        assignedBy: ur.assigned_by,
      })) || [];

      setUserRoles(formattedRoles);
      return formattedRoles;
    } catch (err) {
      console.error('Error fetching user roles:', err);
      setError(err.message);
      return [];
    }
  }, [userId]);

  // Cargar sobreescrituras de permisos del usuario
  const fetchUserPermissionOverrides = useCallback(async () => {
    if (!userId) return [];

    try {
      const { data, error: fetchError } = await client
        .from('user_permission_overrides')
        .select(`
          id,
          granted,
          reason,
          granted_by,
          created_at,
          permissions (
            id,
            code,
            name,
            description,
            module,
            action
          )
        `)
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      const formattedOverrides = data?.map(upo => ({
        id: upo.id,
        permissionId: upo.permissions.id,
        permissionCode: upo.permissions.code,
        permissionName: upo.permissions.name,
        permissionModule: upo.permissions.module,
        permissionAction: upo.permissions.action,
        granted: upo.granted,
        reason: upo.reason,
        grantedBy: upo.granted_by,
        createdAt: upo.created_at,
      })) || [];

      setUserPermissionOverrides(formattedOverrides);
      return formattedOverrides;
    } catch (err) {
      console.error('Error fetching user permission overrides:', err);
      setError(err.message);
      return [];
    }
  }, [userId]);

  // Cargar todos los roles disponibles
  const fetchAllRoles = useCallback(async () => {
    try {
      const { data, error: fetchError } = await client
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (fetchError) throw fetchError;

      setAllRoles(data || []);
      return data || [];
    } catch (err) {
      console.error('Error fetching all roles:', err);
      return [];
    }
  }, []);

  // Cargar todos los permisos
  const fetchAllPermissions = useCallback(async () => {
    try {
      const { data, error: fetchError } = await client
        .from('permissions')
        .select('*')
        .order('module')
        .order('action');

      if (fetchError) throw fetchError;

      setAllPermissions(data || []);
      return data || [];
    } catch (err) {
      console.error('Error fetching all permissions:', err);
      return [];
    }
  }, []);

  // Cargar todos los datos
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchUserRoles(),
        fetchUserPermissionOverrides(),
        fetchAllRoles(),
        fetchAllPermissions(),
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchUserRoles, fetchUserPermissionOverrides, fetchAllRoles, fetchAllPermissions]);

  // Asignar rol a usuario
  const assignRole = useCallback(async (roleId) => {
    if (!userId) return { success: false, error: 'Usuario no especificado' };

    try {
      setError(null);

      // Obtener el usuario actual para assigned_by
      const { data: { user: currentUser } } = await client.auth.getUser();

      const { error: insertError } = await client
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
          assigned_by: currentUser?.id,
        });

      if (insertError) throw insertError;

      await fetchUserRoles();
      return { success: true };
    } catch (err) {
      console.error('Error assigning role:', err);
      return { success: false, error: err.message };
    }
  }, [userId, fetchUserRoles]);

  // Revocar rol de usuario
  const revokeRole = useCallback(async (roleId) => {
    if (!userId) return { success: false, error: 'Usuario no especificado' };

    try {
      setError(null);

      const { error: deleteError } = await client
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId);

      if (deleteError) throw deleteError;

      await fetchUserRoles();
      return { success: true };
    } catch (err) {
      console.error('Error revoking role:', err);
      return { success: false, error: err.message };
    }
  }, [userId, fetchUserRoles]);

  // Crear o actualizar sobreescritura de permiso
  const setPermissionOverride = useCallback(async (permissionId, granted, reason = '') => {
    if (!userId) return { success: false, error: 'Usuario no especificado' };

    try {
      setError(null);

      // Obtener el usuario actual para granted_by
      const { data: { user: currentUser } } = await client.auth.getUser();

      // Primero intentar actualizar si existe
      const { data: existing } = await client
        .from('user_permission_overrides')
        .select('id')
        .eq('user_id', userId)
        .eq('permission_id', permissionId)
        .single();

      if (existing) {
        // Actualizar
        const { error: updateError } = await client
          .from('user_permission_overrides')
          .update({
            granted,
            reason,
            granted_by: currentUser?.id,
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Insertar
        const { error: insertError } = await client
          .from('user_permission_overrides')
          .insert({
            user_id: userId,
            permission_id: permissionId,
            granted,
            reason,
            granted_by: currentUser?.id,
          });

        if (insertError) throw insertError;
      }

      await fetchUserPermissionOverrides();
      return { success: true };
    } catch (err) {
      console.error('Error setting permission override:', err);
      return { success: false, error: err.message };
    }
  }, [userId, fetchUserPermissionOverrides]);

  // Eliminar sobreescritura de permiso
  const removePermissionOverride = useCallback(async (permissionId) => {
    if (!userId) return { success: false, error: 'Usuario no especificado' };

    try {
      setError(null);

      const { error: deleteError } = await client
        .from('user_permission_overrides')
        .delete()
        .eq('user_id', userId)
        .eq('permission_id', permissionId);

      if (deleteError) throw deleteError;

      await fetchUserPermissionOverrides();
      return { success: true };
    } catch (err) {
      console.error('Error removing permission override:', err);
      return { success: false, error: err.message };
    }
  }, [userId, fetchUserPermissionOverrides]);

  // Verificar si el usuario tiene un rol específico
  const hasRole = useCallback((roleName) => {
    return userRoles.some(ur => ur.roleName === roleName);
  }, [userRoles]);

  // Obtener permisos efectivos del usuario (incluyendo sobreescrituras)
  const getEffectivePermissions = useCallback(async () => {
    if (!userId) return [];

    try {
      // Obtener permisos de roles
      const roleIds = userRoles.map(ur => ur.roleId);
      
      let rolePermissions = [];
      if (roleIds.length > 0) {
        const { data, error } = await client
          .from('role_permissions')
          .select(`
            permissions (
              id,
              code,
              name,
              module,
              action
            )
          `)
          .in('role_id', roleIds);

        if (!error && data) {
          rolePermissions = data.map(rp => ({
            ...rp.permissions,
            source: 'role',
            granted: true,
          }));
        }
      }

      // Crear mapa de permisos
      const permissionMap = new Map();
      rolePermissions.forEach(p => {
        permissionMap.set(p.code, p);
      });

      // Aplicar sobreescrituras
      userPermissionOverrides.forEach(override => {
        if (override.granted) {
          permissionMap.set(override.permissionCode, {
            id: override.permissionId,
            code: override.permissionCode,
            name: override.permissionName,
            module: override.permissionModule,
            action: override.permissionAction,
            source: 'override',
            granted: true,
          });
        } else {
          permissionMap.delete(override.permissionCode);
        }
      });

      return Array.from(permissionMap.values());
    } catch (err) {
      console.error('Error getting effective permissions:', err);
      return [];
    }
  }, [userId, userRoles, userPermissionOverrides]);

  return {
    // Estado
    userRoles,
    userPermissionOverrides,
    allRoles,
    allPermissions,
    loading,
    error,

    // Carga de datos
    loadAll,
    fetchUserRoles,
    fetchUserPermissionOverrides,

    // Acciones de roles
    assignRole,
    revokeRole,
    hasRole,

    // Acciones de permisos
    setPermissionOverride,
    removePermissionOverride,
    getEffectivePermissions,
  };
};

export default useUserSecurity;
