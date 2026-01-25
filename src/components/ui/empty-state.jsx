import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  FileQuestion, 
  Search, 
  Users, 
  Package, 
  CreditCard, 
  Calendar,
  Dumbbell,
  Plus,
  RefreshCw,
} from "lucide-react";

// Iconos predefinidos por tipo
const ICONS = {
  empty: FileQuestion,
  search: Search,
  users: Users,
  clients: Users,
  products: Package,
  payments: CreditCard,
  calendar: Calendar,
  plans: Dumbbell,
};

/**
 * Componente para estados vacíos con ilustración
 * 
 * @example
 * <EmptyState
 *   icon="users"
 *   title="No hay clientes"
 *   description="Comienza agregando tu primer cliente"
 *   action={{
 *     label: "Agregar Cliente",
 *     onClick: () => setShowCreateForm(true)
 *   }}
 * />
 */
export function EmptyState({
  icon = "empty",
  title = "No hay datos",
  description,
  action,
  secondaryAction,
  className,
  children,
}) {
  const Icon = typeof icon === "string" ? ICONS[icon] || FileQuestion : icon;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      {/* Ilustración/Icono */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
        <div className="relative p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full border border-primary/10">
          <Icon className="h-12 w-12 text-primary/60" strokeWidth={1.5} />
        </div>
      </div>

      {/* Texto */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {description}
        </p>
      )}

      {/* Contenido adicional */}
      {children}

      {/* Acciones */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          {action && (
            <Button onClick={action.onClick} className="gap-2">
              {action.icon || <Plus className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick} className="gap-2">
              {secondaryAction.icon || <RefreshCw className="h-4 w-4" />}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Estado vacío específico para resultados de búsqueda
 */
export function SearchEmptyState({ 
  searchTerm, 
  onClear,
  entityName = "resultados",
}) {
  return (
    <EmptyState
      icon="search"
      title={`No se encontraron ${entityName}`}
      description={
        searchTerm 
          ? `No hay ${entityName} que coincidan con "${searchTerm}"`
          : `No hay ${entityName} con los filtros seleccionados`
      }
      action={onClear ? {
        label: "Limpiar filtros",
        onClick: onClear,
        icon: <RefreshCw className="h-4 w-4" />,
      } : undefined}
    />
  );
}

/**
 * Estado vacío con pasos de inicio
 */
export function GettingStartedState({
  title = "Comienza aquí",
  steps = [],
  action,
}) {
  return (
    <EmptyState
      icon="empty"
      title={title}
      action={action}
    >
      {steps.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 mb-4 text-left max-w-md">
          <p className="text-sm font-medium mb-3">Pasos para comenzar:</p>
          <ol className="text-sm text-muted-foreground space-y-2">
            {steps.map((step, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </EmptyState>
  );
}

export default EmptyState;
