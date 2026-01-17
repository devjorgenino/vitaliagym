import React, { useState } from "react";
import { useUsers } from "../../hooks/useUsers";
import client from "../../api/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Input } from "../ui/input";
import { EditIcon, TrashIcon, SearchIcon, FilterXIcon } from "../ui/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export function UsersTable() {
  const { users, loading, error, refetch, deleteUser } = useUsers();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
    role: "user",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
    role: "user",
  });

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateUser = async () => {
    if (!formData.email) {
      toast.error("El email es obligatorio");
      return;
    }

    setIsCreating(true);
    try {
      // Generar contraseña temporal segura
      const generateSecurePassword = () => {
        const lowercase = "abcdefghijklmnopqrstuvwxyz";
        const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const numbers = "0123456789";
        const symbols = "!@#$%^&*()_+-=";

        // Asegurar al menos un caracter de cada tipo
        let password = "";
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += symbols[Math.floor(Math.random() * symbols.length)];

        // Llenar el resto con caracteres aleatorios
        const allChars = lowercase + uppercase + numbers + symbols;
        for (let i = 4; i < 12; i++) {
          password += allChars[Math.floor(Math.random() * allChars.length)];
        }

        // Mezclar los caracteres
        return password
          .split("")
          .sort(() => Math.random() - 0.5)
          .join("");
      };

      const tempPassword = generateSecurePassword();

      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await client.auth.signUp({
        email: formData.email,
        password: tempPassword,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            role: formData.role,
          },
        },
      });

      if (authError) {
        throw authError;
      }

      // Si la tabla profiles existe, insertar directamente
      if (authData.user) {
        const { error: profileError } = await client.from("profiles").insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
        });

        if (profileError && profileError.code !== "PGRST116") {
          console.warn("Error al crear perfil:", profileError);
        }
      }

      // Limpiar formulario y recargar lista
      setFormData({
        email: "",
        full_name: "",
        phone: "",
        role: "user",
      });
      setShowCreateForm(false);
      await refetch();

      toast.success(
        `Usuario creado exitosamente. Contraseña temporal: ${tempPassword}`,
        { duration: 10000 }
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

    // Extraer datos de diferentes fuentes posibles
    const phone = user.phone || user.user_metadata?.phone || "";
    const fullName = user.full_name || user.user_metadata?.full_name || "";
    const role = user.role || user.user_metadata?.role || "user";

    setEditFormData({
      email: user.email || "",
      full_name: fullName,
      phone: phone,
      role: role,
    });
    setShowEditForm(true);
    setShowCreateForm(false);

    // Debug para ver qué datos estamos recibiendo
    console.log("Usuario a editar:", user);
    console.log("Datos del formulario:", {
      email: user.email,
      full_name: fullName,
      phone: phone,
      role: role,
    });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setIsCreating(true);
    try {
      let updateSuccess = false;

      // Intentar actualizar en tabla profiles primero
      const { error: profileError } = await client
        .from("profiles")
        .update({
          email: editFormData.email,
          full_name: editFormData.full_name,
          phone: editFormData.phone,
          role: editFormData.role,
        })
        .eq("id", editingUser.id);

      if (profileError) {
        if (profileError.code === "PGRST116") {
          console.log(
            "Tabla profiles no existe, intentando actualizar metadatos del usuario..."
          );

          // Si la tabla no existe, intentar actualizar los metadatos del usuario
          const { error: updateError } = await client.auth.updateUser({
            data: {
              full_name: editFormData.full_name,
              phone: editFormData.phone,
              role: editFormData.role,
            },
          });

          if (updateError) {
            console.warn("Error al actualizar metadatos:", updateError);
          } else {
            updateSuccess = true;
          }
        } else {
          console.warn("Error al actualizar perfil:", profileError);
        }
      } else {
        updateSuccess = true;
      }

      // Limpiar formulario y recargar lista
      setEditingUser(null);
      setShowEditForm(false);
      setEditFormData({
        email: "",
        full_name: "",
        phone: "",
        role: "user",
      });
      await refetch();

      if (updateSuccess || !profileError) {
        toast.success("Usuario actualizado exitosamente");
      } else {
        toast.warning(
          "Usuario actualizado con advertencias. Revisa la consola para más detalles."
        );
      }
    } catch (err) {
      console.error("Error al actualizar usuario:", err);
      toast.error("Error al actualizar usuario: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setShowEditForm(false);
    setEditFormData({
      email: "",
      full_name: "",
      phone: "",
      role: "user",
    });
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

  // Lógica de filtrado
  const filteredUsers = users.filter((user) => {
    // Filtrar por término de búsqueda (email, nombre, teléfono)
    const matchesSearch = 
      searchTerm === "" ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.phone && user.phone.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filtrar por rol
    const matchesRole = 
      selectedRole === "" ||
      user.role === selectedRole;

    return matchesSearch && matchesRole;
  });

  // Función para limpiar todos los filtros
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedRole("");
  };

  // Contar filtros activos
  const activeFiltersCount = [searchTerm, selectedRole].filter(
    (filter) => filter !== ""
  ).length;

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Usuarios ({filteredUsers.length}{filteredUsers.length !== users.length ? ` de ${users.length}` : ""})</CardTitle>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            variant="default"
            size="sm"
          >
            {showCreateForm ? "Cancelar" : "+ Nuevo Usuario"}
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
              placeholder="Buscar por email, nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
            
            {/* Filtro por rol */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los roles</option>
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>

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
          {filteredUsers.length !== users.length && (
            <div className="text-sm text-muted-foreground">
              Mostrando {filteredUsers.length} de {users.length} usuarios
            </div>
          )}
        </div>

        {showEditForm && (
          <div className="mb-6 p-4 border rounded-lg bg-blue-50">
            <h3 className="text-lg font-semibold mb-4">Editar Usuario</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={editFormData.full_name}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan Pérez"
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
              <div>
                <label className="block text-sm font-medium mb-2">Rol</label>
                <select
                  name="role"
                  value={editFormData.role}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <Button
                onClick={handleUpdateUser}
                disabled={isCreating}
                variant="default"
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
        {showCreateForm && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4">Crear Nuevo Usuario</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan Pérez"
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
              <div>
                <label className="block text-sm font-medium mb-2">Rol</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <Button
                onClick={handleCreateUser}
                disabled={isCreating}
                variant="default"
                size="sm"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Usuario"
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
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {users.length === 0 
                ? "No hay usuarios registrados" 
                : "No se encontraron usuarios con los filtros aplicados"}
            </p>
            {users.length === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="font-semibold text-blue-900 mb-2">
                  📋 Para empezar:
                </h4>
                <ol className="text-sm text-blue-800 text-left space-y-1">
                  <li>Haz clic en &quot;+ Nuevo Usuario&quot;</li>
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
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user, index) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-center">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.email || "N/A"}
                  </TableCell>
                  <TableCell>{user.full_name || "Sin nombre"}</TableCell>
                  <TableCell>{user.phone || "N/A"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {user.role || "user"}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
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
