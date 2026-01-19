import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X, Save, Plus } from "lucide-react";

/**
 * Tarjeta de formulario con estilo consistente
 * 
 * @example
 * <FormCard
 *   title="Nuevo Cliente"
 *   description="Ingresa los datos del cliente"
 *   icon={UserPlus}
 *   variant="create"
 *   onSubmit={handleSubmit}
 *   onCancel={() => setShowForm(false)}
 *   loading={isSubmitting}
 * >
 *   <FormField label="Nombre" ... />
 * </FormCard>
 */
export function FormCard({
  title,
  description,
  icon: Icon,
  variant = "default", // "default" | "create" | "edit"
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel = "Cancelar",
  loading = false,
  disabled = false,
  children,
  className,
  footer,
}) {
  const variants = {
    default: {
      bg: "bg-card",
      border: "border",
      submitIcon: Save,
      submitText: submitLabel || "Guardar",
    },
    create: {
      bg: "bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5",
      border: "border border-primary/20",
      submitIcon: Plus,
      submitText: submitLabel || "Crear",
    },
    edit: {
      bg: "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20",
      border: "border border-blue-200 dark:border-blue-800",
      submitIcon: Save,
      submitText: submitLabel || "Actualizar",
    },
  };

  const variantClasses = variants[variant] || variants.default;
  const SubmitIcon = variantClasses.submitIcon;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(e);
  };

  return (
    <Card className={cn(variantClasses.bg, variantClasses.border, "mb-6", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-background/80 rounded-lg shadow-sm">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && (
                <CardDescription className="mt-1">{description}</CardDescription>
              )}
            </div>
          </div>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-8 w-8 -mr-2 -mt-2"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {children}
        </CardContent>
        <CardFooter className="flex justify-end gap-3 pt-4 border-t bg-muted/30">
          {footer || (
            <>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={loading}
                >
                  {cancelLabel}
                </Button>
              )}
              {onSubmit && (
                <Button type="submit" disabled={loading || disabled}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <SubmitIcon className="mr-2 h-4 w-4" />
                      {variantClasses.submitText}
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

/**
 * Campo de formulario con label
 */
export function FormField({
  label,
  required,
  error,
  hint,
  className,
  children,
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * Grupo de campos en grid
 */
export function FormGrid({ cols = 2, className, children }) {
  return (
    <div className={cn(
      "grid gap-4",
      cols === 1 && "grid-cols-1",
      cols === 2 && "grid-cols-1 md:grid-cols-2",
      cols === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      cols === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
      className
    )}>
      {children}
    </div>
  );
}

export default FormCard;
