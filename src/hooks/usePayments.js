import { useState, useEffect } from 'react';
import client from '../api/client';
import { fetchWithOffline } from '../lib/offline-read';
import { executeWithSync } from '../lib/data-sync';

/**
 * Calcula la fecha del próximo pago sumando N meses a la fecha de ingreso.
 * Si el día no existe en el mes destino (ej: 31 de enero → febrero), 
 * se usa el último día de ese mes.
 * 
 * @param {string} joinDate - Fecha de ingreso del cliente (formato YYYY-MM-DD)
 * @param {number} monthsToAdd - Número de meses a sumar
 * @returns {string} - Fecha del próximo pago (formato YYYY-MM-DD)
 */
function calculateNextPaymentDateWithCycles(joinDate, monthsToAdd) {
  if (!joinDate || monthsToAdd < 1) return null;

  // Parsear la fecha correctamente evitando problemas de zona horaria
  let year, month, day;
  
  if (typeof joinDate === 'string') {
    const parts = joinDate.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // Los meses en JS son 0-indexados
    day = parseInt(parts[2], 10);
  } else {
    year = joinDate.getFullYear();
    month = joinDate.getMonth();
    day = joinDate.getDate();
  }

  const originalDay = day;

  // Calcular el mes y año destino
  let targetMonth = month + monthsToAdd;
  let targetYear = year;

  while (targetMonth > 11) {
    targetMonth -= 12;
    targetYear += 1;
  }

  // Obtener el último día del mes destino
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  // Usar el día original o el último día del mes si el original no existe
  const finalDay = Math.min(originalDay, lastDayOfTargetMonth);

  // Formatear la fecha como YYYY-MM-DD
  const formattedYear = targetYear;
  const formattedMonth = String(targetMonth + 1).padStart(2, '0');
  const formattedDay = String(finalDay).padStart(2, '0');

  return `${formattedYear}-${formattedMonth}-${formattedDay}`;
}

/**
 * Calcula la fecha del próximo pago basándose en la fecha de pago actual del cliente.
 * La lógica es: toma el día de la fecha de pago actual y lo mueve al siguiente mes.
 * Si el día no existe en el mes siguiente (ej: 31 de enero → febrero), 
 * se usa el último día de ese mes.
 * 
 * @param {string} currentPaymentDate - Fecha de pago actual del cliente (formato YYYY-MM-DD)
 * @returns {string} - Nueva fecha del próximo pago (formato YYYY-MM-DD)
 */
function calculateNextPaymentDateFromCurrent(currentPaymentDate) {
  return calculateNextPaymentDateWithCycles(currentPaymentDate, 1);
}

/**
 * Recalcula la fecha del próximo pago de un cliente específico basándose en sus pagos.
 * @param {string} clientId - ID del cliente
 * @param {string} planId - ID del plan del cliente
 */
async function recalculateClientNextPaymentDate(clientId, planId) {
  try {
    // Obtener datos del cliente
    const { data: clientData, error: clientError } = await client
      .from('clients')
      .select(`
        id,
        join_date,
        plan_id,
        plans (
          id,
          price
        )
      `)
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      console.error('Error fetching client for recalculation:', clientError);
      return { success: false, error: clientError };
    }

    // Obtener todos los pagos del cliente para su plan
    const { data: clientPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, amount_usd')
      .eq('client_id', clientId)
      .eq('plan_id', clientData.plan_id);

    if (paymentsError) {
      console.error('Error fetching payments for recalculation:', paymentsError);
      return { success: false, error: paymentsError };
    }

    // Calcular el total pagado
    const totalPaid = (clientPayments || []).reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0
    );

    // Obtener el precio del plan
    const planPrice = clientData.plans ? parseFloat(clientData.plans.price) || 0 : 0;

    // Calcular cuántos ciclos completos ha pagado
    let cyclesPaid = 0;
    if (planPrice > 0 && totalPaid > 0) {
      cyclesPaid = Math.floor(totalPaid / planPrice);
    }

    // Calcular la fecha del próximo pago = fecha_ingreso + (ciclos_pagados + 1) meses
    const newNextPaymentDate = calculateNextPaymentDateWithCycles(clientData.join_date, cyclesPaid + 1);

    if (newNextPaymentDate) {
      const { error } = await client
        .from('clients')
        .update({ next_payment_date: newNextPaymentDate })
        .eq('id', clientId);

      if (error) {
        console.error('Error updating client next_payment_date:', error);
        return { success: false, error };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Error recalculating client next_payment_date:', err);
    return { success: false, error: err };
  }
}

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
        .order('payment_date', { ascending: false }));

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
        await recalculateClientNextPaymentDate(paymentData.client_id, paymentData.plan_id);
      }
      
      // Optimistic update
      if (data && data[0]) {
          // data[0] is the raw inserted row. We might be missing joined data.
          // We can try to guess/mock or just accept partial display.
          setPayments(prev => [data[0], ...prev]);
      } else {
        await fetchPayments();
      }

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
        await recalculateClientNextPaymentDate(paymentData.client_id, paymentData.plan_id);
      }
      
      // Optimistic update
      if (data && data[0]) {
           setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data[0] } : p));
      } else {
           await fetchPayments();
      }

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
          
          return query.order('payment_date', { ascending: false });
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
   * Recalcula las fechas de próximo pago de todos los clientes basándose en sus pagos.
   * La lógica es:
   * 1. Para cada cliente, calcula cuántos ciclos completos ha pagado (total_pagado / precio_plan)
   * 2. La fecha del próximo pago = fecha_ingreso + (ciclos_pagados + 1) meses
   * 3. Si no tiene pagos, la fecha del próximo pago = fecha_ingreso + 1 mes
   * 
   * @returns {Promise<{success: boolean, updated: number, errors: string[]}>}
   */
  const recalculateAllNextPaymentDates = async () => {
    try {
      // Obtener todos los clientes con su fecha de ingreso, próximo pago y plan
      const { data: allClients, error: clientsError } = await client
        .from('clients')
        .select(`
          id, 
          join_date, 
          next_payment_date,
          plan_id,
          plans (
            id,
            price
          )
        `);

      if (clientsError) throw clientsError;
      if (!allClients || allClients.length === 0) {
        return { success: true, updated: 0, total: 0, errors: [] };
      }

      // Obtener todos los pagos con el monto
      const { data: allPayments, error: paymentsError } = await client
        .from('payments')
        .select('id, client_id, plan_id, amount_usd, payment_date');

      if (paymentsError) throw paymentsError;

      const updates = [];
      const errors = [];

      for (const c of allClients) {
        if (!c.join_date) continue;

        try {
          // Obtener los pagos de este cliente para su plan actual
          const clientPayments = (allPayments || []).filter(
            p => p.client_id === c.id && p.plan_id === c.plan_id
          );
          
          // Calcular el total pagado
          const totalPaid = clientPayments.reduce(
            (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
            0
          );
          
          // Obtener el precio del plan
          const planPrice = c.plans ? parseFloat(c.plans.price) || 0 : 0;
          
          // Calcular cuántos ciclos completos ha pagado
          let cyclesPaid = 0;
          if (planPrice > 0 && totalPaid > 0) {
            cyclesPaid = Math.floor(totalPaid / planPrice);
          }
          
          // Calcular la fecha del próximo pago
          // = fecha_ingreso + (ciclos_pagados + 1) meses
          const newNextPaymentDate = calculateNextPaymentDateWithCycles(c.join_date, cyclesPaid + 1);

          if (newNextPaymentDate && c.next_payment_date !== newNextPaymentDate) {
            updates.push({
              id: c.id,
              next_payment_date: newNextPaymentDate
            });
          }
        } catch (err) {
          errors.push(`Cliente ${c.id}: ${err.message}`);
        }
      }

      if (updates.length > 0) {
        // Actualizar en lotes
        const batchSize = 50;
        let updatedCount = 0;

        for (let i = 0; i < updates.length; i += batchSize) {
          const chunk = updates.slice(i, i + batchSize);
          await Promise.all(chunk.map(async (u) => {
            const { error } = await client
              .from('clients')
              .update({ next_payment_date: u.next_payment_date })
              .eq('id', u.id);

            if (error) errors.push(`Error updating ${u.id}: ${error.message}`);
            else updatedCount++;
          }));
        }

        return { success: errors.length === 0, updated: updatedCount, total: allClients.length, errors };
      }

      return { success: true, updated: 0, total: allClients.length, errors: [] };

    } catch (err) {
      console.error('Error recalculating payment dates:', err);
      return { success: false, updated: 0, errors: [err.message] };
    }
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