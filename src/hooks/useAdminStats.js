"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import client from "@/api/client";
import { fetchWithOffline } from "../lib/offline-read";

/**
 * Hook para obtener estadísticas agregadas del dashboard de administración
 * Combina datos de: personal, pagos al personal, gastos e ingresos (membresías)
 */
export default function useAdminStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Raw data
  const [staff, setStaff] = useState([]);
  const [staffPayments, setStaffPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [clientPayments, setClientPayments] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);

  // Nombres de meses en español
  const monthNames = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];

  const monthNamesFull = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // Fetch all data in parallel
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentYear = new Date().getFullYear();
      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;
      
      // Dynamic import to avoid top-level await issues if any, though standard import is fine
      // But we can just use the imported function if we add import at top later.
      // For now, I will assume I will add the import at the top of the file.
      
      const [
        staffResult,
        staffPaymentsResult,
        expensesResult,
        clientPaymentsResult,
        categoriesResult
      ] = await Promise.all([
        // Staff
        fetchWithOffline("admin-staff", () => client.from("staff").select("*")),
        
        // Staff payments (this year)
        fetchWithOffline(`admin-staff-payments-${currentYear}`, () => client
          .from("staff_payments")
          .select("*, staff:staff_id(first_name, last_name, position)")
          .gte("payment_date", startOfYear)
          .lte("payment_date", endOfYear)),
        
        // Expenses (this year)
        fetchWithOffline(`admin-expenses-${currentYear}`, () => client
          .from("expenses")
          .select("*")
          .gte("expense_date", startOfYear)
          .lte("expense_date", endOfYear)),
        
        // Client payments / income (this year)
        fetchWithOffline(`admin-client-payments-${currentYear}`, () => client
          .from("payments")
          .select("*, clients(first_name, last_name), plans(name)")
          .gte("payment_date", startOfYear)
          .lte("payment_date", endOfYear)),

        // Expense categories
        fetchWithOffline("admin-expense-categories", () => client
          .from("expense_categories")
          .select("*")
          .eq("is_active", true))
      ]);

      // Handle errors gracefully - tables may not exist yet
      if (staffResult.error && !staffResult.error.message?.includes("does not exist")) {
        console.error("Staff error:", staffResult.error);
      }
      // ... (rest of error logging can stay or be simplified)

      setStaff(staffResult.data || []);
      setStaffPayments(staffPaymentsResult.data || []);
      setExpenses(expensesResult.data || []);
      setClientPayments(clientPaymentsResult.data || []);
      setExpenseCategories(categoriesResult.data || []);

    } catch (err) {
      console.error("Error fetching admin stats:", err);
      // If offline, maybe we don't want to show a hard error if we have partial data?
      // But fetchWithOffline handles partial data via cache.
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ============================================
  // COMPUTED STATISTICS
  // ============================================

  // Summary cards data
  const summaryStats = useMemo(() => {
    const activeStaff = staff.filter(s => s.status === "active");
    const totalSalaries = activeStaff.reduce((sum, s) => sum + (parseFloat(s.salary) || 0), 0);
    
    const paidStaffPayments = staffPayments.filter(p => p.status === "paid");
    const totalStaffPaymentsPaid = paidStaffPayments.reduce(
      (sum, p) => sum + (parseFloat(p.total_amount) || 0), 
      0
    );
    
    const pendingStaffPayments = staffPayments.filter(p => p.status === "pending");
    const totalStaffPaymentsPending = pendingStaffPayments.reduce(
      (sum, p) => sum + (parseFloat(p.total_amount) || 0), 
      0
    );

    const paidExpenses = expenses.filter(e => e.status === "paid");
    const totalExpensesPaid = paidExpenses.reduce(
      (sum, e) => sum + (parseFloat(e.amount) || 0), 
      0
    );

    const pendingExpenses = expenses.filter(e => e.status === "pending");
    const totalExpensesPending = pendingExpenses.reduce(
      (sum, e) => sum + (parseFloat(e.amount) || 0), 
      0
    );

    // Client payments (income) - la tabla payments NO tiene campo status
    const completedClientPayments = clientPayments;
    const totalIncome = completedClientPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0), 
      0
    );

    // Net balance
    const totalEgresos = totalStaffPaymentsPaid + totalExpensesPaid;
    const netBalance = totalIncome - totalEgresos;

    return {
      staff: {
        total: staff.length,
        active: activeStaff.length,
        inactive: staff.filter(s => s.status === "inactive").length,
        onLeave: staff.filter(s => s.status === "on_leave").length,
        totalMonthlySalaries: totalSalaries,
      },
      staffPayments: {
        total: staffPayments.length,
        paid: paidStaffPayments.length,
        pending: pendingStaffPayments.length,
        totalPaid: totalStaffPaymentsPaid,
        totalPending: totalStaffPaymentsPending,
      },
      expenses: {
        total: expenses.length,
        paid: paidExpenses.length,
        pending: pendingExpenses.length,
        totalPaid: totalExpensesPaid,
        totalPending: totalExpensesPending,
      },
      income: {
        total: clientPayments.length,
        completed: completedClientPayments.length,
        totalAmount: totalIncome,
      },
      balance: {
        totalIncome,
        totalEgresos,
        netBalance,
      }
    };
  }, [staff, staffPayments, expenses, clientPayments]);

  // Monthly income vs expenses chart data
  const monthlyIncomeVsExpenses = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const data = monthNames.map((month, index) => ({
      name: month,
      month: index,
      ingresos: 0,
      gastos: 0,
      nomina: 0,
    }));

    // Income (client payments) - sin filtro de status (tabla payments no tiene ese campo)
    clientPayments
      .filter(p => {
        const paymentYear = new Date(p.payment_date).getFullYear();
        return paymentYear === currentYear;
      })
      .forEach(p => {
        const month = new Date(p.payment_date).getMonth();
        data[month].ingresos += parseFloat(p.amount_usd) || 0;
      });

    // Expenses
    expenses
      .filter(e => {
        const expenseYear = new Date(e.expense_date).getFullYear();
        return expenseYear === currentYear && e.status === "paid";
      })
      .forEach(e => {
        const month = new Date(e.expense_date).getMonth();
        data[month].gastos += parseFloat(e.amount) || 0;
      });

    // Staff payments (payroll)
    staffPayments
      .filter(p => {
        const paymentYear = new Date(p.payment_date).getFullYear();
        return paymentYear === currentYear && p.status === "paid";
      })
      .forEach(p => {
        const month = new Date(p.payment_date).getMonth();
        data[month].nomina += parseFloat(p.total_amount) || 0;
      });

    return data;
  }, [clientPayments, expenses, staffPayments, monthNames]);

  // Expenses by category (for pie chart)
  const expensesByCategory = useMemo(() => {
    const categoryMap = {};
    
    // Create a lookup for category names
    const categoryLookup = expenseCategories.reduce((acc, cat) => {
      acc[cat.id] = cat.name;
      return acc;
    }, {});

    expenses
      .filter(e => e.status === "paid")
      .forEach(e => {
        const categoryName = categoryLookup[e.category_id] || e.category || "Sin categoría";
        if (!categoryMap[categoryName]) {
          categoryMap[categoryName] = 0;
        }
        categoryMap[categoryName] += parseFloat(e.amount) || 0;
      });

    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, expenseCategories]);

  // Staff by position (for pie chart)
  const staffByPosition = useMemo(() => {
    const positionMap = {};
    
    staff
      .filter(s => s.status === "active")
      .forEach(s => {
        const position = s.position || "Sin puesto";
        if (!positionMap[position]) {
          positionMap[position] = 0;
        }
        positionMap[position] += 1;
      });

    return Object.entries(positionMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [staff]);

  // Monthly staff payments trend
  const monthlyStaffPayments = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const data = monthNames.map((month, index) => ({
      name: month,
      month: index,
      total: 0,
      count: 0,
    }));

    staffPayments
      .filter(p => {
        const paymentYear = new Date(p.payment_date).getFullYear();
        return paymentYear === currentYear && p.status === "paid";
      })
      .forEach(p => {
        const month = new Date(p.payment_date).getMonth();
        data[month].total += parseFloat(p.total_amount) || 0;
        data[month].count += 1;
      });

    return data;
  }, [staffPayments, monthNames]);

  // Recent activity (last 10 transactions)
  const recentActivity = useMemo(() => {
    const activities = [
      ...staffPayments.map(p => ({
        id: `sp-${p.id}`,
        type: "staff_payment",
        description: `Pago a ${p.staff?.first_name || ""} ${p.staff?.last_name || ""}`,
        amount: parseFloat(p.total_amount) || 0,
        date: p.payment_date,
        status: p.status,
      })),
      ...expenses.map(e => ({
        id: `exp-${e.id}`,
        type: "expense",
        description: e.description || "Gasto operativo",
        amount: parseFloat(e.amount) || 0,
        date: e.expense_date,
        status: e.status,
      })),
      ...clientPayments.slice(0, 20).map(p => ({
        id: `cp-${p.id}`,
        type: "income",
        description: `Pago de membresía${p.clients ? ` - ${p.clients.first_name} ${p.clients.last_name}` : ""}${p.plans ? ` (${p.plans.name})` : ""}`,
        amount: parseFloat(p.amount_usd) || 0,
        date: p.payment_date,
        status: "paid",
      })),
    ];

    return activities
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  }, [staffPayments, expenses, clientPayments]);

  // Current month stats
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const isCurrentMonth = (dateStr) => {
      const date = new Date(dateStr);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    };

    const monthIncome = clientPayments
      .filter(p => isCurrentMonth(p.payment_date))
      .reduce((sum, p) => sum + (parseFloat(p.amount_usd) || 0), 0);

    const monthExpenses = expenses
      .filter(e => isCurrentMonth(e.expense_date) && e.status === "paid")
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const monthPayroll = staffPayments
      .filter(p => isCurrentMonth(p.payment_date) && p.status === "paid")
      .reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);

    return {
      monthName: monthNamesFull[currentMonth],
      income: monthIncome,
      expenses: monthExpenses,
      payroll: monthPayroll,
      total: monthIncome - monthExpenses - monthPayroll,
    };
  }, [clientPayments, expenses, staffPayments, monthNamesFull]);

  return {
    loading,
    error,
    refetch: fetchAllData,
    // Summary
    summaryStats,
    currentMonthStats,
    // Chart data
    monthlyIncomeVsExpenses,
    expensesByCategory,
    staffByPosition,
    monthlyStaffPayments,
    // Activity
    recentActivity,
    // Raw data (if needed)
    raw: {
      staff,
      staffPayments,
      expenses,
      clientPayments,
      expenseCategories,
    }
  };
}
