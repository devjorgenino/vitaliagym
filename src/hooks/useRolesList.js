import { useState, useEffect, useCallback } from "react";
import client from "@/api/client";

// Roles por defecto en caso de que no se puedan cargar de la BD
const DEFAULT_ROLES = [
  { id: 'admin', name: 'Admin', description: 'Administrador del sistema' },
  { id: 'secretaria', name: 'Secretaria', description: 'Personal administrativo' },
  { id: 'entrenador', name: 'Entrenador', description: 'Entrenador del gimnasio' },
];

/**
 * Hook para obtener la lista de roles disponibles
 * Útil para selectores de rol en formularios de registro/creación
 * 
 * Funciona tanto para usuarios autenticados como no autenticados
 * (requiere que la política RLS permita lectura pública de roles)
 */
const useRolesList = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await client
        .from('roles')
        .select('id, name, description, is_system_role')
        .eq('is_active', true)
        .order('name');

      if (fetchError) {
        console.warn('Error fetching roles from DB:', fetchError);
        throw fetchError;
      }

      if (data && data.length > 0) {
        setRoles(data);
        return data;
      } else {
        // Si no hay roles, usar los por defecto
        console.warn('No roles found in DB, using defaults');
        setRoles(DEFAULT_ROLES);
        return DEFAULT_ROLES;
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError(err.message);
      
      // En caso de error, usar roles por defecto
      // Esto permite que el formulario funcione aunque la BD no esté lista
      setRoles(DEFAULT_ROLES);
      return DEFAULT_ROLES;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  /**
   * Obtener el ID de un rol por su nombre
   */
  const getRoleIdByName = useCallback((name) => {
    const role = roles.find(r => r.name.toLowerCase() === name.toLowerCase());
    return role?.id || null;
  }, [roles]);

  /**
   * Obtener el rol por defecto (Entrenador o el primero disponible)
   */
  const getDefaultRole = useCallback(() => {
    return roles.find(r => r.name === 'Entrenador') || roles[0] || null;
  }, [roles]);

  return {
    roles,
    loading,
    error,
    refetch: fetchRoles,
    getRoleIdByName,
    getDefaultRole,
  };
};

export default useRolesList;
