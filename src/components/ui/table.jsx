import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Accessible Table component with improved UX and responsive design
 */

const Table = React.forwardRef(({ 
  className, 
  "aria-label": ariaLabel,
  responsive = true,
  ...props 
}, ref) => (
  <div 
    className={cn(
      "relative w-full",
      responsive && "overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin",
    )}
    role="region"
    aria-label={ariaLabel || "Tabla de datos"}
    tabIndex={0}
  >
    <table
      ref={ref}
      className={cn(
        "w-full caption-bottom text-sm border-collapse",
        "min-w-[600px] sm:min-w-0",
        className
      )}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead 
    ref={ref} 
    className={cn(
      "[&_tr]:border-b bg-muted/40",
      "sticky top-0 z-10",
      className
    )} 
    {...props} 
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      "[&_tr:last-child]:border-0",
      // Zebra striping opcional
      "[&_tr:nth-child(even)]:bg-muted/20",
      className
    )}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef(({ 
  className, 
  isClickable,
  selected,
  ...props 
}, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors duration-75",
      "hover:bg-muted/50",
      "focus-within:bg-muted/40",
      "data-[state=selected]:bg-muted",
      isClickable && "cursor-pointer active:bg-muted/60",
      selected && "bg-primary/10 hover:bg-primary/15",
      className
    )}
    aria-selected={selected ? "true" : undefined}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn(
      // Sizing
      "h-10 sm:h-11 px-2 sm:px-3",
      // Typography
      "text-left align-middle font-semibold text-xs sm:text-sm text-muted-foreground",
      // Whitespace
      "whitespace-nowrap",
      // Checkbox alignment
      "[&:has([role=checkbox])]:pr-0",
      // First/last padding
      "first:pl-3 sm:first:pl-4 last:pr-3 sm:last:pr-4",
      // Sortable styles
      "[&[aria-sort]]:cursor-pointer [&[aria-sort]]:select-none",
      "[&[aria-sort]]:hover:bg-muted/30",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      // Sizing
      "px-2 sm:px-3 py-2.5 sm:py-3",
      // Alignment
      "align-middle",
      // Checkbox alignment
      "[&:has([role=checkbox])]:pr-0",
      // First/last padding
      "first:pl-3 sm:first:pl-4 last:pr-3 sm:last:pr-4",
      // Text
      "text-sm",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn(
      "mt-4 text-sm text-muted-foreground text-center",
      className
    )}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

// Empty state component for tables
const TableEmpty = React.forwardRef(({ 
  className,
  colSpan = 1,
  icon: Icon,
  title = "No hay datos",
  description,
  action,
  ...props 
}, ref) => (
  <tr ref={ref} {...props}>
    <td 
      colSpan={colSpan}
      className={cn(
        "h-48 text-center",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center gap-2 py-8">
        {Icon && <Icon className="size-10 text-muted-foreground/50" aria-hidden="true" />}
        <p className="text-muted-foreground font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground/70 text-sm max-w-sm">{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </td>
  </tr>
))
TableEmpty.displayName = "TableEmpty"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
}
