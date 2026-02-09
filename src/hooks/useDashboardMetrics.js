import { useState, useEffect } from 'react';
import client from '../api/client';
import { fetchWithOffline } from '../lib/offline-read';

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState({
    expiringSoon: [],
    upcomingBirthdays: [],
    newClients: [],
    weeklyRevenue: 0,
    weeklyAttendance: 0,
    monthlyAttendance: 0,
    weeklyPercentage: 0,
    monthlyPercentage: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Clientes próximos a vencer (5 días) - sin límite para mostrar todos
      const { data: expiringData } = await fetchWithOffline('dashboard-expiring', () => client
        .from('clients')
        .select(`
          *,
          plans (
            id,
            name,
            price
          )
        `)
        .gte('next_payment_date', new Date().toISOString().split('T')[0])
        .lte('next_payment_date', new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('next_payment_date', { ascending: true }));

      // 2. Cumpleaños del mes actual
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentDay = today.getDate();
      
      const { data: birthdayData } = await fetchWithOffline('dashboard-birthdays', () => client
        .from('clients')
        .select(`
          id,
          first_name,
          last_name,
          birth_date
        `)
        .not('birth_date', 'is', null));

      const currentMonthBirthdays = birthdayData ? birthdayData.filter(client => {
        const birthDate = new Date(client.birth_date);
        const birthMonth = birthDate.getMonth();
        const birthDay = birthDate.getDate();
        
        const isCurrentMonth = birthMonth === currentMonth;
        const hasPassed = birthDay < currentDay;
        
        return isCurrentMonth && !hasPassed;
      }).sort((a, b) => {
        const aDay = new Date(a.birth_date).getDate();
        const bDay = new Date(b.birth_date).getDate();
        return aDay - bDay;
      }) : [];

      // 3. Clientes nuevos del mes actual
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const { data: newClientsData } = await fetchWithOffline('dashboard-new-clients', () => client
        .from('clients')
        .select(`
          id,
          first_name,
          last_name,
          join_date,
          created_at
        `)
        .gte('join_date', monthStart.toISOString().split('T')[0])
        .order('join_date', { ascending: false }));

      // 4. Ingresos semanales
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: revenueData } = await fetchWithOffline('dashboard-revenue', () => client
        .from('clients')
        .select(`
          plans!inner (
            price
          ),
          join_date
        `)
        .gte('join_date', lastWeek.toISOString()));

      const weeklyRevenue = revenueData ? revenueData.reduce((total, client) => {
        return total + (parseFloat(client.plans?.price || 0) || 0);
      }, 0) : 0;
      
      // 5. Estadísticas de asistencia
      const attendanceStats = await getAttendanceStats();

      setMetrics({
        expiringSoon: expiringData || [],
        upcomingBirthdays: currentMonthBirthdays || [],
        newClients: newClientsData || [],
        weeklyRevenue,
        weeklyAttendance: attendanceStats.weeklyAttendance,
        weeklyUniqueClients: attendanceStats.weeklyUniqueClients,
        weeklyPercentage: attendanceStats.weeklyPercentage,
        monthlyAttendance: attendanceStats.monthlyAttendance,
        monthlyUniqueClients: attendanceStats.monthlyUniqueClients,
        monthlyPercentage: attendanceStats.monthlyPercentage,
        totalClients: attendanceStats.totalClients,
        weekDays: attendanceStats.weekDays,
        daysPassedInMonth: attendanceStats.daysPassedInMonth
      });

    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
      setError(err.message || 'Error al cargar métricas');
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceStats = async () => {
    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      weekStart.setHours(0, 0, 0, 0);
      
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Wrap attendance queries with offline fetch
      const { data: weeklyData } = await fetchWithOffline('dashboard-attendance-weekly', () => client
        .from('attendance')
        .select('client_id, date, status')
        .gte('date', weekStart.toISOString().split('T')[0])
        .lte('date', today.toISOString().split('T')[0]));

      const { data: monthlyData } = await fetchWithOffline('dashboard-attendance-monthly', () => client
        .from('attendance')
        .select('client_id, date, status')
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', today.toISOString().split('T')[0]));

      const { data: totalClients, count: totalClientsCount } = await fetchWithOffline('dashboard-total-clients', async () => {
         // fetchWithOffline expects a { data, error } response format, but .select(..., { count: 'exact' }) returns { data, count, error }
         // We'll wrap it to cache the count inside data or just cache the result object
         const res = await client
          .from('clients')
          .select('id', { count: 'exact', head: true });
         
         // Fix: Supabase 'head: true' returns null data. We need to store the count manually if we want to cache it.
         // Let's actually fetch IDs so we have data to cache, or just construct a fake data object with count.
         return { data: { count: res.count }, error: res.error };
      });

      const count = totalClients?.count || 0;

      const weeklyRecords = weeklyData || [];
      const weeklyUniqueClients = [...new Set(weeklyRecords.map(record => record.client_id))].length;
      const weekDays = Math.floor((today - weekStart) / (1000 * 60 * 60 * 24)) + 1;
      
      const monthlyRecords = monthlyData || [];
      const monthlyUniqueClients = [...new Set(monthlyRecords.map(record => record.client_id))].length;
      const daysPassedInMonth = today.getDate();
      
      return {
        weeklyAttendance: weeklyRecords.length,
        weeklyUniqueClients,
        weeklyPercentage: count > 0 ? (weeklyUniqueClients / count) * 100 : 0,
        monthlyAttendance: monthlyRecords.length,
        monthlyUniqueClients,
        monthlyPercentage: count > 0 ? (monthlyUniqueClients / count) * 100 : 0,
        weekDays,
        daysPassedInMonth,
        totalClients: count
      };
    } catch (err) {
      console.error('Error fetching attendance stats:', err);
      // Return default empty stats on error
      return {
        weeklyAttendance: 0,
        weeklyUniqueClients: 0,
        weeklyPercentage: 0,
        monthlyAttendance: 0,
        monthlyUniqueClients: 0,
        monthlyPercentage: 0,
        weekDays: 0,
        daysPassedInMonth: 0,
        totalClients: 0
      };
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    const handleOnline = () => fetchMetrics();
    window.addEventListener('online', handleOnline); // Re-fetch when connection returns
    
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics
  };
}