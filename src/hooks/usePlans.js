import { useState, useEffect } from 'react';
import client from '../api/client';

export function usePlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await client
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          setError('La tabla "plans" no existe. Ejecuta el script SQL en /config');
        } else {
          setError(`Error: ${error.message}`);
        }
        return;
      }

      setPlans(data || []);
    } catch (err) {
      console.error("Error fetching plans:", err);
      setError('Error de conexión. Verifica tu configuración.');
    } finally {
      setLoading(false);
    }
  };

  const createPlan = async (planData) => {
    try {
      const { data, error } = await client
        .from('plans')
        .insert([planData])
        .select();

      if (error) {
        throw error;
      }

      await fetchPlans();
      return { success: true, data: data[0] };
    } catch (err) {
      console.error("Error creating plan:", err);
      return { success: false, error: err.message };
    }
  };

  const updatePlan = async (id, planData) => {
    try {
      const { data, error } = await client
        .from('plans')
        .update(planData)
        .eq('id', id)
        .select();

      if (error) {
        throw error;
      }

      await fetchPlans();
      return { success: true, data: data[0] };
    } catch (err) {
      console.error("Error updating plan:", err);
      return { success: false, error: err.message };
    }
  };

  const deletePlan = async (id) => {
    try {
      const { error } = await client
        .from('plans')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      await fetchPlans();
      return { success: true };
    } catch (err) {
      console.error("Error deleting plan:", err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return {
    plans,
    loading,
    error,
    refetch: fetchPlans,
    createPlan,
    updatePlan,
    deletePlan
  };
}