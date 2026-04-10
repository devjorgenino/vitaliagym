import { useState, useEffect, useCallback } from "react";
import client from "@/api/client";

export function useCoaches() {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCoaches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await client.rpc("get_coaches");

      if (error) {
        console.error("Error fetching coaches:", error);
        setError(error.message);
        return;
      }

      setCoaches(data || []);
    } catch (err) {
      console.error("Error fetching coaches:", err);
      setError(err.message || "Error al obtener entrenadores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  return {
    coaches,
    loading,
    error,
    refetch: fetchCoaches,
  };
}

export default useCoaches;