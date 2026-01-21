import React, { useState } from "react";
import { usePlans } from "../../hooks/usePlans";
import { useExchangeRate } from "../../hooks/useExchangeRate";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { EditIcon, TrashIcon } from "../ui/icons";
import { TruncatedCell } from "../ui/truncated-cell";
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
  const [deleteDialog, setDeleteDialog] = useState({ open: false, plan: null });
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (
      !formData.name.trim() ||
      !formData.price ||
      parseFloat(formData.price) <= 0
    ) {
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

  const openDeleteDialog = (plan) => {
    setDeleteDialog({ open: true, plan });
  };

  const handleDeletePlan = async () => {
    if (!deleteDialog.plan) return;

    setIsDeleting(true);
    try {
      const result = await deletePlan(deleteDialog.plan.id);
      if (result.success) {
        toast.success("Plan eliminado exitosamente");
        setDeleteDialog({ open: false, plan: null });
      } else {
        toast.error("Error al eliminar plan: " + result.error);
      }
    } catch (err) {
      console.error("Error deleting plan:", err);
      toast.error("Error al eliminar plan: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    // Si es solo fecha (YYYY-MM-DD), parsear manualmente para evitar desfase de zona horaria
    // Si incluye hora (ISO timestamp), usar new Date() normalmente
    let date;
    if (dateString.length === 10 && dateString.includes("-")) {
      const parts = dateString.split("-");
      date = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
      );
    } else {
      date = new Date(dateString);
    }
    return date.toLocaleDateString("es-ES", {
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
          <CardDescription>
            Gestiona los planes de membresía del gimnasio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2" role="status" aria-label="Cargando planes">
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
          <div className="text-center py-8" role="alert">
            <p className="text-destructive mb-4">Error: {error}</p>
            <Button onClick={refetch} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle>Planes ({plans.length})</CardTitle>
            <CardDescription>
              Configura los planes de membresía disponibles para tus clientes
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                if (showEditForm) cancelEdit();
              }}
              variant={showCreateForm ? "outline" : "default"}
              size="sm"
              className="gap-2"
            >
              {showCreateForm ? (
                <>
                  <X className="h-4 w-4" />
                  Cancelar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Nuevo Plan
                </>
              )}
            </Button>
            <Button
              onClick={refetch}
              variant="outline"
              size="sm"
              className="gap-2"
              aria-label="Actualizar lista de planes"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Formulario de Edición */}
          {showEditForm && (
            <div
              className="mb-6 p-4 border rounded-lg bg-muted/50"
              role="form"
              aria-labelledby="edit-form-title"
            >
              <h3 id="edit-form-title" className="text-lg font-semibold mb-4">
                Editar Plan: {editingPlan?.name}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="edit-name">
                    Nombre del Plan <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditInputChange}
                    placeholder="Ej: Plan Mensual"
                    required
                    aria-required="true"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-price">
                    Precio (USD) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    value={editFormData.price}
                    onChange={handleEditInputChange}
                    placeholder="0.00"
                    required
                    aria-required="true"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="edit-description">
                    Descripción{" "}
                    <span className="text-muted-foreground text-xs">
                      (opcional)
                    </span>
                  </Label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    value={editFormData.description}
                    onChange={handleEditInputChange}
                    rows={3}
                    placeholder="Detalles del plan, beneficios, duración, etc."
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleUpdatePlan}
                  disabled={isUpdating}
                  size="sm"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    "Guardar Cambios"
                  )}
                </Button>
                <Button onClick={cancelEdit} variant="outline" size="sm">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Formulario de Creación */}
          {showCreateForm && (
            <div
              className="mb-6 p-4 border rounded-lg bg-muted/50"
              role="form"
              aria-labelledby="create-form-title"
            >
              <h3 id="create-form-title" className="text-lg font-semibold mb-4">
                Crear Nuevo Plan
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Define un nuevo plan de membresía con su nombre, precio y
                descripción.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="create-name">
                    Nombre del Plan <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="create-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ej: Plan Mensual, Plan Trimestral, Plan Anual"
                    required
                    aria-required="true"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-price">
                    Precio (USD) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="create-price"
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    required
                    aria-required="true"
                  />
                  <p className="text-xs text-muted-foreground">
                    El precio se mostrará en USD y Bs automáticamente
                  </p>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="create-description">
                    Descripción{" "}
                    <span className="text-muted-foreground text-xs">
                      (opcional)
                    </span>
                  </Label>
                  <Textarea
                    id="create-description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Describe los beneficios del plan, duración, acceso a instalaciones, etc."
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleCreatePlan}
                  disabled={isCreating}
                  size="sm"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Crear Plan"
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

          {/* Estado vacío o tabla */}
          {plans.length === 0 ? (
            <EmptyState
              icon="plans"
              title="No hay planes registrados"
              description="Los planes definen las opciones de membresía que ofreces a tus clientes. Crea tu primer plan para comenzar a registrar pagos."
              action={{
                label: "Crear Primer Plan",
                onClick: () => setShowCreateForm(true),
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label="Lista de planes del gimnasio">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" scope="col">
                      #
                    </TableHead>
                    <TableHead scope="col">Nombre</TableHead>
                    <TableHead className="hidden md:table-cell" scope="col">
                      Descripción
                    </TableHead>
                    <TableHead scope="col">Precio</TableHead>
                    <TableHead className="hidden lg:table-cell" scope="col">
                      Creado
                    </TableHead>
                    <TableHead scope="col" className="w-[100px]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan, index) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium text-center">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        <TruncatedCell
                          value={plan.name}
                          maxWidth="140px"
                          fallback="Sin nombre"
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <TruncatedCell
                          value={plan.description}
                          maxWidth="180px"
                          className="italic"
                          fallback="Sin descripción"
                        />
                      </TableCell>
                      <TableCell>
                        {rateLoading ? (
                          <Skeleton className="h-8 w-20" />
                        ) : (
                          <div className="text-sm">
                            <div className="font-medium">
                              {
                                formatMultiCurrency(parseFloat(plan.price) || 0)
                                  .usd
                              }
                            </div>
                            <div className="text-muted-foreground">
                              {
                                formatMultiCurrency(parseFloat(plan.price) || 0)
                                  .bs
                              }
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(plan.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={() => handleEditPlan(plan)}
                                variant="outline"
                                size="icon-sm"
                                aria-label={`Editar plan ${plan.name}`}
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
                                onClick={() => openDeleteDialog(plan)}
                                variant="destructive"
                                size="icon-sm"
                                aria-label={`Eliminar plan ${plan.name}`}
                              >
                                <TrashIcon />
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

      {/* Diálogo de confirmación para eliminar */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, plan: open ? deleteDialog.plan : null })
        }
        title="Eliminar Plan"
        description={
          deleteDialog.plan
            ? `¿Estás seguro de que deseas eliminar el plan "${deleteDialog.plan.name}"? Esta acción no se puede deshacer y podría afectar a los clientes que tengan este plan asignado.`
            : ""
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleDeletePlan}
      />
    </>
  );
}
