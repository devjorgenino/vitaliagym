import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef(({
  className,
  hover = false,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        // Base styles
        "bg-card text-card-foreground",
        // Layout
        "flex flex-col gap-4 sm:gap-6",
        // Border and shape
        "rounded-lg sm:rounded-xl border",
        // Padding responsive
        "p-4 sm:py-6",
        // Shadow
        "shadow-sm",
        // Hover effect opcional
        hover && "transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
        className
      )}
      {...props}
    />
  );
})
Card.displayName = "Card"

const CardHeader = React.forwardRef(({
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn(
        // Layout
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 sm:gap-2",
        // Padding responsive
        "px-4 sm:px-6",
        // Action grid
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        // Border bottom variant
        "[.border-b]:pb-4 sm:[.border-b]:pb-6",
        className
      )}
      {...props}
    />
  );
})
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({
  className,
  as: Comp = "h3",
  ...props
}, ref) => {
  return (
    <Comp
      ref={ref}
      data-slot="card-title"
      className={cn(
        "leading-tight font-semibold text-base sm:text-lg",
        className
      )}
      {...props}
    />
  );
})
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({
  className,
  ...props
}, ref) => {
  return (
    <p
      ref={ref}
      data-slot="card-description"
      className={cn(
        "text-muted-foreground text-xs sm:text-sm leading-relaxed",
        className
      )}
      {...props}
    />
  );
})
CardDescription.displayName = "CardDescription"

const CardAction = React.forwardRef(({
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  );
})
CardAction.displayName = "CardAction"

const CardContent = React.forwardRef(({
  className,
  ...props
}, ref) => {
  return (
    <div 
      ref={ref}
      data-slot="card-content" 
      className={cn("px-4 sm:px-6", className)} 
      {...props} 
    />
  );
})
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-2 px-4 sm:px-6",
        "[.border-t]:pt-4 sm:[.border-t]:pt-6",
        className
      )}
      {...props}
    />
  );
})
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
