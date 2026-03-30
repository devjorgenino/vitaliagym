'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { AvatarSkeleton } from './avatar-skeleton'

function EnhancedAvatarImage({ 
  className, 
  src, 
  alt,
  onLoadingStatusChange,
  ...props 
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef(null)

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    setHasError(false)
    onLoadingStatusChange?.('loaded')
  }, [onLoadingStatusChange])

  const handleError = useCallback(() => {
    setIsLoading(false)
    setHasError(true)
    onLoadingStatusChange?.('error')
  }, [onLoadingStatusChange])

  return (
    <>
      {isLoading && (
        <AvatarSkeleton 
          class={className}
          size={getSizeFromClassName(className)}
        />
      )}
      <Image
        ref={imgRef}
        src={src}
        alt={alt}
        fill
        className={cn(
          "object-cover transition-opacity duration-300",
          isLoading ? "opacity-0 absolute inset-0" : "opacity-100",
          hasError && "hidden",
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        unoptimized={!src?.startsWith('/')}
        {...props}
      />
    </>
  )
}

function getSizeFromClassName(className) {
  if (!className) return "default"
  if (className.includes("w-24") || className.includes("h-24")) return "xl"
  if (className.includes("w-12") || className.includes("h-12")) return "lg"
  if (className.includes("w-6") || className.includes("h-6")) return "sm"
  return "default"
}

export { EnhancedAvatarImage }