import React, { useState, useEffect, useMemo } from "react";
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
import { Loader2, IdCard, Phone } from "lucide-react";
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
  } = useClients();

  const { plans, loading: plansLoading } = usePlans();
  const { payments, loading: paymentsLoading } = usePayments();
  const { formatMultiCurrency, loading: rateLoading } = useExchangeRate();

  const [showCreateForm, setShowCreateForm] = useState(false);
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
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  const [editingClient, setEditingClient] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
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
    join_date: "",
  });

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

  const handleCreateClient = async () => {
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

    setIsCreating(true);
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

      const result = await createClient(dataToSave);

      if (result.success) {
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
        setShowCreateForm(false);
        toast.success("Cliente creado exitosamente");
      } else {
        toast.error("Error al crear cliente: " + result.error);
      }
    } catch (err) {
      console.error("Error al crear cliente:", err);
      toast.error("Error al crear cliente: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    // Parse cedula to separate type and number
    const { type, number } = parseCedula(client.cedula || "");
    // Parse phone to separate operator and number
    const { operator, number: phoneNumber } = parsePhone(client.phone || "");
    setEditFormData({
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
    setShowEditForm(true);
    setShowCreateForm(false);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;

    // Máscara para teléfono: solo números, max 7 dígitos
    if (name === "phone") {
      const cleanValue = value.replace(/\D/g, "").slice(0, 7);
      setEditFormData((prev) => ({
        ...prev,
        [name]: cleanValue,
      }));
      return;
    }

    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateClient = async () => {
    if (!editingClient) return;

    setIsUpdatingClient(true);
    try {
      // Format cedula with type prefix before saving
      // Format phone with operator prefix before saving
      const dataToSave = {
        first_name: editFormData.first_name,
        last_name: editFormData.last_name,
        cedula: formatCedula(editFormData.cedula_type, editFormData.cedula),
        birth_date: editFormData.birth_date,
        email: editFormData.email,
        phone: editFormData.phone
          ? formatPhone(editFormData.phone_operator, editFormData.phone)
          : "",
        address: editFormData.address,
        observations: editFormData.observations,
        plan_id: editFormData.plan_id,
        join_date: editFormData.join_date,
      };

      const result = await updateClient(editingClient.id, dataToSave);

      if (result.success) {
        setEditingClient(null);
        setShowEditForm(false);
        setEditFormData({
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
          join_date: "",
        });
        toast.success("Cliente actualizado exitosamente");
      } else {
        toast.error("Error al actualizar cliente: " + result.error);
      }
    } catch (err) {
      console.error("Error al actualizar cliente:", err);
      toast.error("Error al actualizar cliente: " + err.message);
    } finally {
      setIsUpdatingClient(false);
    }
  };

  const cancelEdit = () => {
    setEditingClient(null);
    setShowEditForm(false);
    setEditFormData({
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
      join_date: "",
    });
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>
          Clientes ({filteredClients.length}
          {filteredClients.length !== clients.length
            ? ` de ${clients.length}`
            : ""}
          )
        </CardTitle>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            variant="default"
            size="sm"
          >
            {showCreateForm ? "Cancelar" : "+ Nuevo Cliente"}
          </Button>
          <Button onClick={refetch} variant="outline" size="sm">
            Actualizar
          </Button>
        </div>
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground">
              Filtros:
            </span>

            {/* Filtro por plan */}
            <Select
              value={selectedPlan}
              onValueChange={(value) =>
                setSelectedPlan(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[180px] h-8 text-sm">
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
              onClick={() =>
                setPaymentFilter(paymentFilter === "5days" ? "" : "5days")
              }
            >
              ≤ 5 días
            </Button>
            <Button
              variant={paymentFilter === "10days" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setPaymentFilter(paymentFilter === "10days" ? "" : "10days")
              }
            >
              ≤ 10 días
            </Button>
            <Button
              variant={paymentFilter === "overdue" ? "destructive" : "outline"}
              size="sm"
              onClick={() =>
                setPaymentFilter(paymentFilter === "overdue" ? "" : "overdue")
              }
            >
              Vencidos
            </Button>

            {/* Botón para limpiar filtros */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <FilterXIcon className="h-4 w-4 mr-1" />
                Limpiar ({activeFiltersCount})
              </Button>
            )}
          </div>

          {/* Indicador de resultados */}
          {filteredClients.length !== clients.length && (
            <div className="text-sm text-muted-foreground">
              Mostrando {filteredClients.length} de {clients.length} clientes
            </div>
          )}
        </div>

        {showEditForm && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-semibold mb-4">Editar Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_first_name">Nombre</Label>
                <Input
                  id="edit_first_name"
                  type="text"
                  name="first_name"
                  value={editFormData.first_name}
                  onChange={handleEditInputChange}
                  placeholder="Juan"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_last_name">Apellido</Label>
                <Input
                  id="edit_last_name"
                  type="text"
                  name="last_name"
                  value={editFormData.last_name}
                  onChange={handleEditInputChange}
                  placeholder="Pérez"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_cedula">
                  Cédula <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-1">
                  <Select
                    value={editFormData.cedula_type}
                    onValueChange={(value) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        cedula_type: value,
                      }))
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
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{type.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="edit_cedula"
                    type="text"
                    name="cedula"
                    value={editFormData.cedula}
                    onChange={handleEditInputChange}
                    placeholder="12345678"
                    required
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_birth_date">Fecha de Nacimiento</Label>
                <Input
                  id="edit_birth_date"
                  type="date"
                  name="birth_date"
                  value={editFormData.birth_date}
                  onChange={handleEditInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_email">Email</Label>
                <Input
                  id="edit_email"
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  placeholder="cliente@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_phone">Teléfono</Label>
                <div className="flex gap-1">
                  <Select
                    value={editFormData.phone_operator}
                    onValueChange={(value) =>
                      setEditFormData((prev) => ({
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
                    id="edit_phone"
                    type="tel"
                    name="phone"
                    value={editFormData.phone}
                    onChange={handleEditInputChange}
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
                <Label htmlFor="edit_address">Dirección</Label>
                <Input
                  id="edit_address"
                  type="text"
                  name="address"
                  value={editFormData.address}
                  onChange={handleEditInputChange}
                  placeholder="Calle Principal #123"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="edit_observations">Observaciones</Label>
                <Textarea
                  id="edit_observations"
                  name="observations"
                  value={editFormData.observations}
                  onChange={handleEditInputChange}
                  rows={3}
                  placeholder="Notas adicionales, alergias, condiciones médicas, preferencias, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_plan_id">Plan</Label>
                <Select
                  value={editFormData.plan_id}
                  onValueChange={(value) =>
                    setEditFormData((prev) => ({ ...prev, plan_id: value }))
                  }
                >
                  <SelectTrigger id="edit_plan_id">
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
                <Label htmlFor="edit_join_date">Fecha de Ingreso</Label>
                <Input
                  id="edit_join_date"
                  type="date"
                  name="join_date"
                  value={editFormData.join_date}
                  onChange={handleEditInputChange}
                  required
                />
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <Button
                onClick={handleUpdateClient}
                disabled={isUpdatingClient}
                variant="default"
                size="sm"
              >
                {isUpdatingClient ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Actualizar Cliente"
                )}
              </Button>
              <Button onClick={cancelEdit} variant="outline" size="sm">
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {showCreateForm && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-semibold mb-4">Crear Nuevo Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create_first_name">Nombre</Label>
                <Input
                  id="create_first_name"
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="Juan"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_last_name">Apellido</Label>
                <Input
                  id="create_last_name"
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Pérez"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_cedula">
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
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{type.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="create_cedula"
                    type="text"
                    name="cedula"
                    value={formData.cedula}
                    onChange={handleInputChange}
                    placeholder="12345678"
                    required
                    className="flex-1"
                    aria-describedby="cedula-hint"
                  />
                </div>
                <p id="cedula-hint" className="text-xs text-muted-foreground">
                  V: Venezolano, E: Extranjero, J: Jurídico, P: Pasaporte
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_birth_date">Fecha de Nacimiento</Label>
                <Input
                  id="create_birth_date"
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_email">Email</Label>
                <Input
                  id="create_email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="cliente@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_phone">Teléfono</Label>
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
                    id="create_phone"
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
                <Label htmlFor="create_address">Dirección</Label>
                <Input
                  id="create_address"
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Calle Principal #123"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="create_observations">Observaciones</Label>
                <Textarea
                  id="create_observations"
                  name="observations"
                  value={formData.observations}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Notas adicionales, alergias, condiciones médicas, preferencias, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_plan_id">Plan</Label>
                <Select
                  value={formData.plan_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, plan_id: value }))
                  }
                  disabled={plansLoading}
                >
                  <SelectTrigger id="create_plan_id">
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
                <Label htmlFor="create_join_date">Fecha de Ingreso</Label>
                <Input
                  id="create_join_date"
                  type="date"
                  name="join_date"
                  value={formData.join_date}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <Button
                onClick={handleCreateClient}
                disabled={isCreating || plansLoading}
                variant="default"
                size="sm"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cliente"
                )}
              </Button>
              <Button
                onClick={() => setShowCreateForm(false)}
                variant="outline"
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

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
              onClick: () => setShowCreateForm(true),
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
                                  onClick={() => handleEditClient(client)}
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
    </Card>
  );
}
