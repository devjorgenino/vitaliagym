import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center gap-1",
    "rounded-full border px-2 py-0.5",
    "text-xs font-medium",
    "transition-colors duration-100",
    "whitespace-nowrap",
    // Focus
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-white",
        success:
          "border-transparent bg-green-600 text-white dark:bg-green-500",
        warning:
          "border-transparent bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950",
        info:
          "border-transparent bg-blue-500 text-white dark:bg-blue-400",
        outline: 
          "border-current text-foreground",
        muted:
          "border-transparent bg-muted text-muted-foreground",
      },
      size: {
        default: "px-2 py-0.5 text-xs",
        sm: "px-1.5 py-0 text-[10px]",
        lg: "px-2.5 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  ...props
}) {
  return (
    <span 
      className={cn(badgeVariants({ variant, size }), className)} 
      {...props} 
    />
  )
}

export { Badge, badgeVariants }
