"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import { AvatarSkeleton } from "./avatar-skeleton"

function Avatar({
  className,
  ...props
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)}
      {...props} />
  );
}

function AvatarImage({
  className,
  src,
  alt,
  ...props
}) {
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasError, setHasError] = React.useState(false)

  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  return (
    <div className="relative size-full">
      {isLoading && (
        <AvatarSkeleton 
          className="absolute inset-0"
          size={getSizeFromClassName(className)}
        />
      )}
      <AvatarPrimitive.Image
        data-slot="avatar-image"
        src={src}
        alt={alt}
        className={cn(
          "aspect-square size-full transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          hasError && "hidden",
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        {...props} 
      />
    </div>
  );
}

function getSizeFromClassName(className) {
  if (!className) return "default"
  if (className.includes("w-24") || className.includes("h-24")) return "xl"
  if (className.includes("w-12") || className.includes("h-12")) return "lg"
  if (className.includes("w-6") || className.includes("h-6")) return "sm"
  return "default"
}

function AvatarFallback({
  className,
  ...props
}) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props} />
  );
}

export { Avatar, AvatarImage, AvatarFallback }
