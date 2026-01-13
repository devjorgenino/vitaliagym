import React, { useState } from "react";
import { usePlans } from "../../hooks/usePlans";
import { useExchangeRate } from "../../hooks/useExchangeRate";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { EditIcon, TrashIcon } from "../ui/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export function PlansTable() {
  const { plans, loading, error, refetch, createPlan, updatePlan, deletePlan } =
    usePlans();
  
  const { formatMultiCurrency, loading: rateLoading } = useExchangeRate();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [editingPlan, setEditingPlan] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    price: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreatePlan = async () => {
    if (!formData.name.trim() || !formData.price || parseFloat(formData.price) <= 0) {
      toast.error("El nombre y el precio del plan son obligatorios");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createPlan(formData);

      if (result.success) {
        setFormData({ name: "", description: "", price: "" });
        setShowCreateForm(false);
        toast.success("Plan creado exitosamente");
      } else {
        toast.error("Error al crear plan: " + result.error);
      }
    } catch (err) {
      console.error("Error al crear plan:", err);
      toast.error("Error al crear plan: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setEditFormData({
      name: plan.name || "",
      description: plan.description || "",
      price: plan.price || "",
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

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;

    setIsUpdating(true);
    try {
      const result = await updatePlan(editingPlan.id, editFormData);

      if (result.success) {
        setEditingPlan(null);
        setShowEditForm(false);
setEditFormData({ name: "", description: "", price: "" });
        toast.success("Plan actualizado exitosamente");
      } else {
        toast.error("Error al actualizar plan: " + result.error);
      }
    } catch (err) {
      console.error("Error al actualizar plan:", err);
      toast.error("Error al actualizar plan: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setShowEditForm(false);
    setEditFormData({ name: "", description: "", price: "" });
  };

  const handleDeletePlan = async (planId) => {
    setDeletingId(planId);
    try {
      const result = await deletePlan(planId);
      if (result.success) {
        toast.success("Plan eliminado exitosamente");
      } else {
        toast.error("Error al eliminar plan: " + result.error);
      }
    } catch (err) {
      console.error("Error deleting plan:", err);
      toast.error("Error al eliminar plan: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Planes</CardTitle>
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
          <CardTitle>Planes</CardTitle>
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
        <CardTitle>Planes ({plans.length})</CardTitle>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            variant="default"
            size="sm"
          >
            {showCreateForm ? "Cancelar" : "+ Nuevo Plan"}
          </Button>
          <Button onClick={refetch} variant="outline" size="sm">
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showEditForm && (
          <div className="mb-6 p-4 border rounded-lg bg-blue-50">
            <h3 className="text-lg font-semibold mb-4">Editar Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Nombre del Plan
                </label>
                <input
                  type="text"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Plan Mensual"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Precio (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="price"
                  value={editFormData.price}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Descripción
                </label>
                <textarea
                  name="description"
                  value={editFormData.description}
                  onChange={handleEditInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Detalles del plan, beneficios, etc."
                />
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <Button
                onClick={handleUpdatePlan}
                disabled={isUpdating}
                variant="default"
                size="sm"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Actualizar Plan"
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
            <h3 className="text-lg font-semibold mb-4">Crear Nuevo Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Nombre del Plan
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Plan Mensual"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Precio (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Descripción
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Detalles del plan, beneficios, etc."
                />
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <Button
                onClick={handleCreatePlan}
                disabled={isCreating}
                variant="default"
                size="sm"
              >
                {isCreating ? "Guardando..." : "Guardar Plan"}
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

        {plans.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No hay planes registrados
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <h4 className="font-semibold text-blue-900 mb-2">
                📋 Para empezar:
              </h4>
              <ol className="text-sm text-blue-800 text-left space-y-1">
                <li>Haz clic en "+ Nuevo Plan"</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan, index) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium text-center">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {plan.name || "Sin nombre"}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={plan.description}>
                      {plan.description || "Sin descripción"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {rateLoading ? (
                      "Cargando..."
                    ) : (
                      <div className="text-sm">
                        <div className="font-medium">
                          {formatMultiCurrency(parseFloat(plan.price) || 0).usd}
                        </div>
                        <div className="text-muted-foreground">
                          {formatMultiCurrency(parseFloat(plan.price) || 0).bs}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(plan.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => handleEditPlan(plan)}
                            variant="outline"
                            size="icon-sm"
                          >
                            <EditIcon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Editar plan</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                             onClick={() => handleDeletePlan(plan.id)}
                             variant="destructive"
                             size="icon-sm"
                             disabled={deletingId === plan.id}
                           >
                             {deletingId === plan.id ? (
                               <Loader2 className="h-4 w-4 animate-spin" />
                             ) : (
                               <TrashIcon />
                             )}
                           </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Eliminar plan</p>
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
  );
}
