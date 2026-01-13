"use client";

import React, { useState, useEffect } from "react";
import { useAttendance } from "../../../hooks/useAttendance";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import {
  EditIcon,
  TrashIcon,
  SearchIcon,
  FilterXIcon,
} from "../../../components/ui/icons";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

const Asistencia = () => {
  const {
    attendance,
    loading,
    error,
    refetch,
    registerAttendance,
    updateAttendance,
    deleteAttendance,
    checkClientStatus,
    getAttendanceByClientId,
  } = useAttendance();

  const [searchTerm, setSearchTerm] = useState("");
  const [checking, setChecking] = useState(false);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [clientStatus, setClientStatus] = useState(null);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);

  // Estados para búsqueda y filtros de la tabla
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const handleCheckCedula = async () => {
    if (!searchTerm.trim()) {
      toast.error("Por favor ingrese una cédula o nombre");
      return;
    }

    setChecking(true);
    const result = await checkClientStatus(searchTerm);
    setClientStatus(result);
    setChecking(false);
  };

  const handleCancelVerification = () => {
    setSearchTerm("");
    setClientStatus(null);
  };

  const handleMarkAttendance = async (clientId, date) => {
    setMarkingAttendance(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await registerAttendance({
        client_id: clientId,
        date: date || today,
        check_in_time: new Date()
          .toTimeString("es-ES", { hour12: false })
          .split(" ")[0],
        status: "present",
      });

      if (result.success) {
        // Limpiar formulario y esconder información del cliente
        setSearchTerm("");
        setClientStatus(null);
        toast.success("Asistencia registrada exitosamente");
      } else {
        toast.error("Error al registrar asistencia: " + result.error);
      }
    } catch (err) {
      console.error("Error marking attendance:", err);
      toast.error("Error al registrar asistencia: " + err.message);
    } finally {
      setMarkingAttendance(false);
    }
  };

  const handleDeleteAttendance = async (id) => {
    setDeletingId(id);
    try {
      const result = await deleteAttendance(id);
      if (result.success) {
        toast.success("Asistencia eliminada exitosamente");
      } else {
        toast.error("Error al eliminar asistencia: " + result.error);
      }
    } catch (err) {
      console.error("Error deleting attendance:", err);
      toast.error("Error al eliminar asistencia: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-ES");
  };

  const formatTime = (timeString) => {
    if (!timeString) return "N/A";
    const [hours, minutes] = timeString.split(":");
    return `${hours}:${minutes}`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      present: { color: "bg-green-100 text-green-800", text: "Presente" },
      absent: { color: "bg-red-100 text-red-800", text: "Ausente" },
      late: { color: "bg-yellow-100 text-yellow-800", text: "Tarde" },
    };

    const config = statusConfig[status] || statusConfig.present;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${config.color}`}
      >
        {config.text}
      </span>
    );
  };

  // Lógica de filtrado para la tabla de asistencia
  const filteredAttendance = attendance.filter((record) => {
    // Filtrar por término de búsqueda
    let matchesSearch = true;
    if (tableSearchTerm.trim() !== "") {
      const searchTermLower = tableSearchTerm.toLowerCase();
      matchesSearch =
        (record.clients?.first_name || "")
          .toLowerCase()
          .includes(searchTermLower) ||
        (record.clients?.last_name || "")
          .toLowerCase()
          .includes(searchTermLower) ||
        (record.clients?.cedula || "").toLowerCase().includes(searchTermLower);
    }

    // Filtrar por estado
    let matchesStatus = true;
    if (statusFilter !== "") {
      matchesStatus = record.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  // Función para limpiar todos los filtros
  const clearTableFilters = () => {
    setTableSearchTerm("");
    setStatusFilter("");
  };

  // Contar filtros activos
  const activeTableFiltersCount = [tableSearchTerm, statusFilter].filter(
    (filter) => filter !== ""
  ).length;

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Asistencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">Error: {error}</p>
              <Button onClick={refetch}>Reintentar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        {/* Header con verificación de cliente */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Asistencia</h1>
            <p className="text-muted-foreground">
              Registro de asistencia y control de acceso
            </p>
          </div>
          <Button onClick={refetch} variant="outline" size="sm">
            Actualizar
          </Button>
        </div>

        {/* Verificación de cliente */}
        <Card>
          <CardHeader>
            <CardTitle>🔍 Verificar Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ingrese cédula o nombre del cliente"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleCheckCedula();
                  }
                }}
              />
              <Button
                onClick={handleCheckCedula}
                disabled={checking}
                variant="default"
              >
                {checking ? "Verificando..." : "Verificar"}
              </Button>
            </div>

            {/* Resultado de verificación */}
            {clientStatus && (
              <div className="mt-4 p-4 rounded-lg">
                {clientStatus.found ? (
                  <div
                    className={`p-4 rounded-lg ${
                      clientStatus.canEnter
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <h3 className="font-semibold mb-2">
                      ✅ Cliente Encontrado
                    </h3>
                    <div className="space-y-1">
                      <p>
                        <strong>Nombre:</strong>{" "}
                        {clientStatus.client.first_name}{" "}
                        {clientStatus.client.last_name}
                      </p>
                      <p>
                        <strong>Plan:</strong>{" "}
                        {clientStatus.client.plans?.name || "Sin plan"}
                      </p>
                      <p>
                        <strong>Próximo pago:</strong>{" "}
                        {formatDate(clientStatus.client.next_payment_date)}
                      </p>
                    </div>
                    <div
                      className={`mt-3 p-3 rounded-md ${
                        clientStatus.canEnter
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {clientStatus.message}
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:justify-center">
                      {clientStatus.canEnter && (
                        <Button
                          onClick={() =>
                            handleMarkAttendance(clientStatus.client.id)
                          }
                          variant="default"
                          className="flex-1 sm:flex-initial sm:min-w-[140px]"
                          disabled={markingAttendance}
                        >
                          {markingAttendance ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Marcando...
                            </>
                          ) : (
                            "✅ Marcar Asistencia"
                          )}
                        </Button>
                      )}
                      <Button
                        onClick={handleCancelVerification}
                        variant="outline"
                        className="flex-1 sm:flex-initial sm:min-w-[100px]"
                      >
                        ❌ Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border-red-200 rounded-lg">
                    <h3 className="font-semibold mb-2">
                      ❌ Cliente No Encontrado
                    </h3>
                    {/* <p className="text-red-800">{clientStatus.message}</p> */}
                    <div className="mt-3 sm:flex sm:justify-center">
                      <Button
                        onClick={handleCancelVerification}
                        variant="outline"
                        className="w-full sm:w-auto sm:min-w-[100px]"
                      >
                        ❌ Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabla de asistencias */}
        <Card>
          <CardHeader>
            <CardTitle>
              📋 Registro de Asistencias ({filteredAttendance.length}
              {filteredAttendance.length !== attendance.length
                ? ` de ${attendance.length}`
                : ""}
              )
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Barra de búsqueda y filtros */}
            <div className="mb-6 space-y-4">
              {/* Barra de búsqueda */}
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre o cédula..."
                  value={tableSearchTerm}
                  onChange={(e) => setTableSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Filtros:
                </span>

                {/* Filtro por estado */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos los estados</option>
                  <option value="present">Presente</option>
                  <option value="absent">Ausente</option>
                  <option value="late">Tarde</option>
                </select>

                {/* Botón para limpiar filtros */}
                {activeTableFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearTableFilters}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <FilterXIcon className="h-4 w-4 mr-1" />
                    Limpiar ({activeTableFiltersCount})
                  </Button>
                )}
              </div>

              {/* Indicador de resultados */}
              {filteredAttendance.length !== attendance.length && (
                <div className="text-sm text-muted-foreground">
                  Mostrando {filteredAttendance.length} de {attendance.length}{" "}
                  registros
                </div>
              )}
            </div>
            {attendance.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No hay asistencias registradas
                </p>
              </div>
            ) : filteredAttendance.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No se encontraron registros con los filtros aplicados
                </p>
                <Button onClick={clearTableFilters} variant="outline">
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.map((record, index) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {formatDate(record.date)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {record.clients?.first_name}{" "}
                              {record.clients?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {record.clients?.cedula}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatTime(record.check_in_time)}
                        </TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell>
                          <div
                            className="max-w-xs truncate"
                            title={record.notes}
                          >
                            {record.notes || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => {
                                    setSelectedClientId(record.client_id);
                                    setShowAttendanceForm(true);
                                  }}
                                >
                                  <EditIcon />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Editar asistencia</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="icon-sm"
                                  onClick={() =>
                                    handleDeleteAttendance(record.id)
                                  }
                                  disabled={deletingId === record.id}
                                >
                                  {deletingId === record.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <TrashIcon />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Eliminar asistencia</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Asistencia;
