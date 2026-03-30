import { useState, useEffect, useCallback, useMemo } from "react";
import client from "../api/client";
import { fetchWithOffline } from "../lib/offline-read";
import { executeWithSync } from "../lib/data-sync";
import { 
  calculateDaysUntilPayment as calcDaysUntilPayment,
  getPaymentStatusColor as getStatusColor,
  recalculateAllNextPaymentDates as recalculateAllDates,
  recalculateNextPaymentDate
} from "../utils/paymentCalculations";

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

  const calculateDaysUntilPayment = useCallback((nextPaymentDate, joinDate) => {
    return calcDaysUntilPayment(nextPaymentDate, joinDate);
  }, []);

  const getPaymentStatusColor = useCallback((daysLeft) => {
    return getStatusColor(daysLeft);
  }, []);

  /**
   * Calcula la fecha del próximo pago basándose en la fecha de ingreso.
   * Si el día de ingreso no existe en el mes siguiente (ej: 31 de enero → febrero),
   * se usa el último día de ese mes.
   * @param {Date|string} joinDate - Fecha de ingreso del cliente
   * @returns {Date} - Fecha del próximo pago
   */
  const calculateNextPaymentDate = useCallback((joinDate) => {
    // Parsear la fecha correctamente evitando problemas de zona horaria
    let year, month, day;

    if (typeof joinDate === "string") {
      // Si es string en formato YYYY-MM-DD, parsear manualmente para evitar desfase de zona horaria
      const parts = joinDate.split("-");
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1; // Los meses en JS son 0-indexados
      day = parseInt(parts[2], 10);
    } else {
      // Si es un objeto Date
      year = joinDate.getFullYear();
      month = joinDate.getMonth();
      day = joinDate.getDate();
    }

    const originalDay = day;

    // Avanzar al próximo mes
    let nextMonth = month + 1;
    let nextYear = year;

    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear = year + 1;
    }

    // Obtener el último día del mes siguiente
    const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();

    // Usar el día original o el último día del mes si el original no existe
    const finalDay = Math.min(originalDay, lastDayOfNextMonth);

    return new Date(nextYear, nextMonth, finalDay);
  }, []);

  /**
   * Formatea una fecha en formato YYYY-MM-DD usando la zona horaria local.
   * Esto evita el problema de toISOString() que convierte a UTC y puede causar
   * un desfase de un día.
   * @param {Date} date - Fecha a formatear
   * @returns {string} - Fecha en formato YYYY-MM-DD
   */
  const formatDateToLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await fetchWithOffline("clients-list", () => client
        .from("clients")
        .select(
          `
          *,
          plans (
            id,
            name
          )
        `,
        )
        .order("created_at", { ascending: false }));

      if (error) {
        if (
          error.message &&
          error.message.includes("relation") &&
          error.message.includes("does not exist")
        ) {
          setError('La tabla "clients" no existe.');
        } else {
          setError(`Error: ${error.message || "Error desconocido"}`);
        }
        return;
      }

      // Enriquecer datos con cálculos
      const enrichedClients = (data || []).map((client) => ({
        ...client,
        age: calculateAge(client.birth_date),
        daysUntilPayment: calculateDaysUntilPayment(client.next_payment_date, client.join_date),
        paymentStatusColor: getPaymentStatusColor(
          calculateDaysUntilPayment(client.next_payment_date, client.join_date),
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
      // Calcular próxima fecha de pago usando la función que maneja meses con diferentes días
      const nextPaymentDate = calculateNextPaymentDate(clientData.join_date);

      const { data, error } = await executeWithSync({
        table: 'clients',
        type: 'INSERT',
        data: {
          ...clientData,
          next_payment_date: formatDateToLocal(nextPaymentDate),
        }
      });

      if (error) {
        throw error;
      }

      await fetchClients();
      return { success: true, data: data ? data[0] : null };
    } catch (err) {
      console.error("Error creating client:", err);
      return { success: false, error: err.message };
    }
  };

  const updateClient = async (id, clientData) => {
    try {
      // Don't override next_payment_date here — let recalculateNextPaymentDate
      // compute it correctly from actual payment history after saving.
      const { data, error } = await executeWithSync({
        table: 'clients',
        type: 'UPDATE',
        data: clientData,
        match: { id }
      });

      if (error) {
        throw error;
      }

      // If join_date changed, recalculate next_payment_date from actual payments
      if (clientData.join_date && clientData.plan_id) {
        await recalculateNextPaymentDate({ clientId: id, planId: clientData.plan_id });
      }

      await fetchClients();
      return { success: true, data: data ? data[0] : null };
    } catch (err) {
      console.error("Error updating client:", err);
      alert("Error al actualizar cliente: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getClientAttendanceStats = async (clientId) => {
    try {
      // Obtener asistencias del cliente
      const { data: attendanceData } = await fetchWithOffline(`attendance-${clientId}`, () => client
        .from("attendance")
        .select("*")
        .eq("client_id", clientId)
        .order("date", { ascending: false }));

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
      const { error } = await executeWithSync({
        table: 'clients',
        type: 'DELETE',
        match: { id }
      });

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

  /**
   * Recalcula las fechas de próximo pago de todos los clientes.
   * Usa la función centralizada de paymentCalculations.
   */
  const recalculateAllNextPaymentDates = async () => {
    const result = await recalculateAllDates();
    if (result.success || result.updated > 0) {
      await fetchClients();
    }
    return result;
  };

  const fixAllPhones = useCallback(async () => {
    setLoading(true);
    let updatedCount = 0;
    let errors = [];

    try {
      const { data: allClients, error: fetchError } = await client
        .from("clients")
        .select("id, phone");

      if (fetchError) throw fetchError;

      for (const cli of allClients) {
        if (!cli.phone) continue;

        // Normalización de teléfono
        let newPhone = cli.phone.trim();

        // Si ya tiene el formato correcto (4 dígitos, guión, 7 dígitos), saltar
        if (/^\d{4}-\d{7}$/.test(newPhone)) continue;

        // Limpiar caracteres no numéricos
        const cleanNums = newPhone.replace(/\D/g, "");

        // Si tiene 11 dígitos y empieza por 0 (ej: 04141234567)
        if (cleanNums.length === 11 && cleanNums.startsWith("0")) {
          newPhone = `${cleanNums.substring(0, 4)}-${cleanNums.substring(4)}`;
        }
        // Si tiene 10 dígitos y no empieza por 0 (ej: 4141234567)
        else if (cleanNums.length === 10) {
          newPhone = `0${cleanNums.substring(0, 3)}-${cleanNums.substring(3)}`;
        } else {
          continue;
        }

        if (newPhone !== cli.phone) {
          const { error: updateError } = await client
            .from("clients")
            .update({ phone: newPhone })
            .eq("id", cli.id);

          if (updateError) {
            errors.push(`Error cliente ${cli.id}: ${updateError.message}`);
          } else {
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0) await fetchClients();

      return {
        success: true,
        updated: updatedCount,
        total: allClients.length,
        errors,
      };
    } catch (err) {
      console.error("Error fixing phones:", err);
      return { success: false, errors: [err.message] };
    } finally {
      setLoading(false);
    }
  }, [fetchClients]);

  useEffect(() => {
    fetchClients();
    
    // Auto-update when online
    const handleOnline = () => fetchClients();
    window.addEventListener('online', handleOnline);

    return () => window.removeEventListener('online', handleOnline);
  }, [fetchClients]);

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
    recalculateAllNextPaymentDates,
    fixAllPhones,
  };
}
