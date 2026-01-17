'use client'

import { useEffect } from 'react'

export function useImagePreload(images, options = {}) {
  const { priority = false, as = 'image' } = options
  
  useEffect(() => {
    images.forEach((src) => {
      // Preload original image
      const link = document.createElement('link')
      link.rel = priority ? 'preload' : 'prefetch'
      link.as = as
      link.href = src
      link.crossOrigin = 'anonymous'
      
      // Add priority hints for critical images
      if (priority) {
        link.setAttribute('importance', 'high')
      }
      
      document.head.appendChild(link)
      
      // Also preload WebP versions for better performance
      if (src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg')) {
        const webpLink = document.createElement('link')
        webpLink.rel = priority ? 'preload' : 'prefetch'
        webpLink.as = as
        webpLink.href = src.replace(/\.(png|jpg|jpeg)$/, '.webp')
        webpLink.type = 'image/webp'
        webpLink.crossOrigin = 'anonymous'
        
        if (priority) {
          webpLink.setAttribute('importance', 'high')
        }
        
        document.head.appendChild(webpLink)
      }
    })
  }, [images, priority, as])
}

export function useCriticalImagePreload() {
  useEffect(() => {
    // Critical images for login and sidebar
    const criticalImages = [
      '/logo.png',
      '/logo-sidebar.png', 
      '/logo-collapsible.png'
    ]
    
    // Create resource hints for instant loading
    criticalImages.forEach(src => {
      // DNS prefetch for the domain
      const dnsLink = document.createElement('link')
      dnsLink.rel = 'dns-prefetch'
      dnsLink.href = window.location.origin
      document.head.appendChild(dnsLink)
      
      // Preconnect for faster connection
      const preconnectLink = document.createElement('link')
      preconnectLink.rel = 'preconnect'
      preconnectLink.href = window.location.origin
      preconnectLink.crossOrigin = 'anonymous'
      document.head.appendChild(preconnectLink)
      
      // Preload the image with highest priority
      const preloadLink = document.createElement('link')
      preloadLink.rel = 'preload'
      preloadLink.as = 'image'
      preloadLink.href = src
      preloadLink.crossOrigin = 'anonymous'
      preloadLink.setAttribute('importance', 'high')
      document.head.appendChild(preloadLink)
    })
  }, [])
}