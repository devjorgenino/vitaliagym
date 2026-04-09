"use client";

import { useState, useEffect, useCallback } from "react";
import client from "@/api/client";
import useAuth from "@/hooks/useAuth";
import { fetchWithOffline } from "../lib/offline-read";
import { executeWithSync } from "../lib/data-sync";

/**
 * Hook para gestionar los pagos al personal
 */
export default function useStaffPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar pagos
  const fetchPayments = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);
      const filterKey = JSON.stringify(filters);

      const { data, error: fetchError } = await fetchWithOffline(`staff-payments-list-${filterKey}`, async () => {
          let query = client
            .from("staff_payments")
            .select(`
              *,
              staff:staff_id (
                id,
                first_name,
                last_name,
                position,
                email
              )
            `)
            .order("payment_date", { ascending: false });
    
          // Aplicar filtros
          if (filters.staffId) {
            query = query.eq("staff_id", filters.staffId);
          }
          if (filters.status) {
            query = query.eq("status", filters.status);
          }
          if (filters.startDate) {
            query = query.gte("payment_date", filters.startDate);
          }
          if (filters.endDate) {
            query = query.lte("payment_date", filters.endDate);
          }
          
          return query;
      });

      if (fetchError) throw fetchError;
      setPayments(data || []);
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear pago
  const createPayment = useCallback(async (paymentData) => {
    try {
      const { data, error: createError } = await executeWithSync({
        table: 'staff_payments',
        type: 'INSERT',
        data: {
          ...paymentData,
          created_by: user?.id,
        }
      });

      if (createError) throw createError;
      
      if (data && data[0]) {
          setPayments((prev) => [data[0], ...prev]);
      } else {
          fetchPayments();
      }
      return { data: data ? data[0] : null, error: null };
    } catch (err) {
      console.error("Error creating payment:", err);
      return { data: null, error: err.message };
    }
  }, [user?.id, fetchPayments]);

  // Actualizar pago
  const updatePayment = useCallback(async (id, paymentData) => {
    try {
      const { data, error: updateError } = await executeWithSync({
        table: 'staff_payments',
        type: 'UPDATE',
        data: paymentData,
        match: { id }
      });

      if (updateError) throw updateError;
      
      if (data && data[0]) {
          setPayments((prev) => prev.map((p) => (p.id === id ? data[0] : p)));
      } else {
          fetchPayments();
      }
      return { data: data ? data[0] : null, error: null };
    } catch (err) {
      console.error("Error updating payment:", err);
      return { data: null, error: err.message };
    }
  }, [fetchPayments]);

  // Marcar pago como pagado
  const markAsPaid = useCallback(async (id, reference = "") => {
    try {
      const { data, error: updateError } = await executeWithSync({
        table: 'staff_payments',
        type: 'UPDATE',
        data: {
          status: "paid",
          paid_by: user?.id,
          paid_at: new Date().toISOString(),
          payment_reference: reference,
        },
        match: { id }
      });

      if (updateError) throw updateError;
      
      if (data && data[0]) {
          setPayments((prev) => prev.map((p) => (p.id === id ? data[0] : p)));
      } else {
          fetchPayments();
      }
      return { data: data ? data[0] : null, error: null };
    } catch (err) {
      console.error("Error marking payment as paid:", err);
      return { data: null, error: err.message };
    }
  }, [user?.id, fetchPayments]);

  // Cancelar pago
  const cancelPayment = useCallback(async (id) => {
    try {
      const { data, error: updateError } = await executeWithSync({
         table: 'staff_payments',
         type: 'UPDATE',
         data: { status: "cancelled" },
         match: { id }
      });

      if (updateError) throw updateError;
      
      if (data && data[0]) {
          setPayments((prev) => prev.map((p) => (p.id === id ? data[0] : p)));
      } else {
          fetchPayments();
      }
      return { data: data ? data[0] : null, error: null };
    } catch (err) {
      console.error("Error cancelling payment:", err);
      return { data: null, error: err.message };
    }
  }, [fetchPayments]);

  // Eliminar pago
  const deletePayment = useCallback(async (id) => {
    try {
      const { error: deleteError } = await executeWithSync({
         table: 'staff_payments',
         type: 'DELETE',
         match: { id }
      });

      if (deleteError) throw deleteError;
      
      setPayments((prev) => prev.filter((p) => p.id !== id));
      return { error: null };
    } catch (err) {
      console.error("Error deleting payment:", err);
      return { error: err.message };
    }
  }, []);

  // Obtener estadísticas de pagos
  const getPaymentStats = useCallback((periodStart, periodEnd) => {
    const filteredPayments = payments.filter((p) => {
      if (periodStart && p.payment_date < periodStart) return false;
      if (periodEnd && p.payment_date > periodEnd) return false;
      return true;
    });

    const paidPayments = filteredPayments.filter((p) => p.status === "paid");
    const pendingPayments = filteredPayments.filter((p) => p.status === "pending");

    return {
      total: filteredPayments.length,
      paid: paidPayments.length,
      pending: pendingPayments.length,
      cancelled: filteredPayments.filter((p) => p.status === "cancelled").length,
      totalPaid: paidPayments.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0),
      totalPending: pendingPayments.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0),
    };
  }, [payments]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return {
    payments,
    loading,
    error,
    fetchPayments,
    createPayment,
    updatePayment,
    markAsPaid,
    cancelPayment,
    deletePayment,
    getPaymentStats,
  };
}
