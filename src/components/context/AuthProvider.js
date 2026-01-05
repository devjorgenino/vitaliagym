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

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };
