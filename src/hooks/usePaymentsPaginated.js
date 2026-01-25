import { useState, useEffect, useCallback, useMemo } from "react";
import client from "../api/client";

/**
 * Hook para obtener pagos con paginación del lado del servidor
 * 
 * @param {Object} options - Opciones de paginación y filtros
 * @param {number} options.page - Página actual (1-based)
 * @param {number} options.pageSize - Elementos por página
 * @param {string} options.searchTerm - Término de búsqueda (nombre, cédula)
 * @param {string} options.planId - Filtrar por plan ID
 * @param {string} options.paymentType - Filtrar por tipo de pago
 * @param {string} options.bank - Filtrar por banco
 * @param {string} options.dateFrom - Fecha desde (YYYY-MM-DD)
 * @param {string} options.dateTo - Fecha hasta (YYYY-MM-DD)
 * @param {string} options.sortBy - Campo para ordenar
 * @param {boolean} options.sortAsc - Orden ascendente
 * @returns {Object} - Datos, funciones y estado
 */
export function usePaymentsPaginated({
  page = 1,
  pageSize = 10,
  searchTerm = "",
  planId = "",
  paymentType = "",
  bank = "",
  dateFrom = "",
  dateTo = "",
  sortBy = "payment_date",
  sortAsc = false,
} = {}) {
  const [payments, setPayments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Calcular rango para paginación
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Construir query base con count
      let query = client
        .from("payments")
        .select(
          `
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
        `,
          { count: "exact" }
        );

      // Aplicar filtros del lado del servidor
      if (planId) {
        query = query.eq("plan_id", planId);
      }

      if (paymentType) {
        query = query.eq("payment_type", paymentType);
      }

      if (bank) {
        query = query.eq("bank", bank);
      }

      if (dateFrom) {
        query = query.gte("payment_date", dateFrom);
      }

      if (dateTo) {
        query = query.lte("payment_date", dateTo);
      }

      // Aplicar ordenamiento
      query = query.order(sortBy, { ascending: sortAsc });

      // Aplicar paginación
      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) {
        throw queryError;
      }

      // Si hay término de búsqueda, filtrar en cliente (esto es post-fetch ya que
      // Supabase no soporta búsqueda en campos de relación directamente en el query principal)
      let filteredData = data || [];
      
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredData = filteredData.filter((payment) => {
          const clientName = `${payment.clients?.first_name || ""} ${payment.clients?.last_name || ""}`.toLowerCase();
          const cedula = (payment.clients?.cedula || "").toLowerCase();
          return clientName.includes(searchLower) || cedula.includes(searchLower);
        });
      }

      setPayments(filteredData);
      // Note: When filtering client-side after pagination, count may not be accurate
      // For accurate count with search, you'd need a database function
      setTotalCount(searchTerm ? filteredData.length : (count || 0));
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError(err.message || "Error al cargar pagos");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    searchTerm,
    planId,
    paymentType,
    bank,
    dateFrom,
    dateTo,
    sortBy,
    sortAsc,
  ]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

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
    payments,
    totalCount,
    loading,
    error,
    
    // Estadísticas de paginación
    ...stats,
    
    // Funciones
    refetch: fetchPayments,
  };
}

export default usePaymentsPaginated;
