import { useState, useEffect } from "react";
import client from "../api/client";

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Primero intentar obtener de la tabla profiles
      let { data, error } = await client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Si la tabla no existe o hay error, obtener usuarios de auth
      if (error && error.code === 'PGRST116') {
        console.log('Tabla profiles no encontrada, obteniendo usuarios de auth...');
        
        // Obtener el usuario actual y simular una lista
        const { data: { user } } = await client.auth.getUser();
        
        if (user) {
          data = [{
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || 'Usuario',
            phone: user.phone || 'N/A',
            role: user.user_metadata?.role || 'user',
            created_at: user.created_at,
            updated_at: user.updated_at
          }];
        } else {
          data = [];
        }
        error = null;
      }

      if (error) {
        throw error;
      }

      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId) => {
    try {
      // Intentar eliminar de la tabla profiles primero
      let { error } = await client
        .from('profiles')
        .delete()
        .eq('id', userId);

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
  }, []);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    deleteUser,
  };
}
