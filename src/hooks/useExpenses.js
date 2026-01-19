"use client";

import { useState, useEffect, useCallback } from "react";
import client from "@/api/client";
import useAuth from "@/hooks/useAuth";

/**
 * Hook para gestionar los gastos operativos
 */
export default function useExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar gastos
  const fetchExpenses = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);

      let query = client
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });

      // Aplicar filtros
      if (filters.category) {
        query = query.eq("category", filters.category);
      }
      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.startDate) {
        query = query.gte("expense_date", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("expense_date", filters.endDate);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setExpenses(data || []);
    } catch (err) {
      console.error("Error fetching expenses:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar categorías
  const fetchCategories = useCallback(async () => {
    try {
      const { data, error: fetchError } = await client
        .from("expense_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }, []);

  // Crear gasto
  const createExpense = useCallback(async (expenseData) => {
    try {
      const { data, error: createError } = await client
        .from("expenses")
        .insert([{
          ...expenseData,
          created_by: user?.id,
        }])
        .select()
        .single();

      if (createError) throw createError;
      
      setExpenses((prev) => [data, ...prev]);
      return { data, error: null };
    } catch (err) {
      console.error("Error creating expense:", err);
      return { data: null, error: err.message };
    }
  }, [user?.id]);

  // Actualizar gasto
  const updateExpense = useCallback(async (id, expenseData) => {
    try {
      const { data, error: updateError } = await client
        .from("expenses")
        .update(expenseData)
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;
      
      setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)));
      return { data, error: null };
    } catch (err) {
      console.error("Error updating expense:", err);
      return { data: null, error: err.message };
    }
  }, []);

  // Eliminar gasto
  const deleteExpense = useCallback(async (id) => {
    try {
      const { error: deleteError } = await client
        .from("expenses")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      return { error: null };
    } catch (err) {
      console.error("Error deleting expense:", err);
      return { error: err.message };
    }
  }, []);

  // Obtener estadísticas de gastos
  const getExpenseStats = useCallback((periodStart, periodEnd) => {
    const filteredExpenses = expenses.filter((e) => {
      if (periodStart && e.expense_date < periodStart) return false;
      if (periodEnd && e.expense_date > periodEnd) return false;
      return e.status === "paid";
    });

    const byCategory = filteredExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + (parseFloat(e.amount) || 0);
      return acc;
    }, {});

    return {
      total: filteredExpenses.length,
      totalAmount: filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
      byCategory,
      avgExpense: filteredExpenses.length > 0 
        ? filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) / filteredExpenses.length 
        : 0,
    };
  }, [expenses]);

  // Obtener gastos por mes para gráficos
  const getMonthlyExpenses = useCallback((year) => {
    const monthly = Array(12).fill(0);
    
    expenses
      .filter((e) => {
        const expenseYear = new Date(e.expense_date).getFullYear();
        return expenseYear === year && e.status === "paid";
      })
      .forEach((e) => {
        const month = new Date(e.expense_date).getMonth();
        monthly[month] += parseFloat(e.amount) || 0;
      });

    return monthly;
  }, [expenses]);

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, [fetchExpenses, fetchCategories]);

  return {
    expenses,
    categories,
    loading,
    error,
    fetchExpenses,
    fetchCategories,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseStats,
    getMonthlyExpenses,
  };
}
