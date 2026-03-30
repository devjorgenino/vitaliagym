import React, { useState, useMemo, useCallback } from "react";
import { usePlans } from "../../hooks/usePlans";
import { useExchangeRate } from "../../hooks/useExchangeRate";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Dumbbell } from "lucide-react";
import { formatDate } from "@/lib/utils";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Pagination, usePagination } from "../ui/pagination";

export function PlansTable() {
  const { plans, loading, error, refetch, createPlan, updatePlan, deletePlan } =
    usePlans();

  const { formatMultiCurrency, loading: rateLoading } = useExchangeRate();

  // Estados para paginación
  const { currentPage, pageSize, setCurrentPage, setPageSize, paginateData } =
    usePagination(10);

  // Datos paginados
  const paginatedPlans = useMemo(() => {
    return paginateData(plans);
  }, [plans, paginateData]);

  // Estados del modal unificado para crear/editar
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, plan: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Resetear formulario
  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      description: "",
      price: "",
    });
    setSelectedPlan(null);
    setIsEditing(false);
  }, []);

  // Abrir modal para crear
  const handleOpenCreateDialog = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  // Abrir modal para editar
  const handleOpenEditDialog = useCallback((plan) => {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name || "",
      description: plan.description || "",
      price: plan.price?.toString() || "",
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  }, []);

  // Cerrar modal
  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    // Pequeño delay para que la animación de cierre termine antes de resetear
    setTimeout(resetForm, 150);
  }, [resetForm]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  // Submit del formulario (crear o actualizar)
  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.price || parseFloat(formData.price) <= 0) {
      toast.error("El nombre y el precio del plan son obligatorios");
      return;
    }

    setIsSubmitting(true);
    try {
      let result;
      
      if (isEditing && selectedPlan) {
        result = await updatePlan(selectedPlan.id, formData);
        if (result.success) {
          toast.success("Plan actualizado exitosamente");
          handleCloseDialog();
        } else {
          toast.error("Error al actualizar plan: " + result.error);
        }
      } else {
        result = await createPlan(formData);
        if (result.success) {
          toast.success("Plan creado exitosamente");
          handleCloseDialog();
        } else {
          toast.error("Error al crear plan: " + result.error);
        }
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error(`Error al ${isEditing ? "actualizar" : "crear"} plan: ` + err.message);
    } finally {
      setIsSubmitting(false);
    }
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

  // Obtener precio formateado
  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              Planes
            </h2>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="p-3 sm:p-4 pt-0">
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              Planes
            </h2>
          </div>
          <Button onClick={refetch} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
        <div className="p-3 sm:p-4 pt-0">
          <div className="text-center py-8" role="alert">
            <p className="text-destructive">Error: {error}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              Planes ({plans.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Configura los planes de membresía disponibles para tus clientes
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleOpenCreateDialog}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuevo Plan
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
        </div>
        <div className="p-3 sm:p-4 pt-0">
          {/* Estado vacío o tabla */}
          {plans.length === 0 ? (
            <EmptyState
              icon="plans"
              title="No hay planes registrados"
              description="Los planes definen las opciones de membresía que ofreces a tus clientes. Crea tu primer plan para comenzar a registrar pagos."
              action={{
                label: "Crear Primer Plan",
                onClick: handleOpenCreateDialog,
              }}
            />
          ) : (
            <>
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
                    {paginatedPlans.map((plan, index) => {
                      const realIndex =
                        (currentPage - 1) * pageSize + index + 1;
                      return (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium text-center">
                            {realIndex}
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
                                    formatMultiCurrency(
                                      parseFloat(plan.price) || 0,
                                    ).usd
                                  }
                                </div>
                                <div className="text-muted-foreground">
                                  {
                                    formatMultiCurrency(
                                      parseFloat(plan.price) || 0,
                                    ).bs
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
                                    onClick={() => handleOpenEditDialog(plan)}
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              <Pagination
                currentPage={currentPage}
                totalItems={plans.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
            />
          </>
        )}
        </div>
      </Card>

      {/* Modal para Crear/Editar Plan */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Dumbbell className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle>
                  {isEditing ? "Editar Plan" : "Crear Nuevo Plan"}
                </DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? `Modifica los datos del plan "${selectedPlan?.name}"`
                    : "Define un nuevo plan de membresía para tus clientes"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Nombre del Plan */}
            <div className="space-y-2">
              <Label htmlFor="plan-name">
                Nombre del Plan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="plan-name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ej: Plan Mensual, Plan Trimestral"
                autoFocus
                aria-required="true"
              />
            </div>

            {/* Precio */}
            <div className="space-y-2">
              <Label htmlFor="plan-price">
                Precio (USD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="plan-price"
                type="number"
                step="0.01"
                min="0"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="0.00"
                aria-required="true"
              />
              <p className="text-xs text-muted-foreground">
                El precio se mostrará en USD y Bs automáticamente
              </p>
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="plan-description">
                Descripción{" "}
                <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Textarea
                id="plan-description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                placeholder="Describe los beneficios del plan, duración, acceso a instalaciones, etc."
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
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {isEditing ? "Guardar Cambios" : "Crear Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
