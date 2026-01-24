"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useUsers } from "@/hooks/useUsers";
import usePermissions from "@/hooks/usePermissions";
import useRolesList from "@/hooks/useRolesList";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { PERMISSIONS } from "@/components/context/PermissionsProvider";
import client from "@/api/client";
import { toast } from "sonner";
import { Loader2, Shield, UserPlus, RefreshCw, Phone } from "lucide-react";
import { PHONE_OPERATORS, formatPhone, parsePhone } from "@/lib/venezuelanData";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserSecuritySection } from "./UserSecuritySection";

export function UsersTable() {
  const { users, loading, error, refetch, deleteUser } = useUsers();
  const { hasPermission } = usePermissions();
  const { roles: availableRoles, loading: rolesLoading } = useRolesList();

  // Estados para formulario de creación
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone_operator: "0414",
    phone: "",
    roleId: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Estados para edición
  const [editingUser, setEditingUser] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    email: "",
    full_name: "",
    phone_operator: "0414",
    phone: "",
  });

  // Estado para eliminación
  const [deletingId, setDeletingId] = useState(null);

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

  // Generar contraseña segura
  const generateSecurePassword = () => {
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=";

    let password = "";
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  };

  // Handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Máscara para teléfono: solo números, max 7 dígitos
    if (name === "phone") {
      const cleanValue = value.replace(/\D/g, "").slice(0, 7);
      setFormData((prev) => ({ ...prev, [name]: cleanValue }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value) => {
    setFormData((prev) => ({ ...prev, roleId: value }));
  };

  const handleCreateUser = async () => {
    if (!formData.email) {
      toast.error("El email es obligatorio");
      return;
    }

    if (!formData.roleId) {
      toast.error("Selecciona un rol para el usuario");
      return;
    }

    setIsCreating(true);
    try {
      const tempPassword = generateSecurePassword();

      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await client.auth.signUp({
        email: formData.email,
        password: tempPassword,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone
              ? formatPhone(formData.phone_operator, formData.phone)
              : "",
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Crear perfil en tabla profiles
        const { error: profileError } = await client.from("profiles").insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone
            ? formatPhone(formData.phone_operator, formData.phone)
            : "",
        });

        if (profileError && profileError.code !== "PGRST116") {
          console.warn("Error al crear perfil:", profileError);
        }

        // 3. Asignar rol al usuario en user_roles
        const { error: roleError } = await client.from("user_roles").insert({
          user_id: authData.user.id,
          role_id: formData.roleId,
        });

        if (roleError) {
          console.warn("Error al asignar rol:", roleError);
          toast.warning("Usuario creado pero hubo un error al asignar el rol");
        }
      }

      // Limpiar formulario
      setFormData({
        email: "",
        full_name: "",
        phone_operator: "0414",
        phone: "",
        roleId: availableRoles[0]?.id || "",
      });
      setShowCreateForm(false);
      await refetch();

      toast.success(
        `Usuario creado exitosamente. Contraseña temporal: ${tempPassword}`,
        { duration: 15000 },
      );
    } catch (err) {
      console.error("Error al crear usuario:", err);
      toast.error("Error al crear usuario: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    const phoneValue = user.phone || user.user_metadata?.phone || "";
    const { operator, number } = parsePhone(phoneValue);
    setEditFormData({
      email: user.email || "",
      full_name: user.full_name || user.user_metadata?.full_name || "",
      phone_operator: operator,
      phone: number,
    });
    setShowEditForm(true);
    setShowCreateForm(false);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;

    // Máscara para teléfono: solo números, max 7 dígitos
    if (name === "phone") {
      const cleanValue = value.replace(/\D/g, "").slice(0, 7);
      setEditFormData((prev) => ({ ...prev, [name]: cleanValue }));
      return;
    }

    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setIsCreating(true);
    try {
      const { error: profileError } = await client
        .from("profiles")
        .update({
          email: editFormData.email,
          full_name: editFormData.full_name,
          phone: editFormData.phone
            ? formatPhone(editFormData.phone_operator, editFormData.phone)
            : "",
        })
        .eq("id", editingUser.id);

      if (profileError && profileError.code !== "PGRST116") {
        console.warn("Error al actualizar perfil:", profileError);
      }

      setEditingUser(null);
      setShowEditForm(false);
      setEditFormData({
        email: "",
        full_name: "",
        phone_operator: "0414",
        phone: "",
      });
      await refetch();

      toast.success("Usuario actualizado exitosamente");
    } catch (err) {
      console.error("Error al actualizar usuario:", err);
      toast.error("Error al actualizar usuario: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    setDeletingId(userId);
    try {
      const result = await deleteUser(userId);
      if (result.success) {
        toast.success("Usuario eliminado exitosamente");
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

  const cancelEdit = () => {
    setEditingUser(null);
    setShowEditForm(false);
    setEditFormData({ email: "", full_name: "", phone: "" });
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
      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
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

  // Renderizado de error
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
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
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>
            Usuarios ({filteredUsers.length}
            {filteredUsers.length !== users.length ? ` de ${users.length}` : ""}
            )
          </CardTitle>
          <div className="flex space-x-2">
            <PermissionGate permission={PERMISSIONS.USERS_CREATE} hide>
              <Button
                onClick={() => {
                  setShowCreateForm(!showCreateForm);
                  setShowEditForm(false);
                }}
                variant="default"
                size="sm"
              >
                <UserPlus className="h-4 w-4" />
                {showCreateForm ? "Cancelar" : "Nuevo Usuario"}
              </Button>
            </PermissionGate>
            <Button onClick={refetch} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Barra de búsqueda y filtros */}
          <div className="mb-6 space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar por email, nombre o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium text-muted-foreground">
                Filtros:
              </span>

              <Select
                value={selectedRoleFilter || "all"}
                onValueChange={(value) =>
                  setSelectedRoleFilter(value === "all" ? "" : value)
                }
              >
                <SelectTrigger className="w-[180px]">
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
                  className="text-muted-foreground hover:text-foreground"
                >
                  <FilterXIcon className="h-4 w-4 mr-1" />
                  Limpiar ({activeFiltersCount})
                </Button>
              )}
            </div>
          </div>

          {/* Formulario de Edición */}
          {showEditForm && (
            <div className="mb-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
              <h3 className="text-lg font-semibold mb-4">Editar Usuario</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-2 block">Email</Label>
                  <Input
                    type="email"
                    name="email"
                    value={editFormData.email}
                    onChange={handleEditInputChange}
                    placeholder="usuario@ejemplo.com"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Nombre Completo</Label>
                  <Input
                    type="text"
                    name="full_name"
                    value={editFormData.full_name}
                    onChange={handleEditInputChange}
                    placeholder="Juan Pérez"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Teléfono</Label>
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
                      type="tel"
                      name="phone"
                      value={editFormData.phone}
                      onChange={handleEditInputChange}
                      placeholder="1234567"
                      maxLength={7}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Para modificar el rol del usuario, usa el botón de seguridad
                (escudo) en la tabla.
              </p>
              <div className="mt-4 flex space-x-2">
                <Button
                  onClick={handleUpdateUser}
                  disabled={isCreating}
                  size="sm"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    "Actualizar Usuario"
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
            <div className="mb-6 p-4 border rounded-lg bg-green-50 dark:bg-green-950">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Crear Nuevo Usuario
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">Email *</Label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="usuario@ejemplo.com"
                    required
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Nombre Completo</Label>
                  <Input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    placeholder="Juan Pérez"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Teléfono</Label>
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
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="1234567"
                      maxLength={7}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Rol *
                  </Label>
                  <Select
                    value={formData.roleId}
                    onValueChange={handleRoleChange}
                    disabled={rolesLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          rolesLoading ? "Cargando..." : "Selecciona un rol"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <span>{role.name}</span>
                            {role.description && (
                              <span className="text-xs text-muted-foreground">
                                - {role.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Se generará una contraseña temporal que se mostrará después de
                crear el usuario.
              </p>
              <div className="mt-4 flex space-x-2">
                <Button
                  onClick={handleCreateUser}
                  disabled={isCreating || rolesLoading}
                  size="sm"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Usuario"
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
              <div className="overflow-x-auto">
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
                            {user.phone || "N/A"}
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
                                      onClick={() => handleEditUser(user)}
                                      variant="outline"
                                      size="icon-sm"
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
                                      onClick={() => handleDeleteUser(user.id)}
                                      variant="destructive"
                                      size="icon-sm"
                                      disabled={deletingId === user.id}
                                    >
                                      {deletingId === user.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <TrashIcon />
                                      )}
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
        </CardContent>
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
    </>
  );
}
