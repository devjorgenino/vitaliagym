"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import useExpenses from "@/hooks/useExpenses";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { VENEZUELAN_BANKS } from "@/lib/venezuelanData";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { PERMISSIONS } from "@/components/context/PermissionsProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import {
  Receipt,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  TrendingDown,
  Building2,
  Filter,
  Zap,
  Wrench,
  Package,
  Dumbbell,
  Megaphone,
  Building,
  Shield,
  FileText,
  MoreHorizontal as More,
} from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  paid: { label: "Pagado", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const CATEGORY_ICONS = {
  Servicios: Zap,
  Mantenimiento: Wrench,
  Suministros: Package,
  Equipamiento: Dumbbell,
  Marketing: Megaphone,
  Alquiler: Building,
  Seguros: Shield,
  Impuestos: FileText,
  Otros: More,
};

const PAYMENT_METHODS = {
  cash: "Efectivo",
  transfer: "Transferencia",
  mobile_payment: "Pago Móvil",
};

const initialFormData = {
  category: "",
  subcategory: "",
  description: "",
  amount: "",
  exchange_rate: "",
  amount_bs: "",
  expense_date: new Date().toISOString().split("T")[0],
  payment_method: "cash",
  bank_name: "",
  reference: "",
  vendor: "",
  status: "paid",
  notes: "",
};

export default function ExpensesTable() {
  const {
    expenses,
    categories,
    loading,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseStats,
  } = useExpenses();
  const { rate } = useExchangeRate();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, expense: null });

  const stats = getExpenseStats();

  // Filtrar gastos
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchesSearch =
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || e.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [expenses, searchTerm, categoryFilter, statusFilter]);

  // Categorías únicas para el filtro
  const uniqueCategories = useMemo(() => {
    return [...new Set(expenses.map((e) => e.category))].sort();
  }, [expenses]);

  // Top categorías por gasto
  const topCategories = useMemo(() => {
    return Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [stats.byCategory]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      if (name === "exchange_rate" || name === "amount") {
        const amount = parseFloat(name === "amount" ? value : prev.amount) || 0;
        const exchangeRate = parseFloat(name === "exchange_rate" ? value : prev.exchange_rate) || 0;
        
        if (amount > 0 && exchangeRate > 0) {
          updated.amount_bs = (amount * exchangeRate).toFixed(2);
        }
      }
      return updated;
    });
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      ...initialFormData,
      exchange_rate: rate ? rate.toFixed(2) : "",
    });
    setSelectedExpense(null);
    setIsEditing(false);
  };

  const handleOpenDialog = (expense = null) => {
    if (expense) {
      const exchangeRate = expense.exchange_rate ? parseFloat(expense.exchange_rate) : (rate || 0);
      const amount = parseFloat(expense.amount) || 0;
      const amountBs = expense.amount_bs 
        ? expense.amount_bs.toString() 
        : (amount > 0 && exchangeRate > 0 ? (amount * exchangeRate).toFixed(2) : "");
      
      setFormData({
        category: expense.category,
        subcategory: expense.subcategory || "",
        description: expense.description,
        amount: expense.amount?.toString() || "",
        exchange_rate: expense.exchange_rate?.toString() || (rate ? rate.toFixed(2) : ""),
        amount_bs: amountBs,
        expense_date: expense.expense_date,
        payment_method: expense.payment_method,
        bank_name: expense.bank_name || "",
        reference: expense.reference || "",
        vendor: expense.vendor || "",
        status: expense.status,
        notes: expense.notes || "",
      });
      setSelectedExpense(expense);
      setIsEditing(true);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const dataToSend = {
        category: formData.category,
        subcategory: formData.subcategory || "",
        description: formData.description,
        amount: parseFloat(formData.amount) || 0,
        exchange_rate: parseFloat(formData.exchange_rate) || rate || 0,
        amount_bs: parseFloat(formData.amount_bs) || 0,
        expense_date: formData.expense_date,
        payment_method: formData.payment_method,
        bank_name: formData.bank_name || "",
        reference: formData.reference || "",
        vendor: formData.vendor || "",
        status: formData.status,
        notes: formData.notes || "",
      };

      if (isEditing && selectedExpense) {
        const { error } = await updateExpense(selectedExpense.id, dataToSend);
        if (error) throw new Error(error);
        toast.success("Gasto actualizado correctamente");
      } else {
        const { error } = await createExpense(dataToSend);
        if (error) throw new Error(error);
        toast.success("Gasto registrado correctamente");
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.expense) return;

    try {
      const { error } = await deleteExpense(deleteConfirm.expense.id);
      if (error) throw new Error(error);
      toast.success("Gasto eliminado correctamente");
    } catch (err) {
      toast.error(err.message || "Error al eliminar");
    } finally {
      setDeleteConfirm({ open: false, expense: null });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="px-4 sm:px-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Gastos Operativos
              </h2>
              <p className="text-sm text-muted-foreground">
                Registra y gestiona todos los gastos del gimnasio.
              </p>
            </div>
            <PermissionGate permission={PERMISSIONS.ADMIN_EXPENSES_CREATE}>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Gasto
              </Button>
            </PermissionGate>
          </div>
        </div>
        <div className="px-4 sm:px-6">
          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Receipt className="h-4 w-4" />
                Total Gastos
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <TrendingDown className="h-4 w-4" />
                Monto Total
              </div>
              <p className="text-lg font-bold mt-1 text-red-700 dark:text-red-300">
                {formatCurrency(stats.totalAmount)}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 col-span-2">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm mb-2">
                <Building2 className="h-4 w-4" />
                Top Categorías
              </div>
              <div className="flex flex-wrap gap-2">
                {topCategories.map(([category, amount]) => {
                  const Icon = CATEGORY_ICONS[category] || Receipt;
                  return (
                    <Badge key={category} variant="secondary" className="gap-1">
                      <Icon className="h-3 w-3" />
                      {category}: {formatCurrency(amount)}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descripción, proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {uniqueCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          {filteredExpenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No hay gastos registrados"
              description={
                searchTerm || categoryFilter !== "all" || statusFilter !== "all"
                  ? "No se encontraron resultados con los filtros aplicados."
                  : "Comienza registrando tu primer gasto."
              }
              action={
                !searchTerm && categoryFilter === "all" && statusFilter === "all" && (
                  <PermissionGate permission={PERMISSIONS.ADMIN_EXPENSES_CREATE}>
                    <Button onClick={() => handleOpenDialog()} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Registrar Gasto
                    </Button>
                  </PermissionGate>
                )
              }
            />
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table aria-label="Lista de gastos operativos">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="hidden md:table-cell">Proveedor</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => {
                    const CategoryIcon = CATEGORY_ICONS[expense.category] || Receipt;
                    return (
                      <TableRow key={expense.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(expense.expense_date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <CategoryIcon className="h-3 w-3" />
                            {expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TruncatedCell 
                            value={expense.description}
                            maxWidth="200px"
                            className="font-medium"
                          />
                          {expense.subcategory && (
                            <p className="text-xs text-muted-foreground">
                              {expense.subcategory}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <TruncatedCell 
                            value={expense.vendor}
                            maxWidth="120px"
                            className="text-sm text-muted-foreground"
                            fallback="-"
                          />
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={STATUS_CONFIG[expense.status]?.color}>
                            {STATUS_CONFIG[expense.status]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <PermissionGate permission={PERMISSIONS.ADMIN_EXPENSES_EDIT}>
                                <DropdownMenuItem onClick={() => handleOpenDialog(expense)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                              </PermissionGate>
                              <DropdownMenuSeparator />
                              <PermissionGate permission={PERMISSIONS.ADMIN_EXPENSES_DELETE}>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteConfirm({ open: true, expense })}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </PermissionGate>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      {/* Dialog para crear/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Gasto" : "Nuevo Gasto"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modifica la información del gasto."
                : "Registra un nuevo gasto operativo."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => handleSelectChange("category", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Subcategoría</Label>
                  <Input
                    id="subcategory"
                    name="subcategory"
                    value={formData.subcategory}
                    onChange={handleInputChange}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe el gasto..."
                  rows={2}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Monto (USD) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={handleInputChange}
                      required
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense_date">Fecha *</Label>
                  <Input
                    id="expense_date"
                    name="expense_date"
                    type="date"
                    value={formData.expense_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exchange_rate">Tasa del Día (Bs)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Bs</span>
                    <Input
                      id="exchange_rate"
                      name="exchange_rate"
                      type="number"
                      step="0.01"
                      value={formData.exchange_rate}
                      onChange={handleInputChange}
                      className="pl-10"
                      placeholder={rate?.toString() || "0.00"}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount_bs">Monto en Bs</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Bs</span>
                    <Input
                      id="amount_bs"
                      name="amount_bs"
                      type="number"
                      step="0.01"
                      value={formData.amount_bs}
                      onChange={handleInputChange}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Método de Pago</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => handleSelectChange("payment_method", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleSelectChange("status", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bank selection - shown for transfer or mobile payment */}
              {(formData.payment_method === "transfer" || formData.payment_method === "mobile_payment") && (
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Banco</Label>
                  <Select
                    value={formData.bank_name}
                    onValueChange={(value) => handleSelectChange("bank_name", value)}
                  >
                    <SelectTrigger id="bank_name" className="w-full">
                      <SelectValue placeholder="Seleccionar banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {VENEZUELAN_BANKS.map((bank) => (
                        <SelectItem key={bank.code} value={bank.name}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{bank.shortName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor">Proveedor</Label>
                  <Input
                    id="vendor"
                    name="vendor"
                    value={formData.vendor}
                    onChange={handleInputChange}
                    placeholder="Nombre del proveedor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Referencia</Label>
                  <Input
                    id="reference"
                    name="reference"
                    value={formData.reference}
                    onChange={handleInputChange}
                    placeholder="N° factura, recibo..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Notas adicionales..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : isEditing ? "Guardar Cambios" : "Registrar Gasto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, expense: open ? deleteConfirm.expense : null })}
        title="Eliminar Gasto"
        description="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
