import { useState, useEffect } from 'react';
import client from '../api/client';
import { fetchWithOffline } from '../lib/offline-read';
import { executeWithSync } from '../lib/data-sync';

export function usePlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await fetchWithOffline('plans-list', () => client
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false }));

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
      const { data, error } = await executeWithSync({
        table: 'plans',
        type: 'INSERT',
        data: planData
      });

      if (error) {
        throw error;
      }
      
      // Optimistic update
      if (data && data[0]) {
          setPlans(prev => [data[0], ...prev]);
      } else {
          await fetchPlans();
      }
      
      return { success: true, data: data ? data[0] : null };
    } catch (err) {
      console.error("Error creating plan:", err);
      return { success: false, error: err.message };
    }
  };

  const updatePlan = async (id, planData) => {
    try {
      const { data, error } = await executeWithSync({
        table: 'plans',
        type: 'UPDATE',
        data: planData,
        match: { id }
      });

      if (error) {
        throw error;
      }

      // Optimistic update
      if (data && data[0]) {
          setPlans(prev => prev.map(p => p.id === id ? { ...p, ...data[0] } : p));
      } else {
          await fetchPlans();
      }

      return { success: true, data: data ? data[0] : null };
    } catch (err) {
      console.error("Error updating plan:", err);
      return { success: false, error: err.message };
    }
  };

  const deletePlan = async (id) => {
    try {
      const { error } = await executeWithSync({
        table: 'plans',
        type: 'DELETE',
        match: { id }
      });

      if (error) {
        throw error;
      }

      // Optimistic update
      setPlans(prev => prev.filter(p => p.id !== id));
      
      return { success: true };
    } catch (err) {
      console.error("Error deleting plan:", err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchPlans();
    
    // Auto-update when online
    const handleOnline = () => fetchPlans();
    window.addEventListener('online', handleOnline);

    return () => window.removeEventListener('online', handleOnline);
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