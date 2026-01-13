"use client";

import { createContext, useState, useEffect, use, useCallback, useMemo } from "react";
import client from "@/api/client";

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await client.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setUser(null);
        } else {
          setUser(session?.user || null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: authListener } = client.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setUser(session?.user || null);
        
        // Si el usuario inicia sesión, el layout manejará la redirección
        // Si cierra sesión, redirigir al login
        if (event === 'SIGNED_OUT') {
          window.location.href = '/';
        }
      }
    );

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  const updateUserProfile = useCallback(async (profileData) => {
    try {
      // Verificar si hay una sesión activa y refrescar si es necesario
      const { data: sessionData, error: sessionError } = await client.auth.refreshSession();
      
      if (sessionError) {
        console.error('Session refresh error:', sessionError);
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
      }

      if (!sessionData?.session?.user) {
        throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.');
      }

      // Usar la sesión actualizada para actualizar el perfil
      const { data, error } = await client.auth.updateUser({
        data: profileData
      });

      if (error) {
        console.error('Update user error:', error);
        throw error;
      }

      // Actualizar el estado del usuario con los nuevos datos
      setUser(prev => ({
        ...prev,
        user_metadata: {
          ...prev.user_metadata,
          ...profileData
        }
      }));

      return { success: true, data };
    } catch (error) {
      console.error('Error updating profile:', error);
      
      // Si el error es de sesión, limpiar el estado del usuario
      if (error.message?.includes('session') || error.message?.includes('auth')) {
        setUser(null);
        // Opcionalmente redirigir al login
        window.location.href = '/auth/login';
      }
      
      return { success: false, error: error.message || 'Error al actualizar perfil' };
    }
  }, []);

  const value = useMemo(() => ({ 
    user, 
    loading, 
    updateUserProfile 
  }), [user, loading, updateUserProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };
