import { useState, useEffect } from 'react';
import client from '../api/client';

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

      // 1. Clientes próximos a vencer (5 días)
      const { data: expiringData } = await client
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
        .order('next_payment_date', { ascending: true })
        .limit(5);

      // 2. Cumpleaños del mes actual
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const currentDay = today.getDate();
      
      const { data: birthdayData } = await client
        .from('clients')
        .select(`
          id,
          first_name,
          last_name,
          birth_date
        `)
        .not('birth_date', 'is', null);

      console.log('Todos los clientes con birth_date:', birthdayData);

      const currentMonthBirthdays = birthdayData ? birthdayData.filter(client => {
        const birthDate = new Date(client.birth_date);
        const birthMonth = birthDate.getMonth();
        const birthDay = birthDate.getDate();
        
        // Solo clientes que cumplen años en el mes actual
        const isCurrentMonth = birthMonth === currentMonth;
        
        // Si ya pasó el cumpleaños este mes, no mostrar
        const hasPassed = birthDay < currentDay;
        
        console.log(`Birthday check for ${client.first_name} ${client.last_name}:`, {
          birthDate: client.birth_date,
          birthMonth,
          birthDay,
          currentMonth,
          currentDay,
          isCurrentMonth,
          hasPassed,
          shouldShow: isCurrentMonth && !hasPassed
        });
        
        return isCurrentMonth && !hasPassed;
      }).sort((a, b) => {
        // Ordenar por día del mes (ascendente)
        const aDay = new Date(a.birth_date).getDate();
        const bDay = new Date(b.birth_date).getDate();
        return aDay - bDay;
      }) : [];

      // 3. Clientes nuevos del mes actual
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const { data: newClientsData } = await client
        .from('clients')
        .select(`
          id,
          first_name,
          last_name,
          join_date,
          created_at
        `)
        .gte('join_date', monthStart.toISOString().split('T')[0])
        .order('join_date', { ascending: false });

      // 4. Ingresos semanales (planes activos)
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: revenueData } = await client
        .from('clients')
        .select(`
          plans!inner (
            price
          ),
          join_date
        `)
        .gte('join_date', lastWeek.toISOString());

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
      
      // Calcular inicio de la semana (lunes)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      weekStart.setHours(0, 0, 0, 0);
      
      // Calcular inicio del mes
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Asistencia semanal (registros totales esta semana)
      const { data: weeklyData, error: weeklyError } = await client
        .from('attendance')
        .select('client_id, date, status')
        .gte('date', weekStart.toISOString().split('T')[0])
        .lte('date', today.toISOString().split('T')[0]);

      // Asistencia mensual (registros totales este mes)
      const { data: monthlyData, error: monthlyError } = await client
        .from('attendance')
        .select('client_id, date, status')
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', today.toISOString().split('T')[0]);

      // Obtener total de clientes activos
      const { count: totalClientsCount, error: countError } = await client
        .from('clients')
        .select('id', { count: 'exact', head: true });

      if (weeklyError || monthlyError || countError) {
        throw new Error('Error fetching attendance data');
      }

      // Calcular métricas semanales
      const weeklyRecords = weeklyData || [];
      const weeklyUniqueClients = [...new Set(weeklyRecords.map(record => record.client_id))].length;
      
      // Calcular días hábiles esta semana
      const weekDays = Math.floor((today - weekStart) / (1000 * 60 * 60 * 24)) + 1;
      
      // Calcular métricas mensuales
      const monthlyRecords = monthlyData || [];
      const monthlyUniqueClients = [...new Set(monthlyRecords.map(record => record.client_id))].length;
      
      // Calcular días transcurridos del mes
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const daysPassedInMonth = today.getDate();
      
      return {
        weeklyAttendance: weeklyRecords.length, // Total de registros esta semana
        weeklyUniqueClients, // Clientes únicos esta semana
        weeklyPercentage: totalClientsCount > 0 ? (weeklyUniqueClients / totalClientsCount) * 100 : 0,
        monthlyAttendance: monthlyRecords.length, // Total de registros este mes
        monthlyUniqueClients, // Clientes únicos este mes
        monthlyPercentage: totalClientsCount > 0 ? (monthlyUniqueClients / totalClientsCount) * 100 : 0,
        weekDays, // Días transcurridos esta semana
        daysPassedInMonth, // Días transcurridos este mes
        totalClients: totalClientsCount || 0
      };
    } catch (err) {
      console.error('Error fetching attendance stats:', err);
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
  }, []);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics
  };
}