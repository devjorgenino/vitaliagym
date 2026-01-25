"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Select({
  ...props
}) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
  ...props
}) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  ...props
}) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  error,
  children,
  ...props
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      aria-invalid={error ? "true" : undefined}
      className={cn(
        // Base styles
        "flex w-full items-center justify-between gap-2 rounded-md border bg-transparent",
        // Sizing
        "px-3 py-2 text-sm",
        "data-[size=default]:h-9 data-[size=sm]:h-8 data-[size=lg]:h-11",
        // Colors
        "border-input",
        "data-[placeholder]:text-muted-foreground",
        "[&_svg:not([class*='text-'])]:text-muted-foreground",
        // Dark mode
        "dark:bg-input/30 dark:hover:bg-input/50",
        // Transitions
        "transition-colors duration-100",
        // Shadow
        "shadow-xs",
        // Focus state
        "outline-none",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Error state
        error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
        // Aria invalid
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        // Value styling
        "*:data-[slot=select-value]:line-clamp-1",
        "*:data-[slot=select-value]:flex",
        "*:data-[slot=select-value]:items-center", 
        "*:data-[slot=select-value]:gap-2",
        // SVG
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Whitespace
        "whitespace-nowrap",
        className
      )}
      {...props}>
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50 transition-transform duration-100 data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          // Base
          "bg-popover text-popover-foreground",
          "relative z-50 overflow-hidden rounded-md border shadow-lg",
          // Sizing
          "max-h-[--radix-select-content-available-height]",
          "min-w-[8rem]",
          // Origin
          "origin-[--radix-select-content-transform-origin]",
          // Animations rápidas
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[state=open]:duration-100 data-[state=closed]:duration-75",
          // Slide based on side
          "data-[side=bottom]:slide-in-from-top-1",
          "data-[side=top]:slide-in-from-bottom-1",
          "data-[side=left]:slide-in-from-right-1",
          "data-[side=right]:slide-in-from-left-1",
          // Position offset
          position === "popper" && [
            "data-[side=bottom]:translate-y-1",
            "data-[side=top]:-translate-y-1",
            "data-[side=left]:-translate-x-1",
            "data-[side=right]:translate-x-1",
          ],
          className
        )}
        position={position}
        {...props}>
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" && [
              "h-[var(--radix-select-trigger-height)]",
              "w-full min-w-[var(--radix-select-trigger-width)]",
              "scroll-my-1"
            ]
          )}>
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        "text-muted-foreground px-2 py-1.5 text-xs font-medium",
        className
      )}
      {...props} />
  );
}

function SelectItem({
  className,
  children,
  ...props
}) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        // Base
        "relative flex w-full cursor-pointer items-center gap-2 rounded-sm",
        // Sizing
        "py-2 pr-8 pl-2 text-sm",
        // States
        "outline-none select-none",
        "transition-colors duration-75",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        // Disabled
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        // SVG
        "[&_svg:not([class*='text-'])]:text-muted-foreground",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Last span styling
        "*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}>
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4 text-primary" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props} />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}>
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}>
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
