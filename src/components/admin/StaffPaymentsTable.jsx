"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import useStaffPayments from "@/hooks/useStaffPayments";
import useStaff from "@/hooks/useStaff";
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
  Banknote,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  Calendar,
  FileText,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Receipt,
  Building2,
} from "lucide-react";
import {
  generatePaymentReceipt,
  downloadPDF,
} from "@/lib/pdfGenerator";

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  paid: { label: "Pagado", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

const PAYMENT_METHODS = {
  cash: "Efectivo Bs",
  cash_usd: "Efectivo $",
  transfer: "Transferencia",
  mobile_payment: "Pago Móvil",
};

const initialFormData = {
  staff_id: "",
  payment_date: new Date().toISOString().split("T")[0],
  period_start: "",
  period_end: "",
  base_amount: "",
  bonus: "",
  deductions: "",
  exchange_rate: "",
  amount_bs: "",
  payment_method: "transfer",
  bank_name: "",
  notes: "",
};

export default function StaffPaymentsTable() {
  const {
    payments,
    loading,
    createPayment,
    updatePayment,
    markAsPaid,
    cancelPayment,
    deletePayment,
    getPaymentStats,
  } = useStaffPayments();

  const { staff, loading: staffLoading } = useStaff();
  const { rate } = useExchangeRate();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, payment: null });
  const [markPaidDialog, setMarkPaidDialog] = useState({ open: false, payment: null, reference: "" });
  const [selectedStaffInfo, setSelectedStaffInfo] = useState(null);

  const activeStaff = useMemo(() => staff.filter((s) => s.status === "active"), [staff]);
  const stats = getPaymentStats();

  // Filtrar pagos
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const staffName = p.staff ? `${p.staff.first_name} ${p.staff.last_name}` : "";
      const matchesSearch =
        staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.staff?.position?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payments, searchTerm, statusFilter]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      if (name === "exchange_rate" || name === "base_amount" || name === "bonus" || name === "deductions") {
        const baseAmount = parseFloat(name === "base_amount" ? value : prev.base_amount) || 0;
        const bonus = parseFloat(prev.bonus) || 0;
        const deductions = parseFloat(prev.deductions) || 0;
        const totalUSD = baseAmount + bonus - deductions;
        const exchangeRate = parseFloat(name === "exchange_rate" ? value : prev.exchange_rate) || 0;
        
        if (totalUSD > 0 && exchangeRate > 0) {
          updated.amount_bs = (totalUSD * exchangeRate).toFixed(2);
        }
      }
      return updated;
    });
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      if (name === "staff_id") {
        const selectedStaff = staff.find((s) => s.id === value);
        setSelectedStaffInfo(selectedStaff || null);
        
        if (selectedStaff) {
          updated.bank_name = selectedStaff.bank_name || "";
          if (selectedStaff.payment_type === "pago_movil") {
            updated.payment_method = "mobile_payment";
          } else if (selectedStaff.payment_type === "transferencia") {
            updated.payment_method = "transfer";
          } else if (selectedStaff.payment_type === "efectivo_dolares") {
            updated.payment_method = "cash_usd";
          } else if (selectedStaff.payment_type === "efectivo_bolivares") {
            updated.payment_method = "cash";
          }
          updated.exchange_rate = rate ? rate.toFixed(2) : "";
          
          const baseAmount = parseFloat(prev.base_amount) || 0;
          if (baseAmount > 0 && rate) {
            updated.amount_bs = (baseAmount * rate).toFixed(2);
          }
        }
      }
      
      return updated;
    });
  };

  const resetForm = () => {
    setFormData({
      ...initialFormData,
      exchange_rate: rate ? rate.toFixed(2) : "",
    });
    setSelectedPayment(null);
    setIsEditing(false);
  };

  const handleOpenDialog = (payment = null) => {
    if (payment) {
      const selectedStaff = staff.find((s) => s.id === payment.staff_id);
      
      setFormData({
        staff_id: payment.staff_id,
        payment_date: payment.payment_date,
        period_start: payment.period_start,
        period_end: payment.period_end,
        base_amount: payment.base_amount?.toString() || "",
        bonus: payment.bonus?.toString() || "",
        deductions: payment.deductions?.toString() || "",
        exchange_rate: payment.exchange_rate?.toString() || (rate ? rate.toFixed(2) : ""),
        amount_bs: payment.amount_bs?.toString() || "",
        payment_method: payment.payment_method || (selectedStaff?.payment_type === "pago_movil" ? "mobile_payment" : "transfer"),
        bank_name: payment.bank_name || selectedStaff?.bank_name || "",
        payment_reference: payment.payment_reference || "",
        notes: payment.notes || "",
      });
      setSelectedPayment(payment);
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
      const baseAmount = parseFloat(formData.base_amount) || 0;
      const bonusAmount = parseFloat(formData.bonus) || 0;
      const deductionsAmount = parseFloat(formData.deductions) || 0;
      
      const dataToSend = {
        staff_id: formData.staff_id,
        payment_date: formData.payment_date,
        period_start: formData.period_start,
        period_end: formData.period_end,
        base_amount: baseAmount,
        bonus: bonusAmount,
        deductions: deductionsAmount,
        exchange_rate: parseFloat(formData.exchange_rate) || rate || 0,
        amount_bs: parseFloat(formData.amount_bs) || 0,
      };

      if (isEditing && selectedPayment) {
        const { error } = await updatePayment(selectedPayment.id, {
          ...dataToSend,
          payment_reference: formData.payment_reference || "",
        });
        if (error) throw new Error(error);
        toast.success("Pago actualizado correctamente");
      } else {
        const { error } = await createPayment(dataToSend);
        if (error) throw new Error(error);
        toast.success("Pago registrado correctamente");
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!markPaidDialog.payment) return;

    try {
      const { error } = await markAsPaid(markPaidDialog.payment.id, markPaidDialog.reference);
      if (error) throw new Error(error);
      toast.success("Pago marcado como pagado");
    } catch (err) {
      toast.error(err.message || "Error al marcar pago");
    } finally {
      setMarkPaidDialog({ open: false, payment: null, reference: "" });
      // Recargar datos para obtener la relación con staff
      window.location.reload();
    }
  };

  const handleCancel = async (payment) => {
    try {
      const { error } = await cancelPayment(payment.id);
      if (error) throw new Error(error);
      toast.success("Pago cancelado");
    } catch (err) {
      toast.error(err.message || "Error al cancelar");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.payment) return;

    try {
      const { error } = await deletePayment(deleteConfirm.payment.id);
      if (error) throw new Error(error);
      toast.success("Pago eliminado correctamente");
    } catch (err) {
      toast.error(err.message || "Error al eliminar");
    } finally {
      setDeleteConfirm({ open: false, payment: null });
    }
  };

  const handleDownloadReceipt = async (payment) => {
    const staffMember = staff.find((s) => s.id === payment.staff_id) || payment.staff;
    if (!staffMember) {
      toast.error("No se encontró la información del empleado");
      return;
    }

    try {
      const doc = await generatePaymentReceipt(payment, staffMember);
      downloadPDF(doc, `recibo_${staffMember.first_name}_${staffMember.last_name}`);
      toast.success("Recibo descargado");
    } catch (err) {
      toast.error("Error al generar recibo");
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
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Calcular total del formulario
  const calculatedTotal = useMemo(() => {
    const base = parseFloat(formData.base_amount) || 0;
    const bonus = parseFloat(formData.bonus) || 0;
    const deductions = parseFloat(formData.deductions) || 0;
    return base + bonus - deductions;
  }, [formData.base_amount, formData.bonus, formData.deductions]);

  if (loading || staffLoading) {
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
                <Banknote className="h-5 w-5" />
                Pagos al Personal
              </h2>
              <p className="text-sm text-muted-foreground">
                Gestiona los pagos de nómina a tu personal.
              </p>
            </div>
            <PermissionGate permission={PERMISSIONS.ADMIN_STAFF_PAYMENTS_CREATE}>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Pago
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
                Total Pagos
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <CheckCircle className="h-4 w-4" />
                Pagados
              </div>
              <p className="text-2xl font-bold mt-1 text-green-700 dark:text-green-300">{stats.paid}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                <Clock className="h-4 w-4" />
                Pendientes
              </div>
              <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-300">{stats.pending}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                <Banknote className="h-4 w-4" />
                Por Pagar
              </div>
              <p className="text-lg font-bold mt-1 text-blue-700 dark:text-blue-300">
                {formatCurrency(stats.totalPending)}
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          {filteredPayments.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="No hay pagos registrados"
              description={
                searchTerm || statusFilter !== "all"
                  ? "No se encontraron resultados con los filtros aplicados."
                  : "Comienza registrando el primer pago."
              }
              action={
                !searchTerm && statusFilter === "all" && (
                  <PermissionGate permission={PERMISSIONS.ADMIN_STAFF_PAYMENTS_CREATE}>
                    <Button onClick={() => handleOpenDialog()} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Registrar Pago
                    </Button>
                  </PermissionGate>
                )
              }
            />
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table aria-label="Lista de pagos al personal">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Empleado</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="hidden md:table-cell">Fecha Pago</TableHead>
                    <TableHead className="text-right">Monto Base</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Bonos</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Deducciones</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => {
                    const StatusIcon = STATUS_CONFIG[payment.status]?.icon || Clock;
                    return (
                      <TableRow key={payment.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {payment.staff
                                ? `${payment.staff.first_name} ${payment.staff.last_name}`
                                : "Sin asignar"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {payment.staff?.position || "-"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatDate(payment.period_start)}</p>
                            <p className="text-muted-foreground">a {formatDate(payment.period_end)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(payment.payment_date)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(payment.base_amount)}
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell text-green-600">
                          +{formatCurrency(payment.bonus)}
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell text-red-600">
                          -{formatCurrency(payment.deductions)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(payment.total_amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${STATUS_CONFIG[payment.status]?.color} gap-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {STATUS_CONFIG[payment.status]?.label}
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
                              {payment.status === "pending" && (
                                <PermissionGate permission={PERMISSIONS.ADMIN_STAFF_PAYMENTS_EDIT}>
                                  <DropdownMenuItem
                                    onClick={() => setMarkPaidDialog({ open: true, payment, reference: "" })}
                                    className="text-green-600"
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    Marcar como Pagado
                                  </DropdownMenuItem>
                                </PermissionGate>
                              )}
                              {payment.status === "paid" && (
                                <DropdownMenuItem onClick={() => handleDownloadReceipt(payment)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Descargar Recibo
                                </DropdownMenuItem>
                              )}
                              <PermissionGate permission={PERMISSIONS.ADMIN_STAFF_PAYMENTS_EDIT}>
                                <DropdownMenuItem onClick={() => handleOpenDialog(payment)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                              </PermissionGate>
                              {payment.status === "pending" && (
                                <PermissionGate permission={PERMISSIONS.ADMIN_STAFF_PAYMENTS_EDIT}>
                                  <DropdownMenuItem
                                    onClick={() => handleCancel(payment)}
                                    className="text-amber-600"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancelar Pago
                                  </DropdownMenuItem>
                                </PermissionGate>
                              )}
                              <DropdownMenuSeparator />
                              <PermissionGate permission={PERMISSIONS.ADMIN_STAFF_PAYMENTS_DELETE}>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteConfirm({ open: true, payment })}
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
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Pago" : "Nuevo Pago"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modifica la información del pago."
                : "Registra un nuevo pago al personal."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="staff_id">Empleado *</Label>
                <Select
                  value={formData.staff_id}
                  onValueChange={(value) => handleSelectChange("staff_id", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} - {s.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Información del pago del empleado */}
              {selectedStaffInfo && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-muted-foreground">Datos de Pago del Empleado</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const info = selectedStaffInfo;
                        let paymentInfo = `Banco: ${info.bank_name || "N/A"}\n`;
                        if (info.payment_type === "pago_movil") {
                          paymentInfo += `Pago Móvil\nCédula: ${info.payment_document_id || "N/A"}\nTeléfono: ${info.payment_phone_operator || ""}${info.payment_phone || ""}`;
                        } else if (info.payment_type === "transferencia") {
                          paymentInfo += `Transferencia\nCuenta: ${info.bank_account || "N/A"}\nTipo: ${info.bank_account_type || "N/A"}`;
                        } else if (info.payment_type === "efectivo_dolares") {
                          paymentInfo += "Pago en efectivo (USD)";
                        } else if (info.payment_type === "efectivo_bolivares") {
                          paymentInfo += "Pago en efectivo (Bs)";
                        }
                        navigator.clipboard.writeText(paymentInfo);
                        toast.success("Información copiada al portapapeles");
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tipo de Pago:</span>
                      <span className="ml-2 font-medium">
                        {selectedStaffInfo.payment_type === "pago_movil" && "Pago Móvil"}
                        {selectedStaffInfo.payment_type === "transferencia" && "Transferencia"}
                        {selectedStaffInfo.payment_type === "efectivo_dolares" && "Efectivo $"}
                        {selectedStaffInfo.payment_type === "efectivo_bolivares" && "Efectivo Bs"}
                        {!selectedStaffInfo.payment_type && "No definido"}
                      </span>
                    </div>
                    {selectedStaffInfo.bank_name && (
                      <div>
                        <span className="text-muted-foreground">Banco:</span>
                        <span className="ml-2 font-medium">{selectedStaffInfo.bank_name}</span>
                      </div>
                    )}
                    {selectedStaffInfo.payment_type === "pago_movil" && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Cédula:</span>
                          <span className="ml-2 font-medium">{selectedStaffInfo.payment_document_id || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Teléfono:</span>
                          <span className="ml-2 font-medium">
                            {selectedStaffInfo.payment_phone_operator}{selectedStaffInfo.payment_phone || "N/A"}
                          </span>
                        </div>
                      </>
                    )}
                    {selectedStaffInfo.payment_type === "transferencia" && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Cuenta:</span>
                          <span className="ml-2 font-medium">{selectedStaffInfo.bank_account || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tipo:</span>
                          <span className="ml-2 font-medium">{selectedStaffInfo.bank_account_type || "N/A"}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period_start">Período Inicio *</Label>
                  <Input
                    id="period_start"
                    name="period_start"
                    type="date"
                    value={formData.period_start}
                    onChange={handleInputChange}
                    required
                    className="w-full [&::-webkit-calendar-picker-indicator]:mr-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="period_end">Período Fin *</Label>
                  <Input
                    id="period_end"
                    name="period_end"
                    type="date"
                    value={formData.period_end}
                    onChange={handleInputChange}
                    required
                    className="w-full [&::-webkit-calendar-picker-indicator]:mr-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_date">Fecha Pago *</Label>
                  <Input
                    id="payment_date"
                    name="payment_date"
                    type="date"
                    value={formData.payment_date}
                    onChange={handleInputChange}
                    required
                    className="w-full [&::-webkit-calendar-picker-indicator]:mr-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="base_amount">Monto Base (USD) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="base_amount"
                      name="base_amount"
                      type="number"
                      step="0.01"
                      value={formData.base_amount}
                      onChange={handleInputChange}
                      required
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bonus">Bonos (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="bonus"
                      name="bonus"
                      type="number"
                      step="0.01"
                      value={formData.bonus}
                      onChange={handleInputChange}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deductions">Deducciones (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="deductions"
                      name="deductions"
                      type="number"
                      step="0.01"
                      value={formData.deductions}
                      onChange={handleInputChange}
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

              {/* Total calculado */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total a Pagar (USD):</span>
                  <span className="text-xl font-bold text-primary">
                    ${calculatedTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className={`grid gap-4 ${isEditing ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
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

                {/* Reference field - only shown when editing and not for cash payments */}
                {isEditing && formData.payment_method !== "cash" && formData.payment_method !== "cash_usd" && (
                  <div className="space-y-2">
                    <Label htmlFor="payment_reference">Referencia</Label>
                    <Input
                      id="payment_reference"
                      name="payment_reference"
                      value={formData.payment_reference || ""}
                      onChange={handleInputChange}
                      placeholder="N° de referencia"
                    />
                  </div>
                )}
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
                {isSubmitting ? "Guardando..." : isEditing ? "Guardar Cambios" : "Registrar Pago"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para marcar como pagado */}
      <Dialog open={markPaidDialog.open} onOpenChange={(open) => setMarkPaidDialog({ open, payment: null, reference: "" })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Pago</DialogTitle>
            <DialogDescription>
              Marca este pago como pagado. Opcionalmente agrega una referencia.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="reference">Referencia de Pago</Label>
              <Input
                id="reference"
                value={markPaidDialog.reference}
                onChange={(e) => setMarkPaidDialog((prev) => ({ ...prev, reference: e.target.value }))}
                placeholder="N° de transferencia, cheque, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarkPaidDialog({ open: false, payment: null, reference: "" })}
            >
              Cancelar
            </Button>
            <Button onClick={handleMarkAsPaid} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-2" />
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, payment: open ? deleteConfirm.payment : null })}
        title="Eliminar Pago"
        description="¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
