"use client";

import { useState, useEffect, useCallback } from "react";
import client from "@/api/client";

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

      const { data, error: fetchError } = await client
        .from("staff")
        .select("*")
        .order("created_at", { ascending: false });

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
      const { data, error: fetchError } = await client
        .from("staff_positions")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (fetchError) throw fetchError;
      setPositions(data || []);
    } catch (err) {
      console.error("Error fetching positions:", err);
    }
  }, []);

  // Crear nuevo personal
  const createStaff = useCallback(async (staffData) => {
    try {
      const { data, error: createError } = await client
        .from("staff")
        .insert([staffData])
        .select()
        .single();

      if (createError) throw createError;
      
      setStaff((prev) => [data, ...prev]);
      return { data, error: null };
    } catch (err) {
      console.error("Error creating staff:", err);
      return { data: null, error: err.message };
    }
  }, []);

  // Actualizar personal
  const updateStaff = useCallback(async (id, staffData) => {
    try {
      const { data, error: updateError } = await client
        .from("staff")
        .update(staffData)
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;
      
      setStaff((prev) => prev.map((s) => (s.id === id ? data : s)));
      return { data, error: null };
    } catch (err) {
      console.error("Error updating staff:", err);
      return { data: null, error: err.message };
    }
  }, []);

  // Eliminar personal
  const deleteStaff = useCallback(async (id) => {
    try {
      const { error: deleteError } = await client
        .from("staff")
        .delete()
        .eq("id", id);

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
      const { data, error: fetchError } = await client
        .from("staff")
        .select("*")
        .eq("id", id)
        .single();

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
