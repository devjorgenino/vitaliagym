"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import useRoles from "@/hooks/useRoles";
import usePermissions from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { PERMISSIONS } from "@/components/context/PermissionsProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Shield, 
  Plus, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
  Lock,
  Users,
  LayoutDashboard,
  CreditCard,
  Calendar,
  Dumbbell,
  Settings,
  Smile,
} from "lucide-react";

// Íconos por módulo
const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  clients: Smile,
  attendance: Calendar,
  plans: Dumbbell,
  users: Users,
  payments: CreditCard,
  settings: Settings,
};

// Nombres de módulos en español
const MODULE_NAMES = {
  dashboard: "Dashboard",
  clients: "Clientes",
  attendance: "Asistencia",
  plans: "Planes",
  users: "Usuarios",
  payments: "Pagos",
  settings: "Configuración",
};

// Nombres de acciones en español
const ACTION_NAMES = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  export: "Exportar",
  manage_roles: "Gestionar Roles",
};

export default function RolesConfigPage() {
  const { isAdmin } = usePermissions();

  return (
    <PermissionGate 
      permission={PERMISSIONS.SETTINGS_MANAGE_ROLES} 
      showAccessDenied
    >
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestión de Roles</h1>
            <p className="text-muted-foreground">
              Configura los roles del sistema y sus permisos asociados
            </p>
          </div>
        </div>
        
        <RolesManagement />
      </div>
    </PermissionGate>
  );
}

function RolesManagement() {
  const {
    roles,
    permissionsByModule,
    loading,
    error,
    createRole,
    updateRole,
    deleteRole,
    toggleRolePermission,
  } = useRoles();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manejar creación de rol
  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error("El nombre del rol es requerido");
      return;
    }

    setIsSubmitting(true);
    const result = await createRole({
      name: newRoleName.trim(),
      description: newRoleDescription.trim(),
    });

    if (result.success) {
      toast.success("Rol creado exitosamente");
      setNewRoleName("");
      setNewRoleDescription("");
      setIsCreateDialogOpen(false);
    } else {
      toast.error(result.error || "Error al crear el rol");
    }
    setIsSubmitting(false);
  };

  // Manejar eliminación de rol
  const handleDeleteRole = async (roleId) => {
    const role = roles.find(r => r.id === roleId);
    if (role?.isSystemRole) {
      toast.error("No se pueden eliminar roles del sistema");
      return;
    }

    const result = await deleteRole(roleId);
    if (result.success) {
      toast.success("Rol eliminado exitosamente");
    } else {
      toast.error(result.error || "Error al eliminar el rol");
    }
  };

  // Manejar toggle de permiso
  const handleTogglePermission = async (roleId, permissionId) => {
    const result = await toggleRolePermission(roleId, permissionId);
    if (!result.success) {
      toast.error(result.error || "Error al actualizar permiso");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">Error: {error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botón para crear nuevo rol */}
      <div className="flex justify-end">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Rol
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Rol</DialogTitle>
              <DialogDescription>
                Crea un nuevo rol personalizado para asignar a usuarios
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Rol</Label>
                <Input
                  id="name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Ej: Supervisor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="Descripción del rol..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateRole} disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear Rol"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de roles con sus permisos */}
      <div className="grid gap-6">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {role.name}
                      {role.isSystemRole && (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Sistema
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{role.description}</CardDescription>
                  </div>
                </div>
                {!role.isSystemRole && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRole(role.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => {
                  const ModuleIcon = MODULE_ICONS[moduleName] || Settings;
                  const rolePermissionIds = role.permissions.map(p => p.id);
                  const activeCount = modulePermissions.filter(p => 
                    rolePermissionIds.includes(p.id)
                  ).length;

                  return (
                    <AccordionItem key={moduleName} value={moduleName}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                          <ModuleIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {MODULE_NAMES[moduleName] || moduleName}
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {activeCount}/{modulePermissions.length}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                          {modulePermissions.map((permission) => {
                            const isActive = rolePermissionIds.includes(permission.id);
                            
                            return (
                              <div
                                key={permission.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-card"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">
                                      {ACTION_NAMES[permission.action] || permission.action}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </p>
                                </div>
                                <Switch
                                  checked={isActive}
                                  onCheckedChange={() => 
                                    handleTogglePermission(role.id, permission.id)
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Matriz de permisos (vista compacta) */}
      <Card>
        <CardHeader>
          <CardTitle>Matriz de Permisos</CardTitle>
          <CardDescription>
            Vista compacta de todos los permisos por rol
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Permiso</TableHead>
                  {roles.map((role) => (
                    <TableHead key={role.id} className="text-center min-w-[100px]">
                      {role.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => (
                  <React.Fragment key={moduleName}>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={roles.length + 1} className="font-semibold">
                        {MODULE_NAMES[moduleName] || moduleName}
                      </TableCell>
                    </TableRow>
                    {modulePermissions.map((permission) => (
                      <TableRow key={permission.id}>
                        <TableCell className="text-sm">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              {permission.name}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{permission.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Código: {permission.code}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        {roles.map((role) => {
                          const hasPermission = role.permissions.some(
                            p => p.id === permission.id
                          );
                          return (
                            <TableCell key={role.id} className="text-center">
                              {hasPermission ? (
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
