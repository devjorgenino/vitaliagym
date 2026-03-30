"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import useStaff from "@/hooks/useStaff";
import { VENEZUELAN_BANKS, BANK_ACCOUNT_TYPES, DOCUMENT_TYPES, PHONE_OPERATORS, formatCedula, parseCedula, formatPhone, parsePhone } from "@/lib/venezuelanData";
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
  DialogTrigger,
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
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  FileText,
  Building,
  Building2,
  UserCheck,
  UserX,
  Clock,
} from "lucide-react";

const STATUS_CONFIG = {
  active: { label: "Activo", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  inactive: { label: "Inactivo", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  on_leave: { label: "Licencia", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  terminated: { label: "Terminado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const SALARY_TYPES = {
  hourly: "Por hora",
  daily: "Diario",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
};

const initialFormData = {
  first_name: "",
  last_name: "",
  email: "",
  phone_operator: "0414",
  phone: "",
  document_type: "V",
  document_id: "",
  position: "",
  department: "",
  hire_date: new Date().toISOString().split("T")[0],
  salary: "",
  salary_type: "monthly",
  status: "active",
  bank_name: "",
  bank_account: "",
  bank_account_type: "",
  notes: "",
};

export default function StaffTable() {
  const {
    staff,
    positions,
    loading,
    createStaff,
    updateStaff,
    deleteStaff,
    getStaffStats,
  } = useStaff();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, staff: null });

  const stats = getStaffStats();

  // Filtrar personal
  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      const matchesSearch =
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.position.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const matchesPosition = positionFilter === "all" || s.position === positionFilter;
      return matchesSearch && matchesStatus && matchesPosition;
    });
  }, [staff, searchTerm, statusFilter, positionFilter]);

  // Posiciones únicas para el filtro
  const uniquePositions = useMemo(() => {
    return [...new Set(staff.map((s) => s.position))].sort();
  }, [staff]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedStaff(null);
    setIsEditing(false);
  };

  const handleOpenDialog = (staffMember = null) => {
    if (staffMember) {
      // Parse document_id to separate type and number
      const { type, number } = parseCedula(staffMember.document_id || "");
      // Parse phone to separate operator and number
      const { operator, number: phoneNumber } = parsePhone(staffMember.phone || "");
      setFormData({
        first_name: staffMember.first_name,
        last_name: staffMember.last_name,
        email: staffMember.email,
        phone_operator: operator,
        phone: phoneNumber,
        document_type: type,
        document_id: number,
        position: staffMember.position,
        department: staffMember.department || "",
        hire_date: staffMember.hire_date,
        salary: staffMember.salary?.toString() || "",
        salary_type: staffMember.salary_type || "monthly",
        status: staffMember.status,
        bank_name: staffMember.bank_name || "",
        bank_account: staffMember.bank_account || "",
        bank_account_type: staffMember.bank_account_type || "",
        notes: staffMember.notes || "",
      });
      setSelectedStaff(staffMember);
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
      // Format document_id with type prefix before saving
      // Format phone with operator prefix before saving
      const dataToSend = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone ? formatPhone(formData.phone_operator, formData.phone) : "",
        document_id: formData.document_id ? formatCedula(formData.document_type, formData.document_id) : "",
        position: formData.position,
        department: formData.department,
        hire_date: formData.hire_date,
        salary: parseFloat(formData.salary) || 0,
        salary_type: formData.salary_type,
        status: formData.status,
        bank_name: formData.bank_name,
        bank_account: formData.bank_account,
        bank_account_type: formData.bank_account_type,
        notes: formData.notes,
      };

      if (isEditing && selectedStaff) {
        const { error } = await updateStaff(selectedStaff.id, dataToSend);
        if (error) throw new Error(error);
        toast.success("Personal actualizado correctamente");
      } else {
        const { error } = await createStaff(dataToSend);
        if (error) throw new Error(error);
        toast.success("Personal registrado correctamente");
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
    if (!deleteConfirm.staff) return;

    try {
      const { error } = await deleteStaff(deleteConfirm.staff.id);
      if (error) throw new Error(error);
      toast.success("Personal eliminado correctamente");
    } catch (err) {
      toast.error(err.message || "Error al eliminar");
    } finally {
      setDeleteConfirm({ open: false, staff: null });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: "VES",
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Personal
            </h2>
            <p className="text-sm text-muted-foreground">
              Gestiona el personal del gimnasio: entrenadores, recepcionistas, limpieza, etc.
            </p>
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="p-3 sm:p-4 pt-0">
          <div className="space-y-2">
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Personal
            </h2>
            <p className="text-sm text-muted-foreground">
              Gestiona el personal del gimnasio: entrenadores, recepcionistas, limpieza, etc.
            </p>
          </div>
            <PermissionGate permission={PERMISSIONS.ADMIN_STAFF_CREATE}>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Personal
              </Button>
            </PermissionGate>
        </div>
        <div className="p-3 sm:p-4 pt-0">
          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-2">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Users className="h-4 w-4" />
                Total
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <UserCheck className="h-4 w-4" />
                Activos
              </div>
              <p className="text-2xl font-bold mt-1 text-green-700 dark:text-green-300">{stats.active}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                <Clock className="h-4 w-4" />
                En Licencia
              </div>
              <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-300">{stats.onLeave}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                <DollarSign className="h-4 w-4" />
                Nómina Mensual
              </div>
              <p className="text-lg font-bold mt-1 text-blue-700 dark:text-blue-300">
                {formatCurrency(stats.totalMonthlySalary)}
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o cargo..."
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
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los cargos</SelectItem>
                {uniquePositions.map((position) => (
                  <SelectItem key={position} value={position}>
                    {position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          {filteredStaff.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No hay personal registrado"
              description={
                searchTerm || statusFilter !== "all" || positionFilter !== "all"
                  ? "No se encontraron resultados con los filtros aplicados."
                  : "Comienza agregando el primer miembro del personal."
              }
              action={
                !searchTerm && statusFilter === "all" && positionFilter === "all" && (
                  <PermissionGate permission={PERMISSIONS.ADMIN_STAFF_CREATE}>
                    <Button onClick={() => handleOpenDialog()} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Agregar Personal
                    </Button>
                  </PermissionGate>
                )
              }
            />
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table aria-label="Lista del personal del gimnasio">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="hidden md:table-cell">Contacto</TableHead>
                    <TableHead className="hidden lg:table-cell">Fecha Ingreso</TableHead>
                    <TableHead className="text-right">Salario</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-semibold">
                              {member.first_name[0]}{member.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{member.first_name} {member.last_name}</p>
                            <p className="text-sm text-muted-foreground">{member.document_id || "Sin cédula"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{member.position}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <TruncatedCell value={member.email} maxWidth="150px" />
                          </div>
                          {member.phone && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              {member.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(member.hire_date).toLocaleDateString("es-ES")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-medium">{formatCurrency(member.salary)}</p>
                          <p className="text-xs text-muted-foreground">
                            {SALARY_TYPES[member.salary_type]}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={STATUS_CONFIG[member.status]?.color}>
                          {STATUS_CONFIG[member.status]?.label}
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
                            <PermissionGate permission={PERMISSIONS.ADMIN_STAFF_EDIT}>
                              <DropdownMenuItem onClick={() => handleOpenDialog(member)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            </PermissionGate>
                            <DropdownMenuSeparator />
                            <PermissionGate permission={PERMISSIONS.ADMIN_STAFF_DELETE}>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteConfirm({ open: true, staff: member })}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </PermissionGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      {/* Dialog para crear/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Personal" : "Nuevo Personal"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modifica la información del personal."
                : "Registra un nuevo miembro del personal."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6 py-4">
              {/* Información personal */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Información Personal</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Nombre *</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Apellido *</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <div className="flex gap-1">
                      <Select
                        value={formData.phone_operator}
                        onValueChange={(value) => handleSelectChange("phone_operator", value)}
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
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="1234567"
                        maxLength={7}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document_id">Cédula / Documento</Label>
                  <div className="flex gap-1">
                    <Select
                      value={formData.document_type}
                      onValueChange={(value) => handleSelectChange("document_type", value)}
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
                      id="document_id"
                      name="document_id"
                      value={formData.document_id}
                      onChange={handleInputChange}
                      placeholder="12345678"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    V: Venezolano, E: Extranjero, J: Jurídico, P: Pasaporte, G: Gobierno
                  </p>
                </div>
              </div>

              {/* Información laboral */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Información Laboral</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">Cargo *</Label>
                    <Select
                      value={formData.position}
                      onValueChange={(value) => handleSelectChange("position", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona un cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {positions.map((pos) => (
                          <SelectItem key={pos.id} value={pos.name}>
                            {pos.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Departamento</Label>
                    <Input
                      id="department"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hire_date">Fecha de Ingreso *</Label>
                    <Input
                      id="hire_date"
                      name="hire_date"
                      type="date"
                      value={formData.hire_date}
                      onChange={handleInputChange}
                      required
                    />
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
              </div>

              {/* Información salarial */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Información Salarial</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="salary">Salario *</Label>
                    <Input
                      id="salary"
                      name="salary"
                      type="number"
                      step="0.01"
                      value={formData.salary}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salary_type">Tipo de Pago</Label>
                    <Select
                      value={formData.salary_type}
                      onValueChange={(value) => handleSelectChange("salary_type", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SALARY_TYPES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Información bancaria */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Información Bancaria</h4>
                <div className="grid grid-cols-3 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="bank_account">N° de Cuenta</Label>
                    <Input
                      id="bank_account"
                      name="bank_account"
                      value={formData.bank_account}
                      onChange={handleInputChange}
                      placeholder="0000-0000-0000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account_type">Tipo</Label>
                    <Select
                      value={formData.bank_account_type}
                      onValueChange={(value) => handleSelectChange("bank_account_type", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {BANK_ACCOUNT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Notas adicionales..."
                  rows={3}
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
                {isSubmitting ? "Guardando..." : isEditing ? "Guardar Cambios" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, staff: open ? deleteConfirm.staff : null })}
        title="Eliminar Personal"
        description={`¿Estás seguro de que deseas eliminar a ${deleteConfirm.staff?.first_name} ${deleteConfirm.staff?.last_name}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
