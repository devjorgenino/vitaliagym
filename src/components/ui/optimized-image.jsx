'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ImageSkeleton } from './avatar-skeleton'

function OptimizedImage({ 
  src, 
  alt, 
  width, 
  height, 
  className,
  priority = false,
  loading = "lazy",
  placeholder = "blur",
  blurDataURL,
  ...props 
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    setHasError(false)
  }, [])

  const handleError = useCallback(() => {
    setIsLoading(false)
    setHasError(true)
  }, [])

  if (hasError) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted border border-border rounded-md",
          className
        )}
        style={{ width, height }}
      >
        <span className="text-muted-foreground text-sm">Error al cargar imagen</span>
      </div>
    )
  }

  return (
    <div className="relative">
      {isLoading && (
        <ImageSkeleton 
          width={width}
          height={height}
          className={className}
        />
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0 absolute inset-0" : "opacity-100",
          className
        )}
        priority={priority}
        loading={loading}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  )
}

export { OptimizedImage }