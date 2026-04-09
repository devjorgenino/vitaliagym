import { useState, useEffect, useCallback } from "react";
import client from "@/api/client";
import { fetchWithOffline } from "../lib/offline-read";

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

      // We import here or assume top-level import. Adding top-level is cleaner but for this one-shot tool call:
      // I will assume the previous tool call imports it if I instruct it to.
      // But wait, I need to add import. I will modify imports first in a separate tool call to be safe or
      // rely on the user understanding I am updating the block.
      // In this block, I will assume `fetchWithOffline` is imported.

      const { data, error: fetchError } = await fetchWithOffline("roles-list-public", () => client
        .from('roles')
        .select('id, name, description, is_system_role')
        .eq('is_active', true)
        .order('name'));

      if (fetchError) {
        console.warn('Error fetching roles from DB or Cache:', fetchError);
        throw fetchError;
      }

      if (data && data.length > 0) {
        setRoles(data);
        return data;
      } else {
        // Si no hay roles (y no hubo error de fetch/cache pero la data es vacía), 
        // podría significar que realmente no hay roles en la BD, o que el caché está vacío.
        // Si estamos offline y el caché está vacío, fetchWithOffline devuelve error, así que caemos en catch.
        // Si estamos online y devuelve [], usamos [].
        // Pero el código original usaba DEFAULT_ROLES como fallback si la BD estaba vacía?
        // Si, línea 43.
        console.warn('No roles found in DB/Cache, checking defaults');
        if (data && data.length === 0) {
             // Valid empty list from DB
             setRoles([]);
             return [];
        }
        // If data is null/undefined but error was false (should happen rarely with fetchWithOffline unless explicit null return)
        setRoles(DEFAULT_ROLES);
        return DEFAULT_ROLES;
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      // If offline cache failed (or network failed + no cache), we fallback to hardcoded defaults
      // This is a "good" fallback for offline mode if cache is missing.
      setError(err.message);
      
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
