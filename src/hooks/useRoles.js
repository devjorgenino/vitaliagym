import { useState, useCallback, useEffect } from "react";
import client from "@/api/client";

/**
 * Hook para gestionar roles y permisos del sistema
 * 
 * Proporciona funciones CRUD para roles, permisos y sus relaciones
 */
const useRoles = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [permissionsByModule, setPermissionsByModule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar todos los roles con sus permisos
  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await client
        .from('roles')
        .select(`
          id,
          name,
          description,
          is_system_role,
          is_active,
          created_at,
          updated_at,
          role_permissions (
            permission_id,
            permissions (
              id,
              code,
              name,
              description,
              module,
              action
            )
          )
        `)
        .order('name');

      if (fetchError) throw fetchError;

      // Formatear datos
      const formattedRoles = data?.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        isSystemRole: role.is_system_role,
        isActive: role.is_active,
        createdAt: role.created_at,
        updatedAt: role.updated_at,
        permissions: role.role_permissions?.map(rp => rp.permissions) || [],
      })) || [];

      setRoles(formattedRoles);
      return formattedRoles;
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar todos los permisos
  const fetchPermissions = useCallback(async () => {
    try {
      const { data, error: fetchError } = await client
        .from('permissions')
        .select('*')
        .order('module')
        .order('action');

      if (fetchError) throw fetchError;

      setPermissions(data || []);

      // Agrupar por módulo
      const byModule = (data || []).reduce((acc, perm) => {
        if (!acc[perm.module]) {
          acc[perm.module] = [];
        }
        acc[perm.module].push(perm);
        return acc;
      }, {});

      setPermissionsByModule(byModule);
      return data || [];
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError(err.message);
      return [];
    }
  }, []);

  // Crear un nuevo rol
  const createRole = useCallback(async (roleData) => {
    try {
      setError(null);

      const { data, error: createError } = await client
        .from('roles')
        .insert({
          name: roleData.name,
          description: roleData.description,
          is_active: true,
          is_system_role: false,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Refrescar lista
      await fetchRoles();
      return { success: true, data };
    } catch (err) {
      console.error('Error creating role:', err);
      return { success: false, error: err.message };
    }
  }, [fetchRoles]);

  // Actualizar un rol
  const updateRole = useCallback(async (roleId, roleData) => {
    try {
      setError(null);

      const { data, error: updateError } = await client
        .from('roles')
        .update({
          name: roleData.name,
          description: roleData.description,
          is_active: roleData.isActive,
        })
        .eq('id', roleId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Refrescar lista
      await fetchRoles();
      return { success: true, data };
    } catch (err) {
      console.error('Error updating role:', err);
      return { success: false, error: err.message };
    }
  }, [fetchRoles]);

  // Eliminar un rol
  const deleteRole = useCallback(async (roleId) => {
    try {
      setError(null);

      // Verificar que no sea un rol del sistema
      const role = roles.find(r => r.id === roleId);
      if (role?.isSystemRole) {
        return { success: false, error: 'No se pueden eliminar roles del sistema' };
      }

      const { error: deleteError } = await client
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (deleteError) throw deleteError;

      // Refrescar lista
      await fetchRoles();
      return { success: true };
    } catch (err) {
      console.error('Error deleting role:', err);
      return { success: false, error: err.message };
    }
  }, [roles, fetchRoles]);

  // Asignar permiso a un rol
  const assignPermissionToRole = useCallback(async (roleId, permissionId) => {
    try {
      setError(null);

      const { error: assignError } = await client
        .from('role_permissions')
        .insert({
          role_id: roleId,
          permission_id: permissionId,
        });

      if (assignError) throw assignError;

      // Refrescar lista
      await fetchRoles();
      return { success: true };
    } catch (err) {
      console.error('Error assigning permission:', err);
      return { success: false, error: err.message };
    }
  }, [fetchRoles]);

  // Revocar permiso de un rol
  const revokePermissionFromRole = useCallback(async (roleId, permissionId) => {
    try {
      setError(null);

      const { error: revokeError } = await client
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .eq('permission_id', permissionId);

      if (revokeError) throw revokeError;

      // Refrescar lista
      await fetchRoles();
      return { success: true };
    } catch (err) {
      console.error('Error revoking permission:', err);
      return { success: false, error: err.message };
    }
  }, [fetchRoles]);

  // Toggle permiso (asignar si no existe, revocar si existe)
  const toggleRolePermission = useCallback(async (roleId, permissionId) => {
    const role = roles.find(r => r.id === roleId);
    const hasPermission = role?.permissions.some(p => p.id === permissionId);

    if (hasPermission) {
      return revokePermissionFromRole(roleId, permissionId);
    } else {
      return assignPermissionToRole(roleId, permissionId);
    }
  }, [roles, assignPermissionToRole, revokePermissionFromRole]);

  // Actualizar todos los permisos de un rol de una vez
  const updateRolePermissions = useCallback(async (roleId, permissionIds) => {
    try {
      setError(null);

      // Eliminar todos los permisos actuales
      const { error: deleteError } = await client
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      if (deleteError) throw deleteError;

      // Insertar los nuevos permisos
      if (permissionIds.length > 0) {
        const { error: insertError } = await client
          .from('role_permissions')
          .insert(
            permissionIds.map(permId => ({
              role_id: roleId,
              permission_id: permId,
            }))
          );

        if (insertError) throw insertError;
      }

      // Refrescar lista
      await fetchRoles();
      return { success: true };
    } catch (err) {
      console.error('Error updating role permissions:', err);
      return { success: false, error: err.message };
    }
  }, [fetchRoles]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchRoles(), fetchPermissions()]);
    };
    loadData();
  }, [fetchRoles, fetchPermissions]);

  return {
    // Estado
    roles,
    permissions,
    permissionsByModule,
    loading,
    error,

    // Acciones de roles
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,

    // Acciones de permisos
    fetchPermissions,
    assignPermissionToRole,
    revokePermissionFromRole,
    toggleRolePermission,
    updateRolePermissions,
  };
};

export default useRoles;
