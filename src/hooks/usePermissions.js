import { useContext } from "react";
import { PermissionsContext } from "@/components/context/PermissionsProvider";

/**
 * Hook para acceder al contexto de permisos
 * 
 * @example
 * const { hasPermission, hasRole, isAdmin } = usePermissions();
 * 
 * // Verificar un permiso específico
 * if (hasPermission('clients.create')) {
 *   // Puede crear clientes
 * }
 * 
 * // Verificar un rol
 * if (hasRole('Admin')) {
 *   // Es administrador
 * }
 * 
 * // Verificar si es admin (shorthand)
 * if (isAdmin()) {
 *   // Acceso total
 * }
 */
const usePermissions = () => {
  const context = useContext(PermissionsContext);

  if (!context) {
    throw new Error("usePermissions debe usarse dentro de un PermissionsProvider");
  }

  return context;
};

export default usePermissions;
