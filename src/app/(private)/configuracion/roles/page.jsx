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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
      <div className="w-full px-4 sm:px-6 lg:px-8 pb-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="relative inline-block">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Gestión de Roles
              </h1>
              <span className="absolute -top-0.5 -right-3 w-2 h-2 bg-primary rounded-full animate-pulse" />
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
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
    <div className="space-y-4 sm:space-y-6">
      {/* Botón para crear nuevo rol */}
      <div className="flex justify-end">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="text-xs sm:text-sm">
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Nuevo Rol</span>
              <span className="sm:hidden">Nuevo</span>
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
        {roles.map((role) => {
          // Calcular total de permisos activos para este rol
          const totalPermissions = Object.values(permissionsByModule).flat().length;
          const activePermissions = role.permissions.length;
          
          return (
            <RoleCard
              key={role.id}
              role={role}
              permissionsByModule={permissionsByModule}
              onDeleteRole={handleDeleteRole}
              onTogglePermission={handleTogglePermission}
              totalPermissions={totalPermissions}
              activePermissions={activePermissions}
            />
          );
        })}
      </div>

      {/* Matriz de permisos (vista compacta) */}
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">Matriz de Permisos</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Vista compacta de todos los permisos por rol
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px] sm:w-[200px] text-xs sm:text-sm">Permiso</TableHead>
                  {roles.map((role) => (
                    <TableHead key={role.id} className="text-center min-w-[70px] sm:min-w-[100px] text-xs sm:text-sm">
                      <span className="hidden sm:inline">{role.name}</span>
                      <span className="sm:hidden">{role.name.slice(0, 5)}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => (
                  <React.Fragment key={moduleName}>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={roles.length + 1} className="font-semibold text-xs sm:text-sm py-2">
                        {MODULE_NAMES[moduleName] || moduleName}
                      </TableCell>
                    </TableRow>
                    {modulePermissions.map((permission) => (
                      <TableRow key={permission.id}>
                        <TableCell className="text-xs sm:text-sm py-2">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help text-left">
                              <span className="hidden sm:inline">{permission.name}</span>
                              <span className="sm:hidden">{permission.name.slice(0, 15)}...</span>
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
                            <TableCell key={role.id} className="text-center py-2">
                              {hasPermission ? (
                                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground/40 mx-auto" />
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

// Componente de card de rol colapsable
function RoleCard({ 
  role, 
  permissionsByModule, 
  onDeleteRole, 
  onTogglePermission,
  totalPermissions,
  activePermissions 
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader 
            className={cn(
              "cursor-pointer select-none transition-colors hover:bg-muted/50 p-3 sm:p-6",
              "group"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm sm:text-base">
                    <span className="truncate">{role.name}</span>
                    {role.isSystemRole && (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs flex-shrink-0">
                        <Lock className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                        <span className="hidden sm:inline">Sistema</span>
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] sm:text-xs flex-shrink-0">
                      {activePermissions}/{totalPermissions}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm line-clamp-1">{role.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {!role.isSystemRole && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 sm:h-9 sm:w-9"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRole(role.id);
                        }}
                        aria-label={`Eliminar rol ${role.name}`}
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Eliminar rol</TooltipContent>
                  </Tooltip>
                )}
                <div
                  className={cn(
                    "p-1 sm:p-1.5 rounded-md transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                >
                  <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 p-3 sm:p-6 sm:pt-0">
            <Accordion type="multiple" className="w-full">
              {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => {
                const ModuleIcon = MODULE_ICONS[moduleName] || Settings;
                const rolePermissionIds = role.permissions.map(p => p.id);
                const activeCount = modulePermissions.filter(p => 
                  rolePermissionIds.includes(p.id)
                ).length;

                return (
                  <AccordionItem key={moduleName} value={moduleName}>
                    <AccordionTrigger className="hover:no-underline py-2 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <ModuleIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="font-medium text-xs sm:text-sm">
                          {MODULE_NAMES[moduleName] || moduleName}
                        </span>
                        <Badge variant="outline" className="ml-1 sm:ml-2 text-[10px] sm:text-xs">
                          {activeCount}/{modulePermissions.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 pt-2">
                        {modulePermissions.map((permission) => {
                          const isActive = rolePermissionIds.includes(permission.id);
                          
                          return (
                            <div
                              key={permission.id}
                              className="flex items-center justify-between p-2 sm:p-3 rounded-lg border bg-card gap-2"
                            >
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <span className="font-medium text-xs sm:text-sm truncate">
                                    {ACTION_NAMES[permission.action] || permission.action}
                                  </span>
                                </div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">
                                  {permission.description}
                                </p>
                              </div>
                              <Switch
                                checked={isActive}
                                onCheckedChange={() => 
                                  onTogglePermission(role.id, permission.id)
                                }
                                aria-label={`${isActive ? 'Desactivar' : 'Activar'} permiso ${permission.action} para ${role.name}`}
                                className="flex-shrink-0"
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
