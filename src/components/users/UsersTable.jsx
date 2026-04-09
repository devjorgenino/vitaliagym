"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useUsers } from "@/hooks/useUsers";
import usePermissions from "@/hooks/usePermissions";
import useRolesList from "@/hooks/useRolesList";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { PERMISSIONS } from "@/components/context/PermissionsProvider";
import client from "@/api/client";
import { authPost } from "@/lib/auth-fetch";
import { toast } from "sonner";
import {
  Shield,
  UserPlus,
  RefreshCw,
  Phone,
  User,
  Copy,
  CheckCircle,
  X,
  PhoneForwarded,
} from "lucide-react";
import { PHONE_OPERATORS, formatPhone, parsePhone } from "@/lib/venezuelanData";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EditIcon,
  TrashIcon,
  SearchIcon,
  FilterXIcon,
} from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { TruncatedCell } from "@/components/ui/truncated-cell";
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
import { Pagination, usePagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserSecuritySection } from "./UserSecuritySection";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function UsersTable() {
  const { users, loading, error, refetch, deleteUser } = useUsers();
  const { hasPermission } = usePermissions();
  const { roles: availableRoles, loading: rolesLoading } = useRolesList();

  // Estados del modal unificado para crear/editar
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone_operator: "0414",
    phone: "",
    roleId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para eliminación
  const [deletingId, setDeletingId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });

  // Estado para el modal de seguridad
  const [securityModalUser, setSecurityModalUser] = useState(null);

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("");

  // Estados para paginación
  const {
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    resetPage,
    paginateData,
  } = usePagination(10);

  // Estado para los roles de cada usuario (cargados dinámicamente)
  const [userRolesMap, setUserRolesMap] = useState({});
  const [loadingUserRoles, setLoadingUserRoles] = useState(false);

  // Estado para normalización de teléfonos
  const [isNormalizingPhones, setIsNormalizingPhones] = useState(false);

  // Función para normalizar todos los teléfonos
  const handleNormalizePhones = async () => {
    setIsNormalizingPhones(true);
    try {
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      for (const user of users) {
        const phone = user.phone || "";

        if (!phone || phone === "N/A") {
          skipped++;
          continue;
        }

        const { operator, number } = parsePhone(phone);

        if (number && number.length > 0) {
          const formattedPhone = formatPhone(operator, number);

          if (formattedPhone !== phone) {
            try {
              const response = await authPost("/api/admin/users", {
                _action: "patch",
                userId: user.id,
                phone: formattedPhone,
              });

              if (response.ok) {
                updated++;
              } else {
                errors++;
              }
            } catch (updateErr) {
              console.error(`Error actualizando teléfono:`, updateErr);
              errors++;
            }
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      }

      await refetch();
      if (updated > 0) {
        toast.success(
          `Teléfonos corregidos: ${updated}${errors > 0 ? `, errores: ${errors}` : ""}`,
        );
      } else if (errors > 0) {
        toast.error(
          `No se pudieron corregir los teléfonos (${errors} errores)`,
        );
      } else {
        toast.info(
          `Todos los teléfonos ya tienen el formato correcto (${skipped})`,
        );
      }
    } catch (err) {
      console.error("Error normalizando teléfonos:", err);
      toast.error("Error al corregir teléfonos: " + err.message);
    } finally {
      setIsNormalizingPhones(false);
    }
  };

  // Resetear formulario
  const resetForm = useCallback(() => {
    setFormData({
      email: "",
      full_name: "",
      phone_operator: "0414",
      phone: "",
      roleId: availableRoles[0]?.id || "",
    });
    setSelectedUser(null);
    setIsEditing(false);
  }, [availableRoles]);

  // Abrir modal para crear
  const handleOpenCreateDialog = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  // Abrir modal para editar
  const handleOpenEditDialog = useCallback((user) => {
    setSelectedUser(user);
    const phoneValue = user.phone || user.user_metadata?.phone || "";
    const { operator, number } = parsePhone(phoneValue);
    setFormData({
      email: user.email || "",
      full_name: user.full_name || user.user_metadata?.full_name || "",
      phone_operator: operator,
      phone: number,
      roleId: "", // No se edita el rol desde aquí
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  }, []);

  // Cerrar modal
  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setTimeout(resetForm, 150);
  }, [resetForm]);

  // Cargar roles de usuarios cuando cambian los usuarios
  useEffect(() => {
    const loadUserRoles = async () => {
      if (users.length === 0) return;

      setLoadingUserRoles(true);
      try {
        const userIds = users.map((u) => u.id);

        const { data, error } = await client
          .from("user_roles")
          .select(
            `
            user_id,
            roles (
              id,
              name
            )
          `,
          )
          .in("user_id", userIds);

        if (error) throw error;

        // Crear mapa de userId -> roles[]
        const rolesMap = {};
        data?.forEach((ur) => {
          if (!rolesMap[ur.user_id]) {
            rolesMap[ur.user_id] = [];
          }
          if (ur.roles) {
            rolesMap[ur.user_id].push(ur.roles);
          }
        });

        setUserRolesMap(rolesMap);
      } catch (err) {
        console.error("Error loading user roles:", err);
      } finally {
        setLoadingUserRoles(false);
      }
    };

    loadUserRoles();
  }, [users]);

  // Establecer rol por defecto cuando cargan los roles
  useEffect(() => {
    if (availableRoles.length > 0 && !formData.roleId) {
      const defaultRole =
        availableRoles.find((r) => r.name === "Entrenador") ||
        availableRoles[0];
      setFormData((prev) => ({ ...prev, roleId: defaultRole.id }));
    }
  }, [availableRoles, formData.roleId]);

  // Handlers
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;

    // Máscara para teléfono: solo números, max 7 dígitos
    if (name === "phone") {
      const cleanValue = value.replace(/\D/g, "").slice(0, 7);
      setFormData((prev) => ({ ...prev, [name]: cleanValue }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleRoleChange = useCallback((value) => {
    setFormData((prev) => ({ ...prev, roleId: value }));
  }, []);

  const handlePhoneOperatorChange = useCallback((value) => {
    setFormData((prev) => ({ ...prev, phone_operator: value }));
  }, []);

  // Submit del formulario (crear o actualizar)
  const handleSubmit = async () => {
    if (!isEditing && !formData.email) {
      toast.error("El email es obligatorio");
      return;
    }

    if (!isEditing && !formData.roleId) {
      toast.error("Selecciona un rol para el usuario");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && selectedUser) {
        // Actualizar usuario - usar cliente directamente
        const { error: profileError } = await client
          .from("profiles")
          .update({
            full_name: formData.full_name,
            phone: formData.phone
              ? formatPhone(formData.phone_operator, formData.phone)
              : "",
          })
          .eq("id", selectedUser.id);

        if (profileError && profileError.code !== "PGRST116") {
          console.warn("Error al actualizar perfil:", profileError);
        }

        // También actualizar metadata en auth
        const { error: authError } = await client.auth.updateUser({
          data: {
            full_name: formData.full_name,
            phone: formData.phone
              ? formatPhone(formData.phone_operator, formData.phone)
              : "",
          },
        });

        if (authError) {
          console.warn("Error al actualizar auth metadata:", authError);
        }

        await refetch();
        toast.success("Usuario actualizado exitosamente");
        handleCloseDialog();
      } else {
        // Crear usuario usando API Route (no desloguea al admin)
        const {
          ok,
          data: result,
          error: apiError,
        } = await authPost("/api/admin/users", {
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone
            ? formatPhone(formData.phone_operator, formData.phone)
            : "",
          roleId: formData.roleId,
        });

        if (!ok) {
          throw new Error(apiError || "Error al crear usuario");
        }

        await refetch();
        handleCloseDialog();

        const tempPassword = result.tempPassword;
        toast.custom(
          (t) => (
            <div className="flex items-center gap-3 bg-background border border-border rounded-lg px-4 py-3 shadow-lg">
              <CheckCircle className="h-5 w-5 text-foreground shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium">Usuario creado exitosamente</p>
                <p className="text-muted-foreground">
                  Contraseña temporal:{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">
                    {tempPassword}
                  </code>
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      toast.success("Copiado", { duration: 1500 });
                    }}
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                  >
                    <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[99999]">Copiar</TooltipContent>
              </Tooltip>
              <button
                onClick={() => toast.dismiss(t)}
                className="p-1 hover:bg-muted rounded-md transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ),
          { duration: 20000 },
        );
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error(
        `Error al ${isEditing ? "actualizar" : "crear"} usuario: ` +
          err.message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (user) => {
    setDeleteDialog({ open: true, user });
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog.user) return;

    setDeletingId(deleteDialog.user.id);
    try {
      const result = await deleteUser(deleteDialog.user.id);
      if (result.success) {
        toast.success("Usuario eliminado exitosamente");
        setDeleteDialog({ open: false, user: null });
      } else {
        toast.error("Error al eliminar usuario: " + result.error);
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      toast.error("Error al eliminar usuario: " + err.message);
    } finally {
      setDeletingId(null);
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
    });
  };

  // Obtener rol(es) de un usuario
  const getUserRoles = (userId) => {
    return userRolesMap[userId] || [];
  };

  // Lógica de filtrado
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchTerm === "" ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name &&
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.phone &&
        user.phone.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filtrar por rol
    let matchesRole = true;
    if (selectedRoleFilter) {
      const userRoles = getUserRoles(user.id);
      matchesRole = userRoles.some((r) => r.id === selectedRoleFilter);
    }

    return matchesSearch && matchesRole;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedRoleFilter("");
    resetPage();
  };

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    resetPage();
  }, [searchTerm, selectedRoleFilter, resetPage]);

  // Datos paginados
  const paginatedUsers = useMemo(() => {
    return paginateData(filteredUsers);
  }, [filteredUsers, paginateData]);

  const activeFiltersCount = [searchTerm, selectedRoleFilter].filter(
    (f) => f !== "",
  ).length;

  // Renderizado de loading
  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold flex items-center gap-2">
            <User
              className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
              aria-hidden="true"
            />
            <span>Usuarios</span>
          </h2>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="p-3 sm:p-4 pb-0 -mt-6">
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // Renderizado de error
  if (error) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold flex items-center gap-2">
            <User
              className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
              aria-hidden="true"
            />
            <span>Usuarios</span>
          </h2>
          <Button
            onClick={refetch}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
        <div className="p-3 sm:p-4 pb-0 -mt-6">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Error: {error}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold flex items-center gap-2">
          <User
            className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
            aria-hidden="true"
          />
          <span>
            Usuarios ({filteredUsers.length}
            {filteredUsers.length !== users.length
              ? ` de ${users.length}`
              : ""}
            )
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <PermissionGate permission={PERMISSIONS.USERS_CREATE} hide>
            <Button
              onClick={handleOpenCreateDialog}
              variant="default"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <UserPlus className="h-4 w-4 sm:mr-1" aria-hidden="true" />
              <span className="hidden sm:inline">Nuevo Usuario</span>
            </Button>
          </PermissionGate>
          <Button
            onClick={refetch}
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
            aria-label="Actualizar lista de usuarios"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1" aria-hidden="true" />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleNormalizePhones}
                variant="outline"
                size="sm"
                disabled={isNormalizingPhones || users.length === 0}
                className="text-xs sm:text-sm"
                aria-label="Corregir formato de telefonos"
              >
                <PhoneForwarded
                  className={`h-3.5 w-3.5 sm:mr-1 ${isNormalizingPhones ? "animate-pulse" : ""}`}
                  aria-hidden="true"
                />
                <span className="hidden md:inline">
                  {isNormalizingPhones ? "Corrigiendo..." : "Corregir Tel."}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Corrige el formato de todos los telefonos (0414-1234567)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="p-3 sm:p-4 pb-0 -mt-6">
        {/* Barra de busqueda y filtros */}
        <div className="mb-3 sm:mb-4 space-y-3 sm:space-y-4">
            <div className="relative">
              <SearchIcon
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"
                aria-hidden="true"
              />
              <Input
                type="text"
                placeholder="Buscar por email, nombre o telefono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
                aria-label="Buscar usuarios"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                Filtros:
              </span>

              <Select
                value={selectedRoleFilter || "all"}
                onValueChange={(value) =>
                  setSelectedRoleFilter(value === "all" ? "" : value)
                }
              >
                <SelectTrigger className="w-[140px] sm:w-[180px] h-8 text-xs sm:text-sm">
                  <SelectValue placeholder="Todos los roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs h-8 text-muted-foreground hover:text-foreground"
                >
                  <FilterXIcon
                    className="h-3.5 w-3.5 mr-1"
                    aria-hidden="true"
                  />
                  Limpiar ({activeFiltersCount})
                </Button>
              )}
            </div>
          </div>

          {/* Tabla de usuarios */}
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {users.length === 0
                  ? "No hay usuarios registrados"
                  : "No se encontraron usuarios con los filtros aplicados"}
              </p>
              {users.length > 0 && (
                <Button onClick={clearFilters} variant="outline">
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="mt-4 sm:mt-5 overflow-x-auto">
                <Table aria-label="Lista de usuarios del sistema">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Nombre
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Teléfono
                      </TableHead>
                      <TableHead>Rol(es)</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Creado
                      </TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user, index) => {
                      const userRoles = getUserRoles(user.id);
                      const realIndex =
                        (currentPage - 1) * pageSize + index + 1;

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium text-center">
                            {realIndex}
                          </TableCell>
                          <TableCell>
                            <TruncatedCell
                              value={user.email}
                              maxWidth="180px"
                              className="font-medium"
                              fallback="N/A"
                            />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <TruncatedCell
                              value={user.full_name}
                              maxWidth="150px"
                              fallback="Sin nombre"
                            />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell whitespace-nowrap">
                            {user.phone ? (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span>{user.phone}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {loadingUserRoles ? (
                              <Skeleton className="h-5 w-20" />
                            ) : userRoles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {userRoles.map((role) => (
                                  <Badge
                                    key={role.id}
                                    variant={
                                      role.name === "Admin"
                                        ? "default"
                                        : role.name === "Secretaria"
                                          ? "secondary"
                                          : "outline"
                                    }
                                    className="text-xs"
                                  >
                                    {role.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                Sin rol
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell whitespace-nowrap">
                            {formatDate(user.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              {/* Botón de seguridad/roles */}
                              <PermissionGate
                                permission={PERMISSIONS.USERS_MANAGE_ROLES}
                                hide
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={() => setSecurityModalUser(user)}
                                      variant="outline"
                                      size="icon-sm"
                                    >
                                      <Shield className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Gestionar roles y permisos</p>
                                  </TooltipContent>
                                </Tooltip>
                              </PermissionGate>

                              {/* Botón de editar */}
                              <PermissionGate
                                permission={PERMISSIONS.USERS_EDIT}
                                hide
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={() => handleOpenEditDialog(user)}
                                      variant="outline"
                                      size="icon-sm"
                                      aria-label={`Editar usuario ${user.full_name || user.email}`}
                                    >
                                      <EditIcon />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Editar usuario</p>
                                  </TooltipContent>
                                </Tooltip>
                              </PermissionGate>

                              {/* Botón de eliminar */}
                              <PermissionGate
                                permission={PERMISSIONS.USERS_DELETE}
                                hide
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={() => openDeleteDialog(user)}
                                      variant="destructive"
                                      size="icon-sm"
                                      aria-label={`Eliminar usuario ${user.full_name || user.email}`}
                                    >
                                      <TrashIcon />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Eliminar usuario</p>
                                  </TooltipContent>
                                </Tooltip>
                              </PermissionGate>
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
                totalItems={filteredUsers.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      </Card>

      {/* Modal de seguridad */}
      <Dialog
        open={!!securityModalUser}
        onOpenChange={(open) => {
          if (!open) {
            setSecurityModalUser(null);
            // Recargar roles de usuarios cuando se cierra el modal
            refetch();
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Seguridad -{" "}
              {securityModalUser?.full_name || securityModalUser?.email}
            </DialogTitle>
            <DialogDescription>
              Gestiona los roles y permisos de este usuario
            </DialogDescription>
          </DialogHeader>
          {securityModalUser && (
            <UserSecuritySection
              userId={securityModalUser.id}
              userName={securityModalUser.full_name || securityModalUser.email}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para Crear/Editar Usuario */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <User className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <DialogTitle>
                  {isEditing ? "Editar Usuario" : "Crear Nuevo Usuario"}
                </DialogTitle>
                <DialogDescription className="truncate">
                  {isEditing
                    ? `Modifica los datos de "${selectedUser?.full_name || selectedUser?.email}"`
                    : "Crea un nuevo usuario del sistema"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="user-email">
                Email{" "}
                {!isEditing && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="user-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="usuario@ejemplo.com"
                autoFocus={!isEditing}
                disabled={isEditing}
                aria-required={!isEditing}
                className="w-full"
              />
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  El email no puede ser modificado
                </p>
              )}
            </div>

            {/* Nombre Completo */}
            <div className="space-y-2">
              <Label htmlFor="user-fullname">Nombre Completo</Label>
              <Input
                id="user-fullname"
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Juan Perez"
                autoFocus={isEditing}
                className="w-full"
              />
            </div>

            {/* Telefono */}
            <div className="space-y-2">
              <Label htmlFor="user-phone">Telefono</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.phone_operator}
                  onValueChange={handlePhoneOperatorChange}
                >
                  <SelectTrigger
                    className="w-24 shrink-0"
                    aria-label="Operador telefonico"
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
                  id="user-phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="1234567"
                  maxLength={7}
                  className="flex-1 min-w-0"
                />
              </div>
            </div>

            {/* Rol - Solo al crear */}
            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="user-role" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" aria-hidden="true" />
                  Rol <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.roleId}
                  onValueChange={handleRoleChange}
                  disabled={rolesLoading}
                >
                  <SelectTrigger className="w-full" id="user-role">
                    <SelectValue
                      placeholder={
                        rolesLoading ? "Cargando roles..." : "Selecciona un rol"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <span>{role.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notas informativas */}
            {!isEditing && (
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                Se generara una contrasena temporal que se mostrara despues de
                crear el usuario.
              </p>
            )}

            {isEditing && (
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                Para modificar el rol del usuario, usa el botón de seguridad
                (escudo) en la tabla.
              </p>
            )}
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
              disabled={isSubmitting || (!isEditing && rolesLoading)}
              loading={isSubmitting}
            >
              {isEditing ? "Guardar Cambios" : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, user: open ? deleteDialog.user : null })
        }
        title="Eliminar Usuario"
        description={
          deleteDialog.user
            ? `¿Estás seguro de que deseas eliminar al usuario "${deleteDialog.user.full_name || deleteDialog.user.email}"? Esta acción no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        loading={deletingId !== null}
        onConfirm={handleDeleteUser}
      />
    </>
  );
}
