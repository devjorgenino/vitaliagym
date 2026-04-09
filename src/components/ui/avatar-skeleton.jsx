'use client'

import { cn } from "@/lib/utils"

export function AvatarSkeleton({ className, size = "default" }) {
  const sizeClasses = {
    sm: "w-6 h-6",
    default: "w-8 h-8", 
    lg: "w-12 h-12",
    xl: "w-24 h-24"
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-full bg-muted",
      sizeClasses[size],
      className
    )}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent animate-shimmer" />
      <div className="absolute inset-0 bg-muted animate-pulse" />
    </div>
  )
}

export function ImageSkeleton({ className, width, height, ...props }) {
  return (
    <div 
      className={cn(
        "relative overflow-hidden bg-muted animate-pulse rounded-md",
        className
      )}
      style={{ width, height }}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent animate-shimmer" />
    </div>
  )
}

export function LogoSkeleton({ width = 200, height = 200, className }) {
  return (
    <div 
      className={cn(
        "relative overflow-hidden bg-muted animate-pulse rounded-lg",
        className
      )}
      style={{ width, height }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent animate-shimmer" />
    </div>
  )
}