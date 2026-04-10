import { useState, useEffect, useCallback } from "react";
import { getWorkouts, getWorkoutById } from "@/lib/notion-client";

export function useWorkouts() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWorkouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkouts();
      setWorkouts(data);
    } catch (err) {
      console.error("Error fetching workouts:", err);
      setError(err.message || "Error al obtener entrenamientos");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorkoutById = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkoutById(id);
      return data;
    } catch (err) {
      console.error("Error fetching workout:", err);
      setError(err.message || "Error al obtener entrenamiento");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  return {
    workouts,
    loading,
    error,
    refetch: fetchWorkouts,
    fetchWorkoutById,
  };
}

export default useWorkouts;