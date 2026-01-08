import { useState, useEffect } from 'react';
import client from '../api/client';

export function usePayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await client
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
        .order('payment_date', { ascending: false });

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
      const { data, error } = await client
        .from('payments')
        .insert([paymentData])
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

      if (error) {
        throw error;
      }

      await fetchPayments();
      return { success: true, data: data[0] };
    } catch (err) {
      console.error("Error creating payment:", err);
      return { success: false, error: err.message };
    }
  };

  const updatePayment = async (id, paymentData) => {
    try {
      const { data, error } = await client
        .from('payments')
        .update(paymentData)
        .eq('id', id)
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

      if (error) {
        throw error;
      }

      await fetchPayments();
      return { success: true, data: data[0] };
    } catch (err) {
      console.error("Error updating payment:", err);
      return { success: false, error: err.message };
    }
  };

  const deletePayment = async (id) => {
    try {
      const { error } = await client
        .from('payments')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      await fetchPayments();
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
  
      const { data, error } = await client.rpc('search_payments_by_client', {
        search_term: searchTerm,
      });
  
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
    const {
      searchTerm,
      plan_id,
      payment_type,
      bank,
      date_from,
      date_to,
    } = filters;

    try {
      setSearchLoading(true);
      setError(null);

      const { data, error } = await client.rpc('search_payments_with_filters', {
        search_term: searchTerm || null,
        filter_plan_id: plan_id || null,
        filter_payment_type: payment_type || null,
        filter_bank: bank || null,
        filter_date_from: date_from || null,
        filter_date_to: date_to || null,
      });

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

      const { data, error } = await query.order('payment_date', { ascending: false });

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

  useEffect(() => {
    fetchPayments();
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
  };
}