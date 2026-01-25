import { useState, useEffect, useCallback, useMemo } from "react";
import client from "../api/client";

/**
 * Hook para obtener clientes con paginación del lado del servidor
 * 
 * @param {Object} options - Opciones de paginación y filtros
 * @param {number} options.page - Página actual (1-based)
 * @param {number} options.pageSize - Elementos por página
 * @param {string} options.searchTerm - Término de búsqueda
 * @param {string} options.planFilter - Filtrar por plan ID
 * @param {string} options.statusFilter - Filtrar por estado de pago (all, active, expiring, expired)
 * @param {string} options.sortBy - Campo para ordenar
 * @param {boolean} options.sortAsc - Orden ascendente
 * @returns {Object} - Datos, funciones y estado
 */
export function useClientsPaginated({
  page = 1,
  pageSize = 10,
  searchTerm = "",
  planFilter = "",
  statusFilter = "all",
  sortBy = "created_at",
  sortAsc = false,
} = {}) {
  const [clients, setClients] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Funciones de cálculo
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
    today.setHours(0, 0, 0, 0);

    let paymentDate;
    if (typeof nextPaymentDate === "string") {
      const parts = nextPaymentDate.split("-");
      paymentDate = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
      );
    } else {
      paymentDate = new Date(nextPaymentDate);
    }
    paymentDate.setHours(0, 0, 0, 0);

    const diffTime = paymentDate - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }, []);

  const getPaymentStatusColor = useCallback((daysLeft) => {
    if (daysLeft === null) return "bg-gray-100 text-gray-800";
    if (daysLeft < 0) return "bg-red-100 text-red-800";
    if (daysLeft <= 7) return "bg-orange-100 text-orange-800";
    if (daysLeft <= 15) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Calcular rango para paginación
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Construir query base con count
      let query = client
        .from("clients")
        .select(
          `
          *,
          plans (
            id,
            name
          )
        `,
          { count: "exact" }
        );

      // Aplicar filtros del lado del servidor
      if (searchTerm) {
        // Buscar en múltiples campos
        query = query.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,cedula.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
        );
      }

      if (planFilter) {
        query = query.eq("plan_id", planFilter);
      }

      // Filtro de estado de pago
      if (statusFilter && statusFilter !== "all") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];
        
        const in7Days = new Date(today);
        in7Days.setDate(in7Days.getDate() + 7);
        const in7DaysStr = in7Days.toISOString().split("T")[0];

        if (statusFilter === "expired") {
          query = query.lt("next_payment_date", todayStr);
        } else if (statusFilter === "expiring") {
          query = query.gte("next_payment_date", todayStr).lte("next_payment_date", in7DaysStr);
        } else if (statusFilter === "active") {
          query = query.gt("next_payment_date", in7DaysStr);
        }
      }

      // Aplicar ordenamiento
      query = query.order(sortBy, { ascending: sortAsc });

      // Aplicar paginación
      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) {
        throw queryError;
      }

      // Enriquecer datos con cálculos
      const enrichedClients = (data || []).map((clientData) => ({
        ...clientData,
        age: calculateAge(clientData.birth_date),
        daysUntilPayment: calculateDaysUntilPayment(clientData.next_payment_date),
        paymentStatusColor: getPaymentStatusColor(
          calculateDaysUntilPayment(clientData.next_payment_date)
        ),
      }));

      setClients(enrichedClients);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError(err.message || "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    searchTerm,
    planFilter,
    statusFilter,
    sortBy,
    sortAsc,
    calculateAge,
    calculateDaysUntilPayment,
    getPaymentStatusColor,
  ]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Estadísticas calculadas
  const stats = useMemo(() => ({
    totalPages: Math.ceil(totalCount / pageSize) || 1,
    hasNextPage: page < Math.ceil(totalCount / pageSize),
    hasPrevPage: page > 1,
    startItem: totalCount === 0 ? 0 : (page - 1) * pageSize + 1,
    endItem: Math.min(page * pageSize, totalCount),
  }), [totalCount, pageSize, page]);

  return {
    // Datos
    clients,
    totalCount,
    loading,
    error,
    
    // Estadísticas de paginación
    ...stats,
    
    // Funciones
    refetch: fetchClients,
    calculateAge,
    calculateDaysUntilPayment,
    getPaymentStatusColor,
  };
}

export default useClientsPaginated;
