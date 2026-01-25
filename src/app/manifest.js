export default function manifest() {
  return {
    name: 'VitaliaGym',
    short_name: 'VitaliaGym',
    description: 'Somos la energía vital en movimiento. Un lugar para entrenar de forma eficiente e inteligente',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
