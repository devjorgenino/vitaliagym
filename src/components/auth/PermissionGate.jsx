"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import usePermissions from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldX, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Componente para proteger contenido basado en permisos
 * 
 * @param {Object} props
 * @param {string|string[]} props.permission - Permiso(s) requerido(s)
 * @param {boolean} props.requireAll - Si es true, requiere TODOS los permisos (default: false = any)
 * @param {string|string[]} props.role - Rol(es) requerido(s)
 * @param {React.ReactNode} props.children - Contenido a renderizar si tiene permiso
 * @param {React.ReactNode} props.fallback - Contenido alternativo si no tiene permiso
 * @param {boolean} props.showAccessDenied - Mostrar mensaje de acceso denegado (default: false)
 * @param {boolean} props.hide - Si es true, oculta el contenido en lugar de mostrar fallback
 * 
 * @example
 * // Proteger un botón
 * <PermissionGate permission="clients.create" hide>
 *   <Button>Crear Cliente</Button>
 * </PermissionGate>
 * 
 * @example
 * // Proteger una sección con mensaje
 * <PermissionGate permission="users.view" showAccessDenied>
 *   <UsersTable />
 * </PermissionGate>
 * 
 * @example
 * // Múltiples permisos (cualquiera)
 * <PermissionGate permission={['clients.edit', 'clients.delete']}>
 *   <ActionButtons />
 * </PermissionGate>
 * 
 * @example
 * // Múltiples permisos (todos requeridos)
 * <PermissionGate permission={['clients.view', 'clients.edit']} requireAll>
 *   <EditForm />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  requireAll = false,
  role,
  children,
  fallback = null,
  showAccessDenied = false,
  hide = false,
}) {
  const { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions, 
    hasRole, 
    loading 
  } = usePermissions();

  // Mostrar skeleton mientras carga
  if (loading) {
    if (hide) return null;
    return <Skeleton className="h-10 w-full" />;
  }

  // Verificar permisos
  let hasAccess = true;

  if (permission) {
    const permissions = Array.isArray(permission) ? permission : [permission];
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  // Verificar roles si se especificaron
  if (hasAccess && role) {
    const roles = Array.isArray(role) ? role : [role];
    hasAccess = roles.some(r => hasRole(r));
  }

  // Si tiene acceso, renderizar children
  if (hasAccess) {
    return <>{children}</>;
  }

  // Si debe ocultarse, no renderizar nada
  if (hide) {
    return null;
  }

  // Si hay fallback, renderizarlo
  if (fallback) {
    return <>{fallback}</>;
  }

  // Si debe mostrar mensaje de acceso denegado
  if (showAccessDenied) {
    return <AccessDeniedMessage />;
  }

  return null;
}

/**
 * Componente de mensaje de acceso denegado
 */
export function AccessDeniedMessage({ 
  title = "Acceso Denegado",
  message = "No tienes permisos para acceder a este contenido.",
  showBackButton = true,
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <ShieldX className="h-12 w-12 text-destructive" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-md">{message}</p>
      {showBackButton && (
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Ir al Dashboard</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * HOC para proteger rutas completas
 * Redirige a /access-denied si no tiene permiso
 * 
 * @example
 * export default withPermission(UsersPage, 'users.view');
 * 
 * @example
 * export default withPermission(AdminSettings, ['settings.view', 'settings.edit'], { requireAll: true });
 */
export function withPermission(
  WrappedComponent,
  permission,
  options = {}
) {
  const { requireAll = false, redirectTo = "/access-denied" } = options;

  return function ProtectedRoute(props) {
    const router = useRouter();
    const { 
      hasAnyPermission, 
      hasAllPermissions, 
      loading 
    } = usePermissions();

    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);

    useEffect(() => {
      if (!loading && !hasAccess) {
        router.replace(redirectTo);
      }
    }, [loading, hasAccess, router]);

    if (loading) {
      return (
        <div className="flex h-screen w-full">
          <Skeleton className="h-full w-72" />
          <div className="flex flex-col flex-1 p-4 gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      );
    }

    if (!hasAccess) {
      return null; // Se redirigirá por el useEffect
    }

    return <WrappedComponent {...props} />;
  };
}

/**
 * HOC para proteger rutas por rol
 * 
 * @example
 * export default withRole(AdminPanel, 'Admin');
 * export default withRole(StaffPage, ['Admin', 'Secretaria']);
 */
export function withRole(
  WrappedComponent,
  role,
  options = {}
) {
  const { redirectTo = "/access-denied" } = options;

  return function ProtectedRoute(props) {
    const router = useRouter();
    const { hasRole, loading } = usePermissions();

    const roles = Array.isArray(role) ? role : [role];
    const hasAccess = roles.some(r => hasRole(r));

    useEffect(() => {
      if (!loading && !hasAccess) {
        router.replace(redirectTo);
      }
    }, [loading, hasAccess, router]);

    if (loading) {
      return (
        <div className="flex h-screen w-full">
          <Skeleton className="h-full w-72" />
          <div className="flex flex-col flex-1 p-4 gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      );
    }

    if (!hasAccess) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}

/**
 * Componente para deshabilitar elementos basado en permisos
 * Útil para botones que deben verse pero estar deshabilitados
 * 
 * @example
 * <DisabledWithoutPermission permission="clients.delete">
 *   <Button variant="destructive">Eliminar</Button>
 * </DisabledWithoutPermission>
 */
export function DisabledWithoutPermission({
  permission,
  children,
  tooltip = "No tienes permisos para esta acción",
}) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return <Skeleton className="h-10 w-20" />;
  }

  const hasAccess = hasPermission(permission);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Clonar el elemento hijo y agregar disabled + title
  const child = Array.isArray(children) ? children[0] : children;
  
  if (child && typeof child === 'object') {
    return (
      <div className="relative group">
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg flex items-center gap-1">
            <Lock className="h-3 w-3" />
            {tooltip}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default PermissionGate;
