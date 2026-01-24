import { useState, useEffect } from "react";
import client from "../api/client";
import { fetchWithOffline } from "../lib/offline-read";
import { executeWithSync } from "../lib/data-sync";

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

      // Verificar si la tabla de attendance existe (offline-safe check not really needed here if we trust the loop, but keeping it)
      // We skip the check for offline fetch since we assume it exists or cached data exists
      
      // Obtener asistencias con datos de cliente
      const { data, error } = await fetchWithOffline("attendance-list", () => client
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
        .order("date", { ascending: false }));

      if (error) {
        if (error.code === "PGRST116" || (error.message && error.message.includes("relation") && error.message.includes("does not exist"))) {
           setError("⚠️ La tabla de asistencias no está configurada.");
           setAttendance([]);
           return;
        }
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
      // Insertar registro real en la base de datos
      const { data, error } = await executeWithSync({
        table: 'attendance',
        type: 'INSERT',
        data: attendanceData
      });

      if (error) {
          if (error.code === "PGRST116") {
            return {
              success: false,
              error: "⚠️ La tabla de asistencias no está configurada.",
            };
          }
        throw error;
      }
      
      // Optimistic update
      if (data && data[0]) {
          // data[0] is raw row. UI needs joins but for list it's usually date/status.
          // Note: If we use it, we might break filters expecting 'clients' object.
          // Safest is to refetch if online, or only update if we can mock joined data.
          // For now, let's try to add it.
          setAttendance(prev => [data[0], ...prev]);
      } else {
          await fetchAttendance();
      }

      return { success: true, data: data ? data[0] : null };
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
      const { data, error } = await executeWithSync({
        table: 'attendance',
        type: 'UPDATE',
        data: attendanceData,
        match: { id }
      });

      if (error) {
        throw error;
      }
      
      if (data && data[0]) {
          setAttendance(prev => prev.map(a => a.id === id ? { ...a, ...data[0] } : a));
      } else {
          await fetchAttendance();
      }

      return { success: true, data: data ? data[0] : null };
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
      const { error } = await executeWithSync({
        table: 'attendance',
        type: 'DELETE',
        match: { id }
      });

      if (error) {
        throw error;
      }
      
      setAttendance(prev => prev.filter(a => a.id !== id));

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
      const { data, error } = await fetchWithOffline(`attendance-client-${clientId}`, () => client
        .from("attendance")
        .select("*")
        .eq("client_id", clientId)
        .order("date", { ascending: false }));

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

  const checkClientStatus = async (searchTerm) => {
    try {
      // Use offline fetch with a dynamic key for the search term
      // Note: This logic is complex with fallbacks (search by ID then Name).
      // Ideally we wrap the whole logic in a single cached function, but fetchWithOffline expects a promise returning {data, error}.
      
      const result = await fetchWithOffline(`check-status-${searchTerm}`, async () => {
          // Primero intentar buscar por cédula exacta
          let { data: clientData, error: clientError } = await client
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
            .eq("cedula", searchTerm)
            .single();
    
          // Si no se encuentra por cédula, buscar por nombre
          if (clientError && clientError.code === 'PGRST116') {
            const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
            let query = client
              .from("clients")
              .select(
                `
                *,
                plans (
                  name,
                  price
                )
              `
              );
    
            if (searchWords.length >= 2) {
              const [firstWord, secondWord] = searchWords;
              query = query.or(`first_name.ilike.%${firstWord}%,last_name.ilike.%${firstWord}%,first_name.ilike.%${secondWord}%,last_name.ilike.%${secondWord}%`);
            } else {
              const searchWord = searchWords[0];
              query = query.or(`first_name.ilike.%${searchWord}%,last_name.ilike.%${searchWord}%`);
            }
    
            const result = await query.limit(5);
            
            if (result.data && result.data.length > 0) {
              clientData = result.data[0];
              clientError = null;
            }
          }
          
          return { data: clientData, error: clientError };
      });
      
      let clientData = result.data;
      let clientError = result.error;

      // Si no hay tabla de clientes, devolver mensaje informativo
      if (clientError && clientError.code === "PGRST116") {
        return {
          found: false,
          message: "⚠️ La tabla de clientes no está configurada.",
        };
      }

      if (clientError && clientError.code !== "PGRST116") {
        // If simply not found (and handled above), we treat as not found.
        // But if error persists (e.g. connection error that wasn't caught by offline wrapper?), throw.
        // Actually fetchWithOffline returns error if both online failed and no cache.
        throw clientError;
      }

      if (!clientData) {
        return {
          found: false,
          message: "❌ Cliente no encontrado con este término de búsqueda",
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

      // Also cache this attendance check
      const { data: attendanceData, error: attendanceError } = await fetchWithOffline(`attendance-check-${clientData.id}-${currentMonth}`, () => client
        .from("attendance")
        .select("*")
        .eq("client_id", clientData.id)
        .gte("date", firstDay.toISOString().split("T")[0])
        .lte("date", lastDay.toISOString().split("T")[0]));

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
      // Nice handling for offline fallback empty state
      if (err.message && err.message.includes('Sin conexión')) {
           return {
              found: false,
              message: "⚠️ Sin conexión y sin datos locales para este cliente.",
            };
      }
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
    
    // Auto-update when online
    const handleOnline = () => fetchAttendance();
    window.addEventListener('online', handleOnline);

    return () => window.removeEventListener('online', handleOnline);
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
