import { useState, useEffect, useCallback } from "react";
import client from "../api/client";
import { fetchWithOffline } from "../lib/offline-read";
import { authDelete } from "../lib/auth-fetch";

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const fetcher = async () => {
        // Primero intentar obtener de la tabla profiles
        let { data, error } = await client
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
  
        // Si la tabla no existe o hay error, intentar obtener usuarios de otras formas
        if (error && error.code === 'PGRST116') {
          console.log('Tabla profiles no encontrada, intentando obtener usuarios de auth...');
          
          // Método 1: Intentar obtener usuarios usando una función RPC (si existe)
          try {
            const { data: rpcUsers, error: rpcError } = await client.rpc('get_all_users');
            
            if (!rpcError && rpcUsers) {
              data = rpcUsers.map(user => ({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || 'Usuario',
                phone: user.user_metadata?.phone || 'N/A',
                role: user.user_metadata?.role || 'user',
                created_at: user.created_at,
                updated_at: user.updated_at
              }));
              console.log('Usuarios obtenidos vía RPC:', data.length);
              error = null;
            }
          } catch (rpcErr) {
            console.log('RPC no disponible, intentando método alternativo...');
          }
          
          // Método 2: Si no hay RPC, obtener usuarios creados recientemente
          // (limitación: solo podemos obtener usuarios que conocemos o el usuario actual)
          if (!data || data.length === 0) {
            // Obtener el usuario actual como fallback
            const { data: { user } } = await client.auth.getUser();
            
            if (user) {
              data = [{
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || 'Usuario',
                phone: user.user_metadata?.phone || 'N/A',
                role: user.user_metadata?.role || 'user',
                created_at: user.created_at,
                updated_at: user.updated_at
              }];
              console.log('Mostrando solo usuario actual. Para ver todos los usuarios, crea la tabla profiles.');
            } else {
              data = [];
            }
            error = null;
          }
        }
        
        return { data, error };
      };

      const { data, error: fetchError } = await fetchWithOffline("users-list", fetcher);

      if (fetchError) {
        throw fetchError;
      }

      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteUser = async (userId) => {
    try {
      // Usar API Route para eliminar usuario (usa Admin API)
      // Envía userId en el body junto con el token para evitar error 431
      const { ok, data: result, error: apiError, status } = await authDelete(
        `/api/admin/users`,
        { userId }
      );

      console.log("Delete API response:", { ok, result, apiError, status });

      if (ok && result?.success) {
        // Actualizar estado local inmediatamente
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
        return { success: true };
      }
      
      // Error de permisos o autenticación
      if (status === 401) {
        return { success: false, error: "No hay sesión activa. Por favor, inicie sesión nuevamente." };
      }
      
      if (status === 403) {
        return { success: false, error: "No tiene permisos para eliminar usuarios." };
      }
      
      // Error de configuración del servidor
      if (status === 503) {
        return { success: false, error: "El servidor no está configurado para eliminar usuarios. Contacte al administrador." };
      }
      
      return { success: false, error: apiError || "Error al eliminar usuario" };
    } catch (err) {
      console.error("Error deleting user:", err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchUsers();
    
    const handleOnline = () => fetchUsers();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    deleteUser,
  };
}
