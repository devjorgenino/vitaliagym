import { useState, useEffect } from 'react';
import client from '../api/client';
import { fetchWithOffline } from '../lib/offline-read';
import { executeWithSync } from '../lib/data-sync';
import { 
  recalculateNextPaymentDate,
  recalculateAllNextPaymentDates as recalculateAllDates
} from '../utils/paymentCalculations';

export function usePayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await fetchWithOffline('payments-list', () => client
        .from('payments')
        .select(`
          *,
          clients (
            id,
            first_name,
            last_name,
            cedula
          ),
          plans (
            id,
            name,
            price
          )
        `)
        .order('created_at', { ascending: false }));

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          setError('La tabla "payments" no existe. Ejecuta el script SQL en /database');
        } else {
          setError(`Error: ${error.message}`);
        }
        setPayments([]);
      } else {
        setPayments(data || []);
      }
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError('Error de conexión. Verifica tu configuración.');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const createPayment = async (paymentData) => {
    try {
      const { data, error } = await executeWithSync({
        table: 'payments',
        type: 'INSERT',
        data: paymentData
      });

      if (error) {
        throw error;
      }
      
      // Actualizar la fecha del próximo pago del cliente basándose en ciclos pagados
      if (paymentData.client_id && paymentData.plan_id) {
        await recalculateNextPaymentDate({ 
          clientId: paymentData.client_id, 
          planId: paymentData.plan_id 
        });
      }
      
      // Refetch para obtener los datos completos con joins (clients, plans)
      // El optimistic update con data[0] no incluye la información de relaciones
      await fetchPayments();

      // Note: Data sync returns the raw inserted data, but our UI usually expects joined data.
      // fetchPayments refreshes the list with joins, so returning basic data is usually fine,
      // or we can just return success: true.
      return { success: true, data: data ? data[0] : null };
    } catch (err) {
      console.error("Error creating payment:", err);
      return { success: false, error: err.message };
    }
  };

  const updatePayment = async (id, paymentData) => {
    try {
      const { data, error } = await executeWithSync({
        table: 'payments',
        type: 'UPDATE',
        data: paymentData,
        match: { id }
      });

      if (error) {
        throw error;
      }
      
      // Actualizar la fecha del próximo pago del cliente basándose en ciclos pagados
      if (paymentData.client_id && paymentData.plan_id) {
        await recalculateNextPaymentDate({ 
          clientId: paymentData.client_id, 
          planId: paymentData.plan_id 
        });
      }
      
      // Refetch para obtener los datos completos con joins (clients, plans)
      await fetchPayments();

      return { success: true, data: data ? data[0] : null };
    } catch (err) {
      console.error("Error updating payment:", err);
      return { success: false, error: err.message };
    }
  };

  const deletePayment = async (id) => {
    try {
      const { error } = await executeWithSync({
        table: 'payments',
        type: 'DELETE',
        match: { id }
      });

      if (error) {
        throw error;
      }
      
      // Optimistic update
      setPayments(prev => prev.filter(p => p.id !== id));

      return { success: true };
    } catch (err) {
      console.error("Error deleting payment:", err);
      return { success: false, error: err.message };
    }
  };

  const searchPaymentsByClient = async (searchTerm) => {
    if (!searchTerm) {
      return payments;
    }
  
    try {
      setLoading(true);
      setError(null);
  
      const { data, error } = await fetchWithOffline(`payments-search-${searchTerm}`, () => client.rpc('search_payments_by_client', {
        search_term: searchTerm,
      }));
  
      if (error) {
        throw error;
      }
  
      return data || [];
    } catch (err) {
      console.error("Error searching payments:", err);
      setError(`Error de búsqueda: ${err.message}`);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Nueva función unificada para búsqueda con filtros
  const searchPaymentsWithFilters = async (filters = {}) => {
    const filterKey = JSON.stringify(filters);

    try {
      setSearchLoading(true);
      setError(null);

      const { data, error } = await fetchWithOffline(`payments-filter-${filterKey}`, () => client.rpc('search_payments_with_filters', {
        search_term: filters.searchTerm || null,
        filter_plan_id: filters.plan_id || null,
        filter_payment_type: filters.payment_type || null,
        filter_bank: filters.bank || null,
        filter_date_from: filters.date_from || null,
        filter_date_to: filters.date_to || null,
      }));

      if (error) {
        throw error;
      }

      return data || [];
    } catch (err) {
      console.error("Error searching payments with filters:", err);
      setError(`Error de búsqueda: ${err.message}`);
      return [];
    } finally {
      setSearchLoading(false);
    }
  };
  

  const applyFilters = async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);
      const filterKey = JSON.stringify(filters);

      const { data, error } = await fetchWithOffline(`payments-apply-filters-${filterKey}`, async () => {
          let query = client
            .from('payments')
            .select(`
              *,
              clients (
                id,
                first_name,
                last_name,
                cedula
              ),
              plans (
                id,
                name,
                price
              )
            `);
    
          if (filters.plan_id) {
            query = query.eq('plan_id', filters.plan_id);
          }
    
          if (filters.payment_type) {
            query = query.eq('payment_type', filters.payment_type);
          }
    
          if (filters.bank) {
            query = query.eq('bank', filters.bank);
          }
    
          if (filters.date_from) {
            query = query.gte('payment_date', filters.date_from);
          }
    
          if (filters.date_to) {
            query = query.lte('payment_date', filters.date_to);
          }
          
          return query.order('created_at', { ascending: false });
      });

      if (error) {
        throw error;
      }
      
      return data || [];

    } catch (err) {
      console.error("Error fetching filtered payments:", err);
      setError(`Error al filtrar pagos: ${err.message}`);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Recalcula las fechas de próximo pago de todos los clientes.
   * Usa la función centralizada de paymentCalculations.
   */
  const recalculateAllNextPaymentDates = async () => {
    return await recalculateAllDates();
  };

  useEffect(() => {
    fetchPayments();
    
    // Auto-update when online
    const handleOnline = () => fetchPayments();
    window.addEventListener('online', handleOnline);

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return {
    payments,
    loading,
    searchLoading,
    error,
    refetch: fetchPayments,
    createPayment,
    updatePayment,
    deletePayment,
    applyFilters,
    searchPaymentsByClient,
    searchPaymentsWithFilters,
    recalculateAllNextPaymentDates,
  };
}