import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ 
  className, 
  type,
  error,
  success,
  ...props 
}, ref) => {
  return (
    <input
      type={type}
      className={cn(
        // Base styles
        "flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1",
        // Typography
        "text-base md:text-sm",
        // Colors
        "border-input",
        "placeholder:text-muted-foreground",
        "selection:bg-primary selection:text-primary-foreground",
        // Dark mode
        "dark:bg-input/30",
        // Transitions
        "transition-colors duration-100",
        // Shadow
        "shadow-xs",
        // Focus state - accesibilidad mejorada
        "outline-none",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        // File input
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // Disabled state
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
        // Read only
        "read-only:bg-muted/30 read-only:cursor-default",
        // Error state
        error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
        // Success state
        success && "border-green-500 focus-visible:border-green-500 focus-visible:ring-green-500/30",
        // Aria invalid
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30",
        className
      )}
      ref={ref}
      aria-invalid={error ? "true" : undefined}
      {...props}
    />
  );
})
Input.displayName = "Input"

export { Input }
