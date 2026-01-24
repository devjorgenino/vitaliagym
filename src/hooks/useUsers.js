import { useState, useEffect } from "react";
import client from "../api/client";
import { fetchWithOffline } from "../lib/offline-read";
import { executeWithSync } from "../lib/data-sync";

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
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
      // Nice handling for offline fallback empty state
      if (err.message && err.message.includes('Sin conexión')) {
           // Maybe don't set error if we want to show empty list
      }
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId) => {
    try {
      // Intentar eliminar de la tabla profiles primero
      const { error } = await executeWithSync({
         table: 'profiles',
         type: 'DELETE',
         match: { id: userId }
      });

      // Si la tabla no existe, mostrar mensaje
      if (error && error.code === 'PGRST116') {
        return { 
          success: false, 
          error: 'Para eliminar usuarios, primero crea la tabla profiles ejecutando los scripts SQL proporcionados' 
        };
      }

      if (error) {
        throw error;
      }

      await fetchUsers();
      return { success: true };
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
  }, []);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    deleteUser,
  };
}
