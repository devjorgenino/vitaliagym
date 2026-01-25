"use client";

import { useState, useEffect, useCallback } from "react";
import client from "@/api/client";
import { fetchWithOffline } from "../lib/offline-read";
import { executeWithSync } from "../lib/data-sync";

/**
 * Hook para gestionar el personal del gimnasio
 */
export default function useStaff() {
  const [staff, setStaff] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar lista de personal
  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await fetchWithOffline("staff-list", () => client
        .from("staff")
        .select("*")
        .order("created_at", { ascending: false }));

      if (fetchError) throw fetchError;
      setStaff(data || []);
    } catch (err) {
      console.error("Error fetching staff:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar posiciones disponibles
  const fetchPositions = useCallback(async () => {
    try {
      const { data, error: fetchError } = await fetchWithOffline("staff-positions", () => client
        .from("staff_positions")
        .select("*")
        .eq("is_active", true)
        .order("name"));

      if (fetchError) throw fetchError;
      setPositions(data || []);
    } catch (err) {
      console.error("Error fetching positions:", err);
    }
  }, []);

  // Crear nuevo personal
  const createStaff = useCallback(async (staffData) => {
    try {
      const { data, error: createError } = await executeWithSync({
        table: 'staff',
        type: 'INSERT',
        data: staffData
      });

      if (createError) throw createError;
      
      if (data && data[0]) {
          setStaff((prev) => [data[0], ...prev]);
      } else {
          fetchStaff();
      }
      return { data: data ? data[0] : null, error: null };
    } catch (err) {
      console.error("Error creating staff:", err);
      return { data: null, error: err.message };
    }
  }, [fetchStaff]);

  // Actualizar personal
  const updateStaff = useCallback(async (id, staffData) => {
    try {
      const { data, error: updateError } = await executeWithSync({
        table: 'staff',
        type: 'UPDATE',
        data: staffData,
        match: { id }
      });

      if (updateError) throw updateError;
      
      if (data && data[0]) {
          setStaff((prev) => prev.map((s) => (s.id === id ? data[0] : s)));
      } else {
          fetchStaff();
      }
      return { data: data ? data[0] : null, error: null };
    } catch (err) {
      console.error("Error updating staff:", err);
      return { data: null, error: err.message };
    }
  }, [fetchStaff]);

  // Eliminar personal
  const deleteStaff = useCallback(async (id) => {
    try {
      const { error: deleteError } = await executeWithSync({
        table: 'staff',
        type: 'DELETE',
        match: { id }
      });

      if (deleteError) throw deleteError;
      
      setStaff((prev) => prev.filter((s) => s.id !== id));
      return { error: null };
    } catch (err) {
      console.error("Error deleting staff:", err);
      return { error: err.message };
    }
  }, []);

  // Obtener un miembro del personal por ID
  const getStaffById = useCallback(async (id) => {
    try {
      const { data, error: fetchError } = await fetchWithOffline(`staff-${id}`, () => client
        .from("staff")
        .select("*")
        .eq("id", id)
        .single());

      if (fetchError) throw fetchError;
      return { data, error: null };
    } catch (err) {
      console.error("Error fetching staff member:", err);
      return { data: null, error: err.message };
    }
  }, []);

  // Obtener estadísticas del personal
  const getStaffStats = useCallback(() => {
    const activeStaff = staff.filter((s) => s.status === "active");
    const totalSalary = activeStaff.reduce((sum, s) => sum + (parseFloat(s.salary) || 0), 0);
    
    const byPosition = activeStaff.reduce((acc, s) => {
      acc[s.position] = (acc[s.position] || 0) + 1;
      return acc;
    }, {});

    return {
      total: staff.length,
      active: activeStaff.length,
      inactive: staff.filter((s) => s.status === "inactive").length,
      onLeave: staff.filter((s) => s.status === "on_leave").length,
      terminated: staff.filter((s) => s.status === "terminated").length,
      totalMonthlySalary: totalSalary,
      byPosition,
    };
  }, [staff]);

  useEffect(() => {
    fetchStaff();
    fetchPositions();
    
    const handleOnline = () => {
        fetchStaff();
        fetchPositions();
    };
    window.addEventListener('online', handleOnline);

    return () => window.removeEventListener('online', handleOnline);
  }, [fetchStaff, fetchPositions]);

  return {
    staff,
    positions,
    loading,
    error,
    fetchStaff,
    fetchPositions,
    createStaff,
    updateStaff,
    deleteStaff,
    getStaffById,
    getStaffStats,
  };
}
