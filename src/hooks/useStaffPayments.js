"use client";

import { useState, useEffect, useCallback } from "react";
import client from "@/api/client";
import useAuth from "@/hooks/useAuth";

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

      const { data, error: fetchError } = await query;

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
      const { data, error: createError } = await client
        .from("staff_payments")
        .insert([{
          ...paymentData,
          created_by: user?.id,
        }])
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
        .single();

      if (createError) throw createError;
      
      setPayments((prev) => [data, ...prev]);
      return { data, error: null };
    } catch (err) {
      console.error("Error creating payment:", err);
      return { data: null, error: err.message };
    }
  }, [user?.id]);

  // Actualizar pago
  const updatePayment = useCallback(async (id, paymentData) => {
    try {
      const { data, error: updateError } = await client
        .from("staff_payments")
        .update(paymentData)
        .eq("id", id)
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
        .single();

      if (updateError) throw updateError;
      
      setPayments((prev) => prev.map((p) => (p.id === id ? data : p)));
      return { data, error: null };
    } catch (err) {
      console.error("Error updating payment:", err);
      return { data: null, error: err.message };
    }
  }, []);

  // Marcar pago como pagado
  const markAsPaid = useCallback(async (id, reference = "") => {
    try {
      const { data, error: updateError } = await client
        .from("staff_payments")
        .update({
          status: "paid",
          paid_by: user?.id,
          paid_at: new Date().toISOString(),
          payment_reference: reference,
        })
        .eq("id", id)
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
        .single();

      if (updateError) throw updateError;
      
      setPayments((prev) => prev.map((p) => (p.id === id ? data : p)));
      return { data, error: null };
    } catch (err) {
      console.error("Error marking payment as paid:", err);
      return { data: null, error: err.message };
    }
  }, [user?.id]);

  // Cancelar pago
  const cancelPayment = useCallback(async (id) => {
    try {
      const { data, error: updateError } = await client
        .from("staff_payments")
        .update({ status: "cancelled" })
        .eq("id", id)
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
        .single();

      if (updateError) throw updateError;
      
      setPayments((prev) => prev.map((p) => (p.id === id ? data : p)));
      return { data, error: null };
    } catch (err) {
      console.error("Error cancelling payment:", err);
      return { data: null, error: err.message };
    }
  }, []);

  // Eliminar pago
  const deletePayment = useCallback(async (id) => {
    try {
      const { error: deleteError } = await client
        .from("staff_payments")
        .delete()
        .eq("id", id);

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
