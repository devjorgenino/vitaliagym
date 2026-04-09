import * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  variant = "pulse",
  ...props
}) {
  return (
    <div
      data-slot="skeleton"
      role="status"
      aria-label="Cargando..."
      className={cn(
        "bg-muted/60 rounded-md overflow-hidden",
        variant === "shimmer" && "animate-shimmer relative isolate",
        variant === "pulse" && "animate-pulse",
        className
      )}
      {...props}
    />
  );
}

// Skeleton variants for common use cases
function SkeletonText({ className, lines = 1, ...props }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 && "w-4/5"
          )} 
        />
      ))}
    </div>
  );
}

function SkeletonCard({ className, ...props }) {
  return (
    <div 
      className={cn("rounded-xl border p-4 space-y-3", className)} 
      {...props}
    >
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

function SkeletonAvatar({ className, size = "default", ...props }) {
  const sizeClasses = {
    sm: "size-8",
    default: "size-10",
    lg: "size-12",
    xl: "size-16",
  };
  
  return (
    <Skeleton 
      className={cn("rounded-full", sizeClasses[size], className)} 
      {...props} 
    />
  );
}

function SkeletonButton({ className, size = "default", ...props }) {
  const sizeClasses = {
    sm: "h-8 w-20",
    default: "h-9 w-24",
    lg: "h-11 w-28",
  };
  
  return (
    <Skeleton 
      className={cn("rounded-md", sizeClasses[size], className)} 
      {...props} 
    />
  );
}

function SkeletonTable({ rows = 5, cols = 4, className, ...props }) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-10 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-12 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export { 
  Skeleton, 
  SkeletonText, 
  SkeletonCard, 
  SkeletonAvatar, 
  SkeletonButton,
  SkeletonTable 
}
