"use client";

import { createContext, useState, useEffect, use } from "react";
import client from "@/api/client";

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.auth
      .getSession()
      .then(({ data }) => {
        setUser(data?.session?.user || null);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    const { data: authListener } = client.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  const updateUserProfile = async (profileData) => {
    try {
      const { data, error } = await client.auth.updateUser({
        data: profileData
      });

      if (error) throw error;

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
      return { success: false, error: error.message || 'Error al actualizar perfil' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };
