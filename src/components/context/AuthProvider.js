"use client";

import { createContext, useState, useEffect, use, useCallback, useMemo } from "react";
import client from "@/api/client";
import { executeWithSync } from "@/lib/data-sync";

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
        setUser(session?.user || null);
        
        // Si el usuario inicia sesión, el layout manejará la redirección
        // Si cierra sesión, redirigir al login
        if (event === 'SIGNED_OUT') {
          // Clear offline data for security
          import('@/lib/offline-db').then(mod => mod.clearAllMutations()).catch(console.error);
          window.location.href = '/auth/login';
        }
      }
    );

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const updateUserProfile = useCallback(async (profileData) => {
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      // Only verify session if online
      if (isOnline) {
          const { data: sessionData, error: sessionError } = await client.auth.refreshSession();
          
          if (sessionError) {
             console.error('Session refresh error:', sessionError);
             throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
          }

          if (!sessionData?.session?.user) {
             throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.');
          }
      }

      // Usar executeWithSync para soportar offline
      const { data, error } = await executeWithSync({
         table: 'auth.users', // Dummy table name for clarity in logs, ignored by AUTH_UPDATE type
         type: 'AUTH_UPDATE',
         data: { data: profileData } // Wrapper to match structure expected in data-sync
      });

      if (error) {
        console.error('Update user error:', error);
        throw error;
      }

      // Actualizar el estado del usuario con los nuevos datos (Optimistic Update)
      setUser(prev => ({
        ...prev,
        user_metadata: {
          ...prev?.user_metadata,
          ...profileData
        }
      }));

      // In offline mode, data might be mocked or null, but success is true.
      return { success: true, data };
    } catch (error) {
      console.error('Error updating profile:', error);
      
      // Si el error es de sesión y estamos Online, limpiar el estado del usuario
      if (typeof navigator !== 'undefined' && navigator.onLine && (error.message?.includes('session') || error.message?.includes('auth'))) {
        setUser(null);
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
