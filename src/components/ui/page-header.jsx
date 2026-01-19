import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

/**
 * Header de página consistente
 * 
 * @example
 * <PageHeader
 *   title="Clientes"
 *   description="Gestiona los clientes del gimnasio"
 *   badge={{ label: "150 activos", variant: "secondary" }}
 *   actions={[
 *     { label: "Nuevo Cliente", onClick: () => {}, primary: true },
 *     { label: "Exportar", onClick: () => {} },
 *   ]}
 * />
 */
export function PageHeader({
  title,
  description,
  badge,
  actions = [],
  icon: Icon,
  loading = false,
  className,
  children,
}) {
  if (loading) {
    return (
      <div className={cn("mb-6", className)}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Título y descripción */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {title}
                </h1>
                {badge && (
                  <Badge variant={badge.variant || "secondary"} className="font-normal">
                    {badge.label}
                  </Badge>
                )}
              </div>
              {description && (
                <p className="text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.primary ? "default" : "outline"}
                size={action.size || "default"}
                onClick={action.onClick}
                disabled={action.disabled}
                className="gap-2"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Contenido adicional */}
      {children}
    </div>
  );
}

/**
 * Sección con título
 */
export function SectionHeader({
  title,
  description,
  actions = [],
  className,
}) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.primary ? "default" : "ghost"}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
