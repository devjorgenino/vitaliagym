"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import useUserSecurity from "@/hooks/useUserSecurity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Shield, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Lock,
  Unlock,
  AlertTriangle,
  Users,
  LayoutDashboard,
  CreditCard,
  Calendar,
  Dumbbell,
  Settings,
  Smile,
  Info,
} from "lucide-react";

// Iconos y nombres por módulo
const MODULE_CONFIG = {
  dashboard: { icon: LayoutDashboard, name: "Dashboard" },
  clients: { icon: Smile, name: "Clientes" },
  attendance: { icon: Calendar, name: "Asistencia" },
  plans: { icon: Dumbbell, name: "Planes" },
  users: { icon: Users, name: "Usuarios" },
  payments: { icon: CreditCard, name: "Pagos" },
  settings: { icon: Settings, name: "Configuración" },
};

const ACTION_NAMES = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  export: "Exportar",
  manage_roles: "Gestionar Roles",
};

/**
 * Componente de seguridad para gestionar roles y permisos de un usuario
 * 
 * @param {Object} props
 * @param {string} props.userId - ID del usuario
 * @param {string} props.userName - Nombre del usuario (para mostrar)
 */
export function UserSecuritySection({ userId, userName }) {
  const {
    userRoles,
    userPermissionOverrides,
    allRoles,
    allPermissions,
    loading,
    error,
    loadAll,
    assignRole,
    revokeRole,
    setPermissionOverride,
    removePermissionOverride,
  } = useUserSecurity(userId);

  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  // Cargar datos al montar
  useEffect(() => {
    if (userId) {
      loadAll();
    }
  }, [userId, loadAll]);

  // Obtener roles que el usuario NO tiene asignados
  const availableRoles = allRoles.filter(
    role => !userRoles.some(ur => ur.roleId === role.id)
  );

  // Agrupar permisos por módulo
  const permissionsByModule = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {});

  // Verificar si un permiso tiene override
  const getPermissionOverride = (permissionId) => {
    return userPermissionOverrides.find(o => o.permissionId === permissionId);
  };

  // Manejar asignación de rol
  const handleAssignRole = async () => {
    if (!selectedRoleToAdd) {
      toast.error("Selecciona un rol");
      return;
    }

    setIsSubmitting(true);
    const result = await assignRole(selectedRoleToAdd);
    
    if (result.success) {
      toast.success("Rol asignado exitosamente");
      setSelectedRoleToAdd("");
      setIsAddRoleDialogOpen(false);
    } else {
      toast.error(result.error || "Error al asignar rol");
    }
    setIsSubmitting(false);
  };

  // Manejar revocación de rol
  const handleRevokeRole = async (roleId, roleName) => {
    setIsSubmitting(true);
    const result = await revokeRole(roleId);
    
    if (result.success) {
      toast.success(`Rol "${roleName}" revocado exitosamente`);
    } else {
      toast.error(result.error || "Error al revocar rol");
    }
    setIsSubmitting(false);
  };

  // Manejar toggle de override de permiso
  const handleTogglePermissionOverride = async (permission, currentState) => {
    const override = getPermissionOverride(permission.id);
    
    if (override) {
      // Si ya existe un override, alternamos entre granted/denied/remove
      if (override.granted && currentState) {
        // Está otorgado, lo denegamos
        const result = await setPermissionOverride(permission.id, false, "Denegado manualmente");
        if (result.success) {
          toast.success(`Permiso "${permission.name}" denegado`);
        }
      } else {
        // Está denegado o queremos quitar el override
        const result = await removePermissionOverride(permission.id);
        if (result.success) {
          toast.success(`Override de "${permission.name}" eliminado`);
        }
      }
    } else {
      // No existe override, creamos uno
      const result = await setPermissionOverride(
        permission.id, 
        true, 
        "Otorgado manualmente"
      );
      if (result.success) {
        toast.success(`Permiso "${permission.name}" otorgado manualmente`);
      }
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={loadAll}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Seguridad y Permisos
        </CardTitle>
        <CardDescription>
          Gestiona los roles y permisos de {userName || "este usuario"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sección de Roles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Roles Asignados</h3>
            <Dialog open={isAddRoleDialogOpen} onOpenChange={setIsAddRoleDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={availableRoles.length === 0}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Rol
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Asignar Rol</DialogTitle>
                  <DialogDescription>
                    Selecciona un rol para asignar a {userName || "este usuario"}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Select value={selectedRoleToAdd} onValueChange={setSelectedRoleToAdd}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map(role => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex flex-col">
                            <span>{role.name}</span>
                            {role.description && (
                              <span className="text-xs text-muted-foreground">
                                {role.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddRoleDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAssignRole} disabled={isSubmitting}>
                    {isSubmitting ? "Asignando..." : "Asignar Rol"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {userRoles.length === 0 ? (
            <div className="text-center py-6 border rounded-lg bg-muted/30">
              <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Este usuario no tiene roles asignados
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {userRoles.map(role => (
                <Badge
                  key={role.id}
                  variant="secondary"
                  className="text-sm py-1.5 px-3 flex items-center gap-2"
                >
                  <Shield className="h-3 w-3" />
                  {role.roleName}
                  {role.isSystemRole && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-destructive/20 ml-1"
                        onClick={() => handleRevokeRole(role.roleId, role.roleName)}
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Revocar rol</p>
                    </TooltipContent>
                  </Tooltip>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Separador */}
        <div className="border-t" />

        {/* Sección de Overrides de Permisos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Sobreescritura de Permisos</h3>
              <p className="text-sm text-muted-foreground">
                Otorga o deniega permisos específicos independientemente de los roles
              </p>
            </div>
            {userPermissionOverrides.length > 0 && (
              <Badge variant="outline">
                {userPermissionOverrides.length} override(s)
              </Badge>
            )}
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-blue-800">
              <p className="font-medium">Cómo funcionan las sobreescrituras:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-blue-700">
                <li><strong>Switch ON (verde)</strong>: Permiso otorgado manualmente</li>
                <li><strong>Switch OFF (rojo)</strong>: Permiso denegado manualmente</li>
                <li><strong>Switch gris</strong>: Heredado de los roles (sin override)</li>
              </ul>
            </div>
          </div>

          <Accordion type="multiple" className="w-full">
            {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => {
              const config = MODULE_CONFIG[moduleName] || { icon: Settings, name: moduleName };
              const ModuleIcon = config.icon;
              
              const overridesInModule = modulePermissions.filter(p => 
                getPermissionOverride(p.id)
              ).length;

              return (
                <AccordionItem key={moduleName} value={moduleName}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <ModuleIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{config.name}</span>
                      {overridesInModule > 0 && (
                        <Badge variant="outline" className="ml-2">
                          {overridesInModule} override(s)
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 pt-2">
                      {modulePermissions.map(permission => {
                        const override = getPermissionOverride(permission.id);
                        const hasOverride = !!override;
                        const isGranted = hasOverride ? override.granted : false;
                        
                        return (
                          <div
                            key={permission.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              hasOverride 
                                ? isGranted 
                                  ? 'bg-green-50 border-green-200' 
                                  : 'bg-red-50 border-red-200'
                                : 'bg-card'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {permission.name}
                                </span>
                                {hasOverride && (
                                  <Badge 
                                    variant={isGranted ? "success" : "destructive"} 
                                    className="text-xs"
                                  >
                                    {isGranted ? (
                                      <><Unlock className="h-3 w-3 mr-1" /> Otorgado</>
                                    ) : (
                                      <><Lock className="h-3 w-3 mr-1" /> Denegado</>
                                    )}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {permission.description}
                              </p>
                              {hasOverride && override.reason && (
                                <p className="text-xs italic text-muted-foreground">
                                  Razón: {override.reason}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {hasOverride && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => removePermissionOverride(permission.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Eliminar override</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <Switch
                                checked={hasOverride && isGranted}
                                onCheckedChange={() => 
                                  handleTogglePermissionOverride(permission, isGranted)
                                }
                                className={hasOverride ? (isGranted ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-400') : ''}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </CardContent>
    </Card>
  );
}

export default UserSecuritySection;
