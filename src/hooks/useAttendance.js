import { useState, useEffect } from "react";
import client from "../api/client";

export function useAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Función para verificar si la tabla existe
  const checkTableExists = async () => {
    try {
      const { data, error } = await client
        .from("attendance")
        .select("id")
        .limit(1);
      return !error;
    } catch (err) {
      return false;
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      // Verificar si la tabla de attendance existe
      const { data: tableCheck, error: tableError } = await client
        .from("attendance")
        .select("id")
        .limit(1);

      if (tableError && tableError.code === "PGRST116") {
        setError("⚠️ La tabla de asistencias no está configurada.");
        setAttendance([]);
        setLoading(false);
        return;
      }

      // Obtener asistencias con datos de cliente
      const { data, error } = await client
        .from("attendance")
        .select(
          `
          *,
          clients (
            id,
            first_name,
            last_name,
            cedula,
            next_payment_date,
            plans (
              name
            )
          )
        `
        )
        .order("date", { ascending: false });

      if (error) {
        throw error;
      }

      // Validar que data existe y es un array
      const attendanceData = Array.isArray(data) ? data : [];
      setAttendance(attendanceData);
    } catch (err) {
      console.error("Error fetching attendance:", err);
      setError(
        "Error al cargar asistencias: " + (err.message || "Error de conexión")
      );
    } finally {
      setLoading(false);
    }
  };

  const registerAttendance = async (attendanceData) => {
    try {
      // Verificar si la tabla existe antes de insertar
      const { data: tableCheck, error: tableError } = await client
        .from("attendance")
        .select("id")
        .limit(1);

      if (tableError && tableError.code === "PGRST116") {
        return {
          success: false,
          error: "⚠️ La tabla de asistencias no está configurada.",
        };
      }

      // Insertar registro real en la base de datos
      const { data, error } = await client
        .from("attendance")
        .insert([attendanceData]).select(`
          *,
          clients (
            id,
            first_name,
            last_name,
            cedula,
            next_payment_date,
            plans (
              name
            )
          )
        `);

      if (error) {
        throw error;
      }

      // Actualizar el estado local
      setAttendance((prev) => [data[0], ...prev]);

      return { success: true, data: data[0] };
    } catch (err) {
      console.error("Error registering attendance:", err);

      let errorMessage = err.message || "Error al registrar asistencia";

      if (err.code === "PGRST116") {
        errorMessage = "⚠️ La tabla de asistencias no está configurada.";
      } else if (err.code === "23505") {
        errorMessage =
          "❌ Error: Ya existe un registro para este cliente y fecha.";
      }

      return { success: false, error: errorMessage };
    }
  };

  const updateAttendance = async (id, attendanceData) => {
    try {
      const { data, error } = await client
        .from("attendance")
        .update(attendanceData)
        .eq("id", id)
        .select();

      if (error) {
        throw error;
      }

      await fetchAttendance();
      return { success: true, data: data[0] };
    } catch (err) {
      console.error("Error updating attendance:", err);

      let errorMessage = err.message || "Error al actualizar asistencia";

      if (err.code === "PGRST116") {
        errorMessage = "La tabla de asistencias no existe.";
      }

      return { success: false, error: errorMessage };
    }
  };

  const deleteAttendance = async (id) => {
    try {
      const { error } = await client.from("attendance").delete().eq("id", id);

      if (error) {
        throw error;
      }

      await fetchAttendance();
      return { success: true };
    } catch (err) {
      console.error("Error deleting attendance:", err);

      let errorMessage = err.message || "Error al eliminar asistencia";

      if (err.code === "PGRST116") {
        errorMessage = "La tabla de asistencias no existe.";
      }

      return { success: false, error: errorMessage };
    }
  };

  const getAttendanceByClientId = async (clientId) => {
    try {
      const { data, error } = await client
        .from("attendance")
        .select("*")
        .eq("client_id", clientId)
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching attendance by client:", err);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error("Error fetching attendance by client:", err);
      return [];
    }
  };

  const checkClientStatus = async (cedula) => {
    try {
      // Buscar cliente real por cédula
      const { data: clientData, error: clientError } = await client
        .from("clients")
        .select(
          `
          *,
          plans (
            name,
            price
          )
        `
        )
        .eq("cedula", cedula)
        .single();

      // Si no hay tabla de clientes, devolver mensaje informativo
      if (clientError && clientError.code === "PGRST116") {
        return {
          found: false,
          message: "⚠️ La tabla de clientes no está configurada.",
        };
      }

      if (clientError && clientError.code !== "PGRST116") {
        throw clientError;
      }

      if (!clientData) {
        return {
          found: false,
          message: "❌ Cliente no encontrado con esta cédula",
        };
      }

      // Verificar si el plan está vencido
      const today = new Date();
      const nextPayment = new Date(clientData.next_payment_date);
      const isExpired = nextPayment < today;

      // Contar asistencias del mes actual
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);

      const { data: attendanceData, error: attendanceError } = await client
        .from("attendance")
        .select("*")
        .eq("client_id", clientData.id)
        .gte("date", firstDay.toISOString().split("T")[0])
        .lte("date", lastDay.toISOString().split("T")[0]);

      if (attendanceError && attendanceError.code !== "PGRST116") {
        console.error("Error fetching attendance:", attendanceError);
      }

      const monthAttendance = attendanceData || [];
      const totalPossibleDays = lastDay.getDate();
      const attendancePercentage =
        totalPossibleDays > 0
          ? (monthAttendance.length / totalPossibleDays) * 100
          : 0;

      return {
        found: true,
        client: clientData,
        isExpired,
        attendanceCount: monthAttendance.length,
        totalPossibleDays,
        attendancePercentage,
        canEnter: !isExpired,
        message: isExpired
          ? "❌ Plan vencido. Contacta al administrador."
          : `✅ Acceso permitido. Asistencias este mes: ${monthAttendance.length}/${totalPossibleDays}`,
      };
    } catch (err) {
      console.error("Error checking client status:", err);
      return {
        found: false,
        message:
          "Error al verificar el cliente: " +
          (err.message || "Error de conexión"),
      };
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  return {
    attendance,
    loading,
    error,
    refetch: fetchAttendance,
    registerAttendance,
    updateAttendance,
    deleteAttendance,
    getAttendanceByClientId,
    checkClientStatus,
  };
}
