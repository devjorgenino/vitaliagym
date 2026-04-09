import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

/**
 * Componente para mostrar mensajes de error/éxito/info debajo de un campo
 */
const FormMessage = React.forwardRef(({ 
  className, 
  children,
  variant = "error",
  id,
  ...props 
}, ref) => {
  if (!children) return null;

  const variants = {
    error: {
      icon: AlertCircle,
      className: "text-destructive",
    },
    success: {
      icon: CheckCircle2,
      className: "text-green-600 dark:text-green-500",
    },
    info: {
      icon: Info,
      className: "text-muted-foreground",
    },
    warning: {
      icon: AlertCircle,
      className: "text-amber-600 dark:text-amber-500",
    },
  };

  const { icon: Icon, className: variantClassName } = variants[variant] || variants.error;

  return (
    <p
      ref={ref}
      id={id}
      role={variant === "error" ? "alert" : undefined}
      aria-live={variant === "error" ? "polite" : undefined}
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium mt-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200",
        variantClassName,
        className
      )}
      {...props}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
});
FormMessage.displayName = "FormMessage";

/**
 * Componente para agrupar label, input y mensaje de error
 */
const FormField = React.forwardRef(({ 
  className, 
  children,
  ...props 
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn("space-y-1.5", className)}
      {...props}
    >
      {children}
    </div>
  );
});
FormField.displayName = "FormField";

/**
 * Componente para mostrar errores globales del formulario
 */
const FormError = React.forwardRef(({ 
  className, 
  children,
  title = "Error",
  ...props 
}, ref) => {
  if (!children) return null;

  return (
    <div
      ref={ref}
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg",
        "bg-destructive/10 border border-destructive/20",
        "text-destructive text-sm",
        "animate-in fade-in-0 slide-in-from-top-2 duration-300",
        className
      )}
      {...props}
    >
      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-destructive/80">{children}</p>
      </div>
    </div>
  );
});
FormError.displayName = "FormError";

/**
 * Componente para mostrar mensajes de éxito globales
 */
const FormSuccess = React.forwardRef(({ 
  className, 
  children,
  title = "Éxito",
  ...props 
}, ref) => {
  if (!children) return null;

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg",
        "bg-green-500/10 border border-green-500/20",
        "text-green-700 dark:text-green-400 text-sm",
        "animate-in fade-in-0 slide-in-from-top-2 duration-300",
        className
      )}
      {...props}
    >
      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-green-600/80 dark:text-green-400/80">{children}</p>
      </div>
    </div>
  );
});
FormSuccess.displayName = "FormSuccess";

/**
 * Wrapper para formularios con manejo de errores
 */
const Form = React.forwardRef(({ 
  className, 
  children,
  onSubmit,
  ...props 
}, ref) => {
  return (
    <form
      ref={ref}
      onSubmit={onSubmit}
      className={cn("space-y-4", className)}
      noValidate
      {...props}
    >
      {children}
    </form>
  );
});
Form.displayName = "Form";

export { Form, FormField, FormMessage, FormError, FormSuccess };
