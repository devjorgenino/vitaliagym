"use client";

import React, { useState } from "react";
import { useAttendance } from "../../../hooks/useAttendance";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { EmptyState, SearchEmptyState } from "../../../components/ui/empty-state";
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
import { 
  Loader2, 
  RefreshCw, 
  UserCheck, 
  UserX, 
  Clock, 
  CheckCircle2,
  XCircle,
  Search,
  Calendar,
} from "lucide-react";
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
  const [deleteDialog, setDeleteDialog] = useState({ open: false, record: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [clientStatus, setClientStatus] = useState(null);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);

  // Estados para búsqueda y filtros de la tabla
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const openDeleteDialog = (record) => {
    setDeleteDialog({ open: true, record });
  };

  const handleDeleteAttendance = async () => {
    if (!deleteDialog.record) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteAttendance(deleteDialog.record.id);
      if (result.success) {
        toast.success("Asistencia eliminada exitosamente");
        setDeleteDialog({ open: false, record: null });
      } else {
        toast.error("Error al eliminar asistencia: " + result.error);
      }
    } catch (err) {
      console.error("Error deleting attendance:", err);
      toast.error("Error al eliminar asistencia: " + err.message);
    } finally {
      setIsDeleting(false);
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
      present: { 
        variant: "default",
        icon: CheckCircle2,
        text: "Presente",
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      },
      absent: { 
        variant: "destructive",
        icon: XCircle,
        text: "Ausente",
        className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      },
      late: { 
        variant: "secondary",
        icon: Clock,
        text: "Tarde",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      },
    };

    const config = statusConfig[status] || statusConfig.present;
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span>{config.text}</span>
      </Badge>
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
    if (statusFilter !== "all") {
      matchesStatus = record.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  // Función para limpiar todos los filtros
  const clearTableFilters = () => {
    setTableSearchTerm("");
    setStatusFilter("all");
  };

  // Contar filtros activos
  const activeTableFiltersCount = [
    tableSearchTerm ? 1 : 0, 
    statusFilter !== "all" ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6" role="status" aria-label="Cargando asistencia">
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
            <div className="text-center py-8" role="alert">
              <p className="text-destructive mb-4">Error: {error}</p>
              <Button onClick={refetch} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Asistencia</h1>
              <p className="text-muted-foreground">
                Registro de asistencia y control de acceso al gimnasio
              </p>
            </div>
            <Button 
              onClick={refetch} 
              variant="outline" 
              size="sm"
              className="gap-2 w-fit"
              aria-label="Actualizar lista de asistencia"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>

          {/* Verificación de cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" aria-hidden="true" />
                Verificar Cliente
              </CardTitle>
              <CardDescription>
                Ingresa la cédula o nombre del cliente para verificar su membresía y registrar asistencia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="client-search" className="sr-only">
                    Cédula o nombre del cliente
                  </Label>
                  <Input
                    id="client-search"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ingrese cédula o nombre del cliente"
                    aria-describedby="search-hint"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCheckCedula();
                      }
                    }}
                  />
                  <p id="search-hint" className="text-xs text-muted-foreground">
                    Presiona Enter o haz clic en Verificar para buscar
                  </p>
                </div>
                <Button
                  onClick={handleCheckCedula}
                  disabled={checking || !searchTerm.trim()}
                  className="gap-2 sm:self-start"
                >
                  {checking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Verificar
                    </>
                  )}
                </Button>
              </div>

              {/* Resultado de verificación */}
              {clientStatus && (
                <div className="mt-4" role="region" aria-label="Resultado de verificación">
                  {clientStatus.found ? (
                    <div
                      className={`p-4 rounded-lg border ${
                        clientStatus.canEnter
                          ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                          : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          clientStatus.canEnter 
                            ? "bg-green-100 dark:bg-green-800" 
                            : "bg-red-100 dark:bg-red-800"
                        }`}>
                          {clientStatus.canEnter ? (
                            <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                          ) : (
                            <UserX className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-2">
                            Cliente Encontrado
                          </h3>
                          <dl className="space-y-1 text-sm">
                            <div className="flex gap-2">
                              <dt className="font-medium">Nombre:</dt>
                              <dd>
                                {clientStatus.client.first_name}{" "}
                                {clientStatus.client.last_name}
                              </dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="font-medium">Plan:</dt>
                              <dd>{clientStatus.client.plans?.name || "Sin plan"}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="font-medium">Próximo pago:</dt>
                              <dd>{formatDate(clientStatus.client.next_payment_date)}</dd>
                            </div>
                          </dl>
                          <div
                            className={`mt-3 p-3 rounded-md text-sm font-medium ${
                              clientStatus.canEnter
                                ? "bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-200"
                                : "bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-200"
                            }`}
                            role="status"
                          >
                            {clientStatus.message}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
                        {clientStatus.canEnter && (
                          <Button
                            onClick={() =>
                              handleMarkAttendance(clientStatus.client.id)
                            }
                            className="gap-2"
                            disabled={markingAttendance}
                          >
                            {markingAttendance ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Registrando...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                Registrar Asistencia
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          onClick={handleCancelVerification}
                          variant="outline"
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Cerrar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-red-100 dark:bg-red-800">
                          <UserX className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-red-800 dark:text-red-200">
                            Cliente No Encontrado
                          </h3>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                            No se encontró ningún cliente con la cédula o nombre "{searchTerm}"
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          onClick={handleCancelVerification}
                          variant="outline"
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Cerrar
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
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" aria-hidden="true" />
                Registro de Asistencias
                <Badge variant="secondary" className="ml-2">
                  {filteredAttendance.length}
                  {filteredAttendance.length !== attendance.length && (
                    <span className="text-muted-foreground"> de {attendance.length}</span>
                  )}
                </Badge>
              </CardTitle>
              <CardDescription>
                Historial de asistencias registradas. Usa los filtros para encontrar registros específicos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Barra de búsqueda y filtros */}
              <div className="mb-6 space-y-4">
                {/* Barra de búsqueda */}
                <div className="relative">
                  <Label htmlFor="table-search" className="sr-only">
                    Buscar por nombre o cédula
                  </Label>
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" aria-hidden="true" />
                  <Input
                    id="table-search"
                    type="text"
                    placeholder="Buscar por nombre o cédula..."
                    value={tableSearchTerm}
                    onChange={(e) => setTableSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap gap-3 items-center">
                  <Label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground">
                    Filtrar por estado:
                  </Label>

                  {/* Filtro por estado */}
                  <Select
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    <SelectTrigger id="status-filter" className="w-[180px]">
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="present">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Presente
                        </div>
                      </SelectItem>
                      <SelectItem value="absent">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Ausente
                        </div>
                      </SelectItem>
                      <SelectItem value="late">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-600" />
                          Tarde
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Botón para limpiar filtros */}
                  {activeTableFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearTableFilters}
                      className="text-muted-foreground hover:text-foreground gap-1"
                    >
                      <FilterXIcon className="h-4 w-4" />
                      Limpiar filtros ({activeTableFiltersCount})
                    </Button>
                  )}
                </div>
              </div>

              {/* Contenido de la tabla */}
              {attendance.length === 0 ? (
                <EmptyState
                  icon="calendar"
                  title="No hay asistencias registradas"
                  description="Las asistencias aparecerán aquí cuando verifiques clientes y registres su entrada al gimnasio."
                  action={{
                    label: "Verificar Cliente",
                    onClick: () => document.getElementById("client-search")?.focus(),
                  }}
                />
              ) : filteredAttendance.length === 0 ? (
                <SearchEmptyState
                  searchTerm={tableSearchTerm}
                  onClear={clearTableFilters}
                  entityName="registros de asistencia"
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Fecha</TableHead>
                        <TableHead scope="col">Cliente</TableHead>
                        <TableHead scope="col">Check-in</TableHead>
                        <TableHead scope="col">Estado</TableHead>
                        <TableHead scope="col">Notas</TableHead>
                        <TableHead scope="col">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendance.map((record) => (
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
                              {record.notes || (
                                <span className="text-muted-foreground italic">Sin notas</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => {
                                      setSelectedClientId(record.client_id);
                                      setShowAttendanceForm(true);
                                    }}
                                    aria-label={`Editar asistencia de ${record.clients?.first_name} ${record.clients?.last_name}`}
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
                                    onClick={() => openDeleteDialog(record)}
                                    aria-label={`Eliminar asistencia de ${record.clients?.first_name} ${record.clients?.last_name}`}
                                  >
                                    <TrashIcon />
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

      {/* Diálogo de confirmación para eliminar */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, record: open ? deleteDialog.record : null })}
        title="Eliminar Registro de Asistencia"
        description={
          deleteDialog.record
            ? `¿Estás seguro de que deseas eliminar el registro de asistencia de ${deleteDialog.record.clients?.first_name} ${deleteDialog.record.clients?.last_name} del ${formatDate(deleteDialog.record.date)}? Esta acción no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleDeleteAttendance}
      />
    </>
  );
};

export default Asistencia;
