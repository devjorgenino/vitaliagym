import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useClients } from "../../hooks/useClients";
import { usePlans } from "../../hooks/usePlans";
import { usePayments } from "../../hooks/usePayments";
import { useExchangeRate } from "../../hooks/useExchangeRate";
import {
  DOCUMENT_TYPES,
  PHONE_OPERATORS,
  formatCedula,
  parseCedula,
  formatPhone,
  parsePhone,
} from "../../lib/venezuelanData";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Loader2, IdCard, Phone, Settings2, CalendarClock, Users, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { TruncatedCell } from "../ui/truncated-cell";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  EmptyState,
  SearchEmptyState,
  GettingStartedState,
} from "../ui/empty-state";
import {
  EditIcon,
  TrashIcon,
  SearchIcon,
  FilterXIcon,
  DollarSignIcon,
} from "../ui/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Pagination, usePagination } from "../ui/pagination";

export function ClientsTable() {
  const router = useRouter();
  const {
    clients,
    loading,
    error,
    isUpdating,
    refetch,
    createClient,
    updateClient,
    deleteClient,
    recalculateAllNextPaymentDates,
    fixAllPhones,
  } = useClients();

  const { plans, loading: plansLoading } = usePlans();
  const { payments, loading: paymentsLoading } = usePayments();
  const { formatMultiCurrency, loading: rateLoading } = useExchangeRate();

  // Estados del modal unificado para crear/editar
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    cedula_type: "V",
    cedula: "",
    birth_date: "",
    email: "",
    phone_operator: "0414",
    phone: "",
    address: "",
    observations: "",
    plan_id: "",
    join_date: new Date().toISOString().split("T")[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para eliminación
  const [deletingId, setDeletingId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  // Estados para paginación
  const {
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    resetPage,
    paginateData,
  } = usePagination(10);

  const getPlanPrice = (planId) => {
    const plan = plans.find((p) => p.id === planId);
    return plan ? parseFloat(plan.price) || 0 : 0;
  };

  const calculatePaymentStatus = (client) => {
    if (!client || !client.plan_id) {
      return { isFullyPaid: true, remainingFormatted: "0.00" };
    }

    const planPrice = getPlanPrice(client.plan_id);
    if (planPrice <= 0) {
      return { isFullyPaid: true, remainingFormatted: "0.00" };
    }

    const allClientPayments = payments.filter(
      (p) => p.client_id === client.id && p.plan_id === client.plan_id,
    );

    const totalPaidSoFar = allClientPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0,
    );

    let paidForCurrentCycle = totalPaidSoFar % planPrice;

    if (paidForCurrentCycle < 0.001 && totalPaidSoFar > 0) {
      paidForCurrentCycle = planPrice;
    }

    const currentRemaining = planPrice - paidForCurrentCycle;
    const isFullyPaid = currentRemaining < 0.001;

    return {
      isFullyPaid: isFullyPaid,
      remainingFormatted: (isFullyPaid ? 0 : currentRemaining).toFixed(2),
    };
  };

  const getPaymentWithRemaining = (client) => {
    if (!client || !client.plan_id) {
      return null;
    }

    const allClientPayments = payments.filter(
      (p) => p.client_id === client.id && p.plan_id === client.plan_id,
    );

    if (allClientPayments.length === 0) {
      return null;
    }

    const planPrice = getPlanPrice(client.plan_id);
    const totalPaid = allClientPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0,
    );

    const remainingAmount = Math.max(0, planPrice - totalPaid);

    if (remainingAmount > 0) {
      // Encontrar el último pago para asociarlo con el saldo restante
      const lastPayment = allClientPayments.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      )[0];

      return {
        ...lastPayment,
        remainingAmount,
        remainingFormatted: remainingAmount.toFixed(2),
      };
    }

    return null;
  };

  const handlePayRemainingForClient = (client) => {
    const paymentWithRemaining = getPaymentWithRemaining(client);

    if (paymentWithRemaining) {
      // Redirigir a la página de pagos con parámetros específicos para el pago restante
      router.push(
        `/pagos/${client.id}?paymentId=${paymentWithRemaining.id}&remaining=${paymentWithRemaining.remainingAmount}&payRemaining=true`,
      );
    } else {
      // Si no hay pago específico con saldo, redirigir a la página normal
      router.push(`/pagos/${client.id}`);
    }
  };

  // Resetear formulario
  const resetForm = useCallback(() => {
    setFormData({
      first_name: "",
      last_name: "",
      cedula_type: "V",
      cedula: "",
      birth_date: "",
      email: "",
      phone_operator: "0414",
      phone: "",
      address: "",
      observations: "",
      plan_id: "",
      join_date: new Date().toISOString().split("T")[0],
    });
    setSelectedClient(null);
    setIsEditing(false);
  }, []);

  // Abrir modal para crear
  const handleOpenCreateDialog = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  // Abrir modal para editar
  const handleOpenEditDialog = useCallback((client) => {
    setSelectedClient(client);
    // Parse cedula to separate type and number
    const { type, number } = parseCedula(client.cedula || "");
    // Parse phone to separate operator and number
    const { operator, number: phoneNumber } = parsePhone(client.phone || "");
    setFormData({
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      cedula_type: type,
      cedula: number,
      birth_date: client.birth_date || "",
      email: client.email || "",
      phone_operator: operator,
      phone: phoneNumber,
      address: client.address || "",
      observations: client.observations || "",
      plan_id: client.plan_id || "",
      join_date: client.join_date || "",
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  }, []);

  // Cerrar modal
  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setTimeout(resetForm, 150);
  }, [resetForm]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Máscara para teléfono: solo números, max 7 dígitos
    if (name === "phone") {
      const cleanValue = value.replace(/\D/g, "").slice(0, 7);
      setFormData((prev) => ({
        ...prev,
        [name]: cleanValue,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Enviar formulario (crear o editar)
  const handleSubmit = async () => {
    if (
      !formData.first_name.trim() ||
      !formData.last_name.trim() ||
      !formData.cedula.trim() ||
      !formData.birth_date
    ) {
      toast.error(
        "Los campos de nombre, apellido, cédula y fecha de nacimiento son obligatorios",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Format cedula with type prefix before saving
      // Format phone with operator prefix before saving
      const dataToSave = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        cedula: formatCedula(formData.cedula_type, formData.cedula),
        birth_date: formData.birth_date,
        email: formData.email,
        phone: formData.phone
          ? formatPhone(formData.phone_operator, formData.phone)
          : "",
        address: formData.address,
        observations: formData.observations,
        plan_id: formData.plan_id,
        join_date: formData.join_date,
      };

      let result;
      if (isEditing && selectedClient) {
        result = await updateClient(selectedClient.id, dataToSave);
      } else {
        result = await createClient(dataToSave);
      }

      if (result.success) {
        handleCloseDialog();
        toast.success(
          isEditing
            ? "Cliente actualizado exitosamente"
            : "Cliente creado exitosamente",
        );
      } else {
        toast.error(
          `Error al ${isEditing ? "actualizar" : "crear"} cliente: ` +
            result.error,
        );
      }
    } catch (err) {
      console.error(`Error al ${isEditing ? "actualizar" : "crear"} cliente:`, err);
      toast.error(
        `Error al ${isEditing ? "actualizar" : "crear"} cliente: ` + err.message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    setDeletingId(clientToDelete.id);
    try {
      const result = await deleteClient(clientToDelete.id);
      if (result.success) {
        toast.success("Cliente eliminado exitosamente");
        setDeleteDialogOpen(false);
        setClientToDelete(null);
      } else {
        toast.error("Error al eliminar cliente: " + result.error);
      }
    } catch (err) {
      console.error("Error deleting client:", err);
      toast.error("Error al eliminar cliente: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    // Parsear la fecha manualmente para evitar problemas de zona horaria
    // new Date("YYYY-MM-DD") se interpreta como UTC, causando desfase de 1 día
    const parts = dateString.split("-");
    const date = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    );
    return date.toLocaleDateString("es-ES");
  };

  // Lógica de filtrado
  const filteredClients = clients.filter((client) => {
    // Filtrar por término de búsqueda (nombre o cédula)
    const matchesSearch =
      searchTerm === "" ||
      client.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cedula.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtrar por plan
    const matchesPlan = selectedPlan === "" || client.plan_id === selectedPlan;

    // Filtrar por próximos pagos
    let matchesPayment = true;
    if (paymentFilter === "5days") {
      matchesPayment =
        client.daysUntilPayment !== null &&
        client.daysUntilPayment <= 5 &&
        client.daysUntilPayment >= 0;
    } else if (paymentFilter === "10days") {
      matchesPayment =
        client.daysUntilPayment !== null &&
        client.daysUntilPayment <= 10 &&
        client.daysUntilPayment >= 0;
    } else if (paymentFilter === "overdue") {
      matchesPayment =
        client.daysUntilPayment !== null && client.daysUntilPayment < 0;
    }

    return matchesSearch && matchesPlan && matchesPayment;
  });

  // Función para limpiar todos los filtros
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedPlan("");
    setPaymentFilter("");
    resetPage();
  };

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    resetPage();
  }, [searchTerm, selectedPlan, paymentFilter, resetPage]);

  // Datos paginados
  const paginatedClients = useMemo(() => {
    return paginateData(filteredClients);
  }, [filteredClients, paginateData]);

  // Contar filtros activos
  const activeFiltersCount = [searchTerm, selectedPlan, paymentFilter].filter(
    (filter) => filter !== "",
  ).length;

  if (loading || paymentsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Error: {error}</p>
            <Button onClick={refetch}>Reintentar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-4">
        <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
          <Users className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
          <span>
            Clientes ({filteredClients.length}
            {filteredClients.length !== clients.length
              ? ` de ${clients.length}`
              : ""})
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleOpenCreateDialog}
            variant="default"
            size="sm"
            className="text-xs sm:text-sm"
          >
            + Nuevo Cliente
          </Button>
          <Button onClick={refetch} variant="outline" size="sm" className="text-xs sm:text-sm" aria-label="Actualizar lista de clientes">
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" aria-hidden="true" />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Menu de mantenimiento">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mantenimiento</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => {
                toast.loading("Corrigiendo telefonos...");
                const res = await fixAllPhones();
                toast.dismiss();
                if(res.success) toast.success(`Telefonos corregidos: ${res.updated}`);
                else toast.error("Error al corregir telefonos");
              }}>
                <Phone className="mr-2 h-4 w-4" /> Corregir Telefonos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                 toast.loading("Recalculando fechas...");
                 const res = await recalculateAllNextPaymentDates();
                 toast.dismiss();
                 if(res.success) toast.success(`Fechas corregidas: ${res.updated}`);
                 else toast.error("Error al corregir fechas");
              }}>
                <CalendarClock className="mr-2 h-4 w-4" /> Corregir Fechas Pago
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {/* Barra de busqueda y filtros */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          {/* Barra de busqueda */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Buscar por nombre o cedula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
              aria-label="Buscar clientes"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              Filtros:
            </span>

            {/* Filtro por plan */}
            <Select
              value={selectedPlan}
              onValueChange={(value) =>
                setSelectedPlan(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[140px] sm:w-[180px] h-8 text-xs sm:text-sm">
                <SelectValue placeholder="Todos los planes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los planes</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtros de pago */}
            <Button
              variant={paymentFilter === "5days" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() =>
                setPaymentFilter(paymentFilter === "5days" ? "" : "5days")
              }
            >
              5d
            </Button>
            <Button
              variant={paymentFilter === "10days" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() =>
                setPaymentFilter(paymentFilter === "10days" ? "" : "10days")
              }
            >
              10d
            </Button>
            <Button
              variant={paymentFilter === "overdue" ? "destructive" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() =>
                setPaymentFilter(paymentFilter === "overdue" ? "" : "overdue")
              }
            >
              Vencidos
            </Button>

            {/* Boton para limpiar filtros */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                <FilterXIcon className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Limpiar ({activeFiltersCount})
              </Button>
            )}
          </div>

          {/* Indicador de resultados */}
          {filteredClients.length !== clients.length && (
            <div className="text-xs sm:text-sm text-muted-foreground">
              Mostrando {filteredClients.length} de {clients.length} clientes
            </div>
          )}
        </div>

        {clients.length === 0 ? (
          <GettingStartedState
            title="No hay clientes registrados"
            steps={[
              'Haz clic en "+ Nuevo Cliente"',
              "Completa el formulario con los datos del cliente",
              "Selecciona un plan para el cliente",
            ]}
            action={{
              label: "Nuevo Cliente",
              onClick: handleOpenCreateDialog,
            }}
          />
        ) : filteredClients.length === 0 ? (
          <SearchEmptyState
            searchTerm={searchTerm}
            entityName="clientes"
            onClear={clearFilters}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table aria-label="Lista de clientes del gimnasio">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Cédula
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Email
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Teléfono
                    </TableHead>
                    {/* <TableHead className="hidden xl:table-cell">
                    Dirección
                  </TableHead> */}
                    <TableHead className="hidden xl:table-cell">
                      Observaciones
                    </TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Ingreso
                    </TableHead>
                    <TableHead>Próx. Pago</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClients.map((client, index) => {
                    const paymentStatus = calculatePaymentStatus(client);
                    const paymentWithRemaining =
                      getPaymentWithRemaining(client);
                    const hasPendingPayment =
                      client.plan_id && !paymentStatus.isFullyPaid;
                    // Calcular el índice real considerando la paginación
                    const realIndex = (currentPage - 1) * pageSize + index + 1;

                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium text-center">
                          {realIndex}
                        </TableCell>
                        <TableCell>
                          <TruncatedCell
                            value={`${client.first_name} ${client.last_name}`}
                            maxWidth="150px"
                            className="font-medium"
                          />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <IdCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span>{client.cedula}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <TruncatedCell
                            value={client.email}
                            maxWidth="160px"
                            fallback="N/A"
                          />
                        </TableCell>
                        <TableCell className="hidden md:table-cell whitespace-nowrap">
                          {client.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span>{client.phone}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        {/* <TableCell className="hidden xl:table-cell">
                        <TruncatedCell
                          value={client.address}
                          maxWidth="150px"
                          fallback="N/A"
                        />
                      </TableCell> */}
                        <TableCell className="hidden xl:table-cell">
                          <TruncatedCell
                            value={client.observations}
                            maxWidth="120px"
                            className="italic"
                            fallback="N/A"
                          />
                        </TableCell>
                        <TableCell>
                          <TruncatedCell
                            value={client.plans?.name || "Sin plan"}
                            maxWidth="100px"
                            className="font-medium"
                          />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell whitespace-nowrap">
                          {formatDate(client.join_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {client.next_payment_date ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {formatDate(client.next_payment_date)}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${client.paymentStatusColor}`}
                              >
                                {client.daysUntilPayment < 0
                                  ? `${Math.abs(client.daysUntilPayment)}d vencido`
                                  : `${client.daysUntilPayment}d`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() =>
                                    handlePayRemainingForClient(client)
                                  }
                                  variant="default"
                                  size="icon-sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  disabled={!hasPendingPayment}
                                  aria-label={`Registrar pago de ${client.first_name} ${client.last_name}`}
                                >
                                  <DollarSignIcon />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {paymentWithRemaining
                                    ? `Pagar restante ($${paymentWithRemaining.remainingFormatted})`
                                    : "Registrar pago"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handleOpenEditDialog(client)}
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={`Editar cliente ${client.first_name} ${client.last_name}`}
                                >
                                  <EditIcon />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Editar cliente</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handleDeleteClick(client)}
                                  variant="destructive"
                                  size="icon-sm"
                                  disabled={deletingId === client.id}
                                  aria-label={`Eliminar cliente ${client.first_name} ${client.last_name}`}
                                >
                                  {deletingId === client.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <TrashIcon />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Eliminar cliente</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            <Pagination
              currentPage={currentPage}
              totalItems={filteredClients.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </CardContent>

      {/* Dialog de confirmación de eliminación */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar cliente"
        description={
          clientToDelete
            ? `¿Estás seguro de que deseas eliminar a ${clientToDelete.first_name} ${clientToDelete.last_name}? Esta acción eliminará también todos sus pagos y registros de asistencia.`
            : "¿Estás seguro de que deseas eliminar este cliente?"
        }
        confirmText="Eliminar"
        variant="destructive"
        loading={deletingId !== null}
        onConfirm={handleDeleteClient}
        onCancel={() => setClientToDelete(null)}
      />

      {/* Modal para crear/editar cliente */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" aria-hidden="true" />
              {isEditing ? "Editar Cliente" : "Nuevo Cliente"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modifica los datos del cliente."
                : "Completa el formulario para registrar un nuevo cliente."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="first_name"
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                placeholder="Juan"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">
                Apellido <span className="text-destructive">*</span>
              </Label>
              <Input
                id="last_name"
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                placeholder="Pérez"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cedula">
                Cédula <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-1">
                <Select
                  value={formData.cedula_type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, cedula_type: value }))
                  }
                >
                  <SelectTrigger
                    className="w-[70px] flex-shrink-0"
                    aria-label="Tipo de documento"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="font-medium">{type.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="cedula"
                  type="text"
                  name="cedula"
                  value={formData.cedula}
                  onChange={handleInputChange}
                  placeholder="12345678"
                  required
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                V: Venezolano, E: Extranjero, J: Jurídico, P: Pasaporte
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth_date">
                Fecha de Nacimiento <span className="text-destructive">*</span>
              </Label>
              <Input
                id="birth_date"
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="cliente@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <div className="flex gap-1">
                <Select
                  value={formData.phone_operator}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone_operator: value,
                    }))
                  }
                >
                  <SelectTrigger
                    className="w-[90px] flex-shrink-0"
                    aria-label="Operador telefónico"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHONE_OPERATORS.map((op) => (
                      <SelectItem key={op.code} value={op.code}>
                        <span className="font-medium">{op.code}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="1234567"
                  maxLength={7}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Movistar: 0414/0424, Movilnet: 0416/0426, Digitel: 0412
              </p>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Calle Principal #123"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="observations">Observaciones</Label>
              <Textarea
                id="observations"
                name="observations"
                value={formData.observations}
                onChange={handleInputChange}
                rows={3}
                placeholder="Notas adicionales, alergias, condiciones médicas, preferencias, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan_id">Plan</Label>
              <Select
                value={formData.plan_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, plan_id: value }))
                }
                disabled={plansLoading}
              >
                <SelectTrigger id="plan_id">
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="join_date">
                Fecha de Ingreso <span className="text-destructive">*</span>
              </Label>
              <Input
                id="join_date"
                type="date"
                name="join_date"
                value={formData.join_date}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || plansLoading}
              loading={isSubmitting}
            >
              {isEditing ? "Actualizar Cliente" : "Guardar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
