import { useState, useEffect, useCallback, useMemo } from "react";
import client from "../api/client";

export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const calculateAge = useCallback((birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  }, []);

  const calculateDaysUntilPayment = useCallback((nextPaymentDate) => {
    if (!nextPaymentDate) return null;

    const today = new Date();
    const paymentDate = new Date(nextPaymentDate);
    const diffTime = paymentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }, []);

  const getPaymentStatusColor = useCallback((daysLeft) => {
    if (daysLeft === null) return "bg-gray-100 text-gray-800";
    if (daysLeft < 0) return "bg-red-100 text-red-800"; // Vencido
    if (daysLeft <= 7) return "bg-orange-100 text-orange-800"; // Por vencer
    if (daysLeft <= 15) return "bg-yellow-100 text-yellow-800"; // Próximo a vencer
    return "bg-green-100 text-green-800"; // Vigente
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await client
        .from("clients")
        .select(
          `
          *,
          plans (
            id,
            name
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        if (
          error.message.includes("relation") &&
          error.message.includes("does not exist")
        ) {
          setError('La tabla "clients" no existe.');
        } else {
          setError(`Error: ${error.message}`);
        }
        return;
      }

      // Enriquecer datos con cálculos
      const enrichedClients = (data || []).map((client) => ({
        ...client,
        age: calculateAge(client.birth_date),
        daysUntilPayment: calculateDaysUntilPayment(client.next_payment_date),
        paymentStatusColor: getPaymentStatusColor(
          calculateDaysUntilPayment(client.next_payment_date)
        ),
      }));

      setClients(enrichedClients);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Error de conexión. Verifica tu configuración.");
    } finally {
      setLoading(false);
    }
  }, [calculateAge, calculateDaysUntilPayment, getPaymentStatusColor]);

  const createClient = async (clientData) => {
    try {
      // Calcular próxima fecha de pago (misma fecha del próximo mes)
      const joinDate = new Date(clientData.join_date);
      const nextPaymentDate = new Date(
        joinDate.getFullYear(),
        joinDate.getMonth() + 1,
        joinDate.getDate()
      );

      const { data, error } = await client.from("clients").insert([
        {
          ...clientData,
          next_payment_date: nextPaymentDate.toISOString().split("T")[0],
        },
      ]).select(`
          *,
          plans (
            id,
            name
          )
        `);

      if (error) {
        throw error;
      }

      await fetchClients();
      return { success: true, data: data[0] };
    } catch (err) {
      console.error("Error creating client:", err);
      return { success: false, error: err.message };
    }
  };

  const updateClient = async (id, clientData) => {
    try {
      // Si se actualiza la fecha de ingreso, recalcular la próxima fecha de pago
      let updatedData = { ...clientData };
      if (clientData.join_date) {
        const joinDate = new Date(clientData.join_date);
        const nextPaymentDate = new Date(
          joinDate.getFullYear(),
          joinDate.getMonth() + 1,
          joinDate.getDate()
        );
        updatedData.next_payment_date = nextPaymentDate
          .toISOString()
          .split("T")[0];
      }

      const { data, error } = await client
        .from("clients")
        .update(updatedData)
        .eq("id", id).select(`
          *,
          plans (
            id,
            name
          )
        `);

      if (error) {
        throw error;
      }

      await fetchClients();
      return { success: true, data: data[0] };
    } catch (err) {
      console.error("Error updating client:", err);
      alert("Error al actualizar plan: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getClientAttendanceStats = async (clientId) => {
    try {
      // Obtener asistencias del cliente
      const { data: attendanceData } = await client
        .from("attendance")
        .select("*")
        .eq("client_id", clientId)
        .order("date", { ascending: false });

      // Calcular asistencias del mes actual
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);

      const monthAttendance = attendanceData
        ? attendanceData.filter((record) => {
            const recordDate = new Date(record.date);
            return recordDate >= firstDay && recordDate <= lastDay;
          })
        : [];

      // Calcular asistencias restantes del mes
      const daysInMonth = lastDay.getDate();
      const daysPassed = today.getDate();
      const remainingDays = daysInMonth - daysPassed;
      const attendanceCount = monthAttendance ? monthAttendance.length : 0;
      const remainingAttendance = remainingDays - attendanceCount;

      return {
        monthlyAttendance: attendanceCount,
        remainingAttendance: Math.max(0, remainingAttendance),
        attendancePercentage:
          daysInMonth > 0 ? (attendanceCount / daysInMonth) * 100 : 0,
        attendanceList: attendanceData || [],
      };
    } catch (err) {
      console.error("Error fetching client attendance stats:", err);
      return {
        monthlyAttendance: 0,
        remainingAttendance: 0,
        attendancePercentage: 0,
        attendanceList: [],
      };
    }
  };

  const deleteClient = async (id) => {
    try {
      const { error } = await client.from("clients").delete().eq("id", id);

      if (error) {
        throw error;
      }

      await fetchClients();
      return { success: true };
    } catch (err) {
      console.error("Error deleting client:", err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  return {
    clients,
    loading,
    error,
    isUpdating,
    refetch: fetchClients,
    createClient,
    updateClient,
    deleteClient,
    calculateAge,
  };
}
