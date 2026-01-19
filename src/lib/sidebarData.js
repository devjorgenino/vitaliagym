import {
  Dumbbell,
  Home,
  CalendarCheck2,
  Smile,
  Users,
  BanknoteIcon,
  Settings,
  Shield,
} from "lucide-react";

/**
 * Configuración del sidebar con permisos requeridos
 * 
 * Cada item puede tener:
 * - title: Título a mostrar
 * - url: URL de la página
 * - icon: Icono de Lucide
 * - permission: Permiso requerido para ver este item (opcional)
 * - children: Sub-items (opcional)
 */
export const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    permission: "dashboard.view",
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Smile,
    permission: "clients.view",
  },
  {
    title: "Asistencia",
    url: "/asistencia",
    icon: CalendarCheck2,
    permission: "attendance.view",
  },
  {
    title: "Planes",
    url: "/planes",
    icon: Dumbbell,
    permission: "plans.view",
  },
  {
    title: "Usuarios",
    url: "/usuarios",
    icon: Users,
    permission: "users.view",
  },
  {
    title: "Pagos",
    url: "/pagos",
    icon: BanknoteIcon,
    permission: "payments.view",
  },
];

/**
 * Items de configuración (separados para mostrar al final)
 */
export const configItems = [
  {
    title: "Roles",
    url: "/configuracion/roles",
    icon: Shield,
    permission: "settings.manage_roles",
  },
];

/**
 * Función helper para filtrar items por permisos
 * 
 * @param {Array} menuItems - Items del menú
 * @param {Function} hasPermission - Función que verifica si tiene un permiso
 * @returns {Array} Items filtrados
 */
export const filterItemsByPermission = (menuItems, hasPermission) => {
  return menuItems.filter(item => {
    // Si no tiene permission definido, siempre mostrar
    if (!item.permission) return true;
    
    // Verificar permiso
    return hasPermission(item.permission);
  });
};

/**
 * Obtener todos los items (principales + config) filtrados por permisos
 */
export const getAllFilteredItems = (hasPermission) => {
  const mainItems = filterItemsByPermission(items, hasPermission);
  const filteredConfigItems = filterItemsByPermission(configItems, hasPermission);
  
  return {
    mainItems,
    configItems: filteredConfigItems,
    allItems: [...mainItems, ...filteredConfigItems],
  };
};
