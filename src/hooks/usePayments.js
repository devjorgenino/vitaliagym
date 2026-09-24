import { useState, useEffect } from 'react';
import client from '../api/client';
import { fetchWithOffline } from '../lib/offline-read';
import { executeWithSync } from '../lib/data-sync';
import { 
  recalculateNextPaymentDate,
  recalculateAllNextPaymentDates as recalculateAllDates,
  updateClientStatus
} from '../utils/paymentCalculations';

export function usePayments({ onClientUpdate } = {}) {
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
            cedula,
            enrollment_paid
          ),
          plans (
            id,
            name,
            price,
            currency
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
        await updateClientStatus(paymentData.client_id, paymentData.plan_id);
      }
      
      // Refetch para obtener los datos completos con joins (clients, plans)
      await fetchPayments();

      // Refrescar la lista de clientes para que el status se actualice en la tabla
      if (typeof onClientUpdate === 'function') {
        await onClientUpdate();
      }

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
        await updateClientStatus(paymentData.client_id, paymentData.plan_id);
      }
      
      // Refetch para obtener los datos completos con joins (clients, plans)
      await fetchPayments();

      // Refrescar la lista de clientes para que el status se actualice en la tabla
      if (typeof onClientUpdate === 'function') {
        await onClientUpdate();
      }

      return { success: true, data: data ? data[0] : null };
    } catch (err) {
      console.error("Error updating payment:", err);
      return { success: false, error: err.message };
    }
  };

  const deletePayment = async (id, { clientId, planId } = {}) => {
    try {
      // Prefer the atomic server-side function when online. It performs
      // delete + rollback decision + restore inside ONE Postgres
      // transaction, so a concurrent insert for the same client cannot
      // slip in between the delete and the remaining-payments count and
      // cause a false rollback (race condition).
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      let atomicResult = null;
      if (isOnline) {
        const { data, error: rpcErr } = await client.rpc('delete_payment_atomic', {
          p_payment_id: id,
        });
        if (rpcErr) {
          // Fall back to the legacy client-side path if the function is
          // not yet deployed (e.g. migration not applied).
          console.warn('delete_payment_atomic unavailable, falling back:', rpcErr);
        } else {
          atomicResult = data;
        }
      }

      if (!atomicResult) {
        // 1. Obtener pago antes de borrar
        const { data: paymentToDelete, error: fetchErr } = await client
          .from('payments')
          .select('client_id, plan_id, is_archived')
          .eq('id', id)
          .single();

        if (fetchErr) throw fetchErr;

        const { error } = await executeWithSync({
          table: 'payments',
          type: 'DELETE',
          match: { id }
        });

        if (error) {
          throw error;
        }

        // 2. Verificar si que hacer Rollback del reinicio
        if (paymentToDelete && paymentToDelete.client_id) {
          // ¿Quedan pagos activos?
          const { data: remainingPayments } = await client
            .from('payments')
            .select('id')
            .eq('client_id', paymentToDelete.client_id)
            .eq('is_archived', false);

          const { data: clientData } = await client
            .from('clients')
            .select('original_join_date')
            .eq('id', paymentToDelete.client_id)
            .single();

          if ((!remainingPayments || remainingPayments.length === 0) && clientData && clientData.original_join_date) {
              // ROLLBACK TRIGGERED
              // - Unarchive all payments
              await executeWithSync({
                  table: 'payments',
                  type: 'UPDATE',
                  data: { is_archived: false },
                  match: { client_id: paymentToDelete.client_id, is_archived: true }
              });
              // - Unarchive attendance
              await executeWithSync({
                  table: 'attendance',
                  type: 'UPDATE',
                  data: { is_archived: false },
                  match: { client_id: paymentToDelete.client_id, is_archived: true }
              });
              // - Restore client join_date
              await executeWithSync({
                  table: 'clients',
                  type: 'UPDATE',
                  data: { join_date: clientData.original_join_date, original_join_date: null },
                  match: { id: paymentToDelete.client_id }
              });
          }
        }
      } // end if (!atomicResult) — legacy client-side path

      if (atomicResult && atomicResult.client_id) {
        clientId = clientId || atomicResult.client_id;
        planId = planId || atomicResult.plan_id;
      }

      // Recalculate next_payment_date after removing a payment
      if (clientId && planId) {
        await recalculateNextPaymentDate({ clientId, planId });
        await updateClientStatus(clientId, planId);
      }

      // Refetch to reflect updated state
      await fetchPayments();      await fetchPayments();

      // Refrescar la lista de clientes para que el status se actualice en la tabla
      if (typeof onClientUpdate === 'function') {
        await onClientUpdate();
      }

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