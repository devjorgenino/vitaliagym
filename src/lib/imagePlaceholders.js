// Placeholder mejorado para logo expandido
export const logoBlurDataURL = "data:image/svg+xml;base64," + btoa(`
  <svg width="144" height="40" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#dbeafe;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="144" height="40" fill="url(#logoGrad)" rx="12"/>
    <text x="72" y="25" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="#6366f1" text-anchor="middle" opacity="0.7">Vitalia</text>
  </svg>
`);

// Placeholder elegante para logo colapsado
export const logoSmallBlurDataURL = "data:image/svg+xml;base64," + btoa(`
  <svg width="36" height="36" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logoGradSmall" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#dbeafe;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="36" height="36" fill="url(#logoGradSmall)" rx="8"/>
    <circle cx="18" cy="18" r="6" fill="#6366f1" opacity="0.6"/>
  </svg>
`);