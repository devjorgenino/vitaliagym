import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClients } from "../../hooks/useClients";
import { usePlans } from "../../hooks/usePlans";
import { usePayments } from "../../hooks/usePayments";
import { useExchangeRate } from "../../hooks/useExchangeRate";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Input } from "../ui/input";
import { EditIcon, TrashIcon, SearchIcon, FilterXIcon, DollarSignIcon } from "../ui/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

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
    cedula: "",
    birth_date: "",
    email: "",
    phone: "",
    address: "",
    observations: "",
    plan_id: "",
    join_date: new Date().toISOString().split("T")[0],
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [editingClient, setEditingClient] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    first_name: "",
    last_name: "",
    cedula: "",
    birth_date: "",
    email: "",
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
      (p) => p.client_id === client.id && p.plan_id === client.plan_id
    );

    const totalPaidSoFar = allClientPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0
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
      (p) => p.client_id === client.id && p.plan_id === client.plan_id
    );

    if (allClientPayments.length === 0) {
      return null;
    }

    const planPrice = getPlanPrice(client.plan_id);
    const totalPaid = allClientPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0
    );

    const remainingAmount = Math.max(0, planPrice - totalPaid);
    
    if (remainingAmount > 0) {
      // Encontrar el último pago para asociarlo con el saldo restante
      const lastPayment = allClientPayments.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      )[0];
      
      return {
        ...lastPayment,
        remainingAmount,
        remainingFormatted: remainingAmount.toFixed(2)
      };
    }
    
    return null;
  };

  const handlePayRemainingForClient = (client) => {
    const paymentWithRemaining = getPaymentWithRemaining(client);
    
    if (paymentWithRemaining) {
      // Redirigir a la página de pagos con parámetros específicos para el pago restante
      router.push(`/pagos/${client.id}?paymentId=${paymentWithRemaining.id}&remaining=${paymentWithRemaining.remainingAmount}&payRemaining=true`);
    } else {
      // Si no hay pago específico con saldo, redirigir a la página normal
      router.push(`/pagos/${client.id}`);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
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
        "Los campos de nombre, apellido, cédula y fecha de nacimiento son obligatorios"
      );
      return;
    }

    setIsCreating(true);
    try {
      const result = await createClient(formData);

      if (result.success) {
        setFormData({
          first_name: "",
          last_name: "",
          cedula: "",
          birth_date: "",
          email: "",
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
    setEditFormData({
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      cedula: client.cedula || "",
      birth_date: client.birth_date || "",
      email: client.email || "",
      phone: client.phone || "",
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
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateClient = async () => {
    if (!editingClient) return;

    setIsUpdatingClient(true);
    try {
      const result = await updateClient(editingClient.id, editFormData);

      if (result.success) {
        setEditingClient(null);
        setShowEditForm(false);
        setEditFormData({
          first_name: "",
          last_name: "",
          cedula: "",
          birth_date: "",
          email: "",
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
      cedula: "",
      birth_date: "",
      email: "",
      phone: "",
      address: "",
      observations: "",
      plan_id: "",
      join_date: "",
    });
  };

  const handleDeleteClient = async (clientId) => {
    setDeletingId(clientId);
    try {
      const result = await deleteClient(clientId);
      if (result.success) {
        toast.success("Cliente eliminado exitosamente");
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
    return new Date(dateString).toLocaleDateString("es-ES");
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
    const matchesPlan = 
      selectedPlan === "" ||
      client.plan_id === selectedPlan;

    // Filtrar por próximos pagos
    let matchesPayment = true;
    if (paymentFilter === "5days") {
      matchesPayment = client.daysUntilPayment !== null && client.daysUntilPayment <= 5 && client.daysUntilPayment >= 0;
    } else if (paymentFilter === "10days") {
      matchesPayment = client.daysUntilPayment !== null && client.daysUntilPayment <= 10 && client.daysUntilPayment >= 0;
    } else if (paymentFilter === "overdue") {
      matchesPayment = client.daysUntilPayment !== null && client.daysUntilPayment < 0;
    }

    return matchesSearch && matchesPlan && matchesPayment;
  });

  // Función para limpiar todos los filtros
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedPlan("");
    setPaymentFilter("");
  };

  // Contar filtros activos
  const activeFiltersCount = [searchTerm, selectedPlan, paymentFilter].filter(
    (filter) => filter !== ""
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
        <CardTitle>Clientes ({filteredClients.length}{filteredClients.length !== clients.length ? ` de ${clients.length}` : ""})</CardTitle>
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
            <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
            
            {/* Filtro por plan */}
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los planes</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>

            {/* Filtros de pago */}
            <Button
              variant={paymentFilter === "5days" ? "default" : "outline"}
              size="sm"
              onClick={() => setPaymentFilter(paymentFilter === "5days" ? "" : "5days")}
            >
              ≤ 5 días
            </Button>
            <Button
              variant={paymentFilter === "10days" ? "default" : "outline"}
              size="sm"
              onClick={() => setPaymentFilter(paymentFilter === "10days" ? "" : "10days")}
            >
              ≤ 10 días
            </Button>
            <Button
              variant={paymentFilter === "overdue" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setPaymentFilter(paymentFilter === "overdue" ? "" : "overdue")}
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
          <div className="mb-6 p-4 border rounded-lg bg-blue-50">
            <h3 className="text-lg font-semibold mb-4">Editar Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nombre</label>
                <input
                  type="text"
                  name="first_name"
                  value={editFormData.first_name}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Apellido
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={editFormData.last_name}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Pérez"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Cédula</label>
                <input
                  type="text"
                  name="cedula"
                  value={editFormData.cedula}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123456789"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  name="birth_date"
                  value={editFormData.birth_date}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="cliente@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={editFormData.phone}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1234567890"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  value={editFormData.address}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Calle Principal #123"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Observaciones
                </label>
                <textarea
                  name="observations"
                  value={editFormData.observations}
                  onChange={handleEditInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notas adicionales, alergias, condiciones médicas, preferencias, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Plan</label>
                <select
                  name="plan_id"
                  value={editFormData.plan_id}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fecha de Ingreso
                </label>
                <input
                  type="date"
                  name="join_date"
                  value={editFormData.join_date}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4">Crear Nuevo Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nombre</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Apellido
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Pérez"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Cédula</label>
                <input
                  type="text"
                  name="cedula"
                  value={formData.cedula}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123456789"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="cliente@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1234567890"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Calle Principal #123"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Observaciones
                </label>
                <textarea
                  name="observations"
                  value={formData.observations}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notas adicionales, alergias, condiciones médicas, preferencias, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Plan</label>
                <select
                  name="plan_id"
                  value={formData.plan_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={plansLoading}
                >
                  <option value="">Seleccionar plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fecha de Ingreso
                </label>
                <input
                  type="date"
                  name="join_date"
                  value={formData.join_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {filteredClients.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {clients.length === 0 
                ? "No hay clientes registrados" 
                : "No se encontraron clientes con los filtros aplicados"}
            </p>
            {clients.length === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="font-semibold text-blue-900 mb-2">
                  📋 Para empezar:
                </h4>
                <ol className="text-sm text-blue-800 text-left space-y-1">
                  <li>Haz clic en "+ Nuevo Cliente"</li>
                </ol>
              </div>
            ) : (
              <Button onClick={clearFilters} variant="outline">
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Nombre Completo</TableHead>
                  <TableHead>Cédula</TableHead>
                  {/* <TableHead>Fecha de Nacimiento</TableHead>
                  <TableHead>Edad</TableHead> */}
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Ingreso</TableHead>
                  <TableHead>Próximo Pago</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client, index) => {
                  const paymentStatus = calculatePaymentStatus(client);
                  const paymentWithRemaining = getPaymentWithRemaining(client);
                  const hasPendingPayment = client.plan_id && !paymentStatus.isFullyPaid;

                  return (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium text-center">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {client.first_name} {client.last_name}
                    </TableCell>
                    <TableCell>{client.cedula}</TableCell>
                    {/* <TableCell>{formatDate(client.birth_date)}</TableCell>
                    <TableCell>{client.age} años</TableCell> */}
                    <TableCell>{client.email || "N/A"}</TableCell>
                    <TableCell>{client.phone || "N/A"}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={client.address}>
                        {client.address || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className="max-w-xs truncate"
                        title={client.observations}
                      >
                        {client.observations || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {client.plans?.name || "Sin plan"}
                        </div>
                        {client.plans?.price && (
                          <div className="text-muted-foreground">
                            {rateLoading ? (
                              "Cargando..."
                            ) : (
                              <>
                                <div>
                                  {
                                    formatMultiCurrency(
                                      parseFloat(client.plans.price)
                                    ).usd
                                  }
                                </div>
                                <div>
                                  {
                                    formatMultiCurrency(
                                      parseFloat(client.plans.price)
                                    ).bs
                                  }
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(client.join_date)}</TableCell>
                    <TableCell>
                      {client.next_payment_date ? (
                        <div>
                          <div className="text-sm">
                            {formatDate(client.next_payment_date)}
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${client.paymentStatusColor}`}
                          >
                            {client.daysUntilPayment < 0
                              ? `${Math.abs(
                                  client.daysUntilPayment
                                )} días vencido`
                              : `${client.daysUntilPayment} días restantes`}
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
                              onClick={() => handlePayRemainingForClient(client)}
                              variant="default"
                              size="icon-sm"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={!hasPendingPayment}
                            >
                              <DollarSignIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {paymentWithRemaining 
                                ? `Pagar restante ($${paymentWithRemaining.remainingFormatted})`
                                : 'Registrar pago'
                              }
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => handleEditClient(client)}
                              variant="outline"
                              size="icon-sm"
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
                              onClick={() => handleDeleteClient(client.id)}
                              variant="destructive"
                              size="icon-sm"
                              disabled={deletingId === client.id}
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
        )}
      </CardContent>
    </Card>
  );
}
