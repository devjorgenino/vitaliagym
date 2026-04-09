/**
 * Logo de VitaliaGym en formato base64 para uso en PDFs
 * Usa logo-reports.svg con fondo transparente
 */

// Cache para el logo
let cachedLogo = null;

/**
 * Carga y convierte el logo SVG a PNG para uso en PDFs
 * Mantiene la proporción original del SVG (3644.37 x 1300 = ~2.8:1)
 * @returns {Promise<string|null>} Logo en base64 o null si falla
 */
export const loadLogoForPDF = async () => {
  if (cachedLogo) return cachedLogo;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        
        // Proporción original del SVG: 3644.37 x 1300 = 2.803:1
        const aspectRatio = 3644.37 / 1300;
        
        // Ancho objetivo para el PDF (en píxeles, considerando ~3px por mm)
        // Para un logo de ~55mm de ancho en el PDF
        const targetWidth = 180;
        const targetHeight = Math.round(targetWidth / aspectRatio);
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext("2d");
        
        // Fondo transparente (no rellenamos)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar imagen manteniendo proporción
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        // Convertir a PNG para mantener transparencia
        cachedLogo = canvas.toDataURL("image/png");
        resolve(cachedLogo);
      } catch (err) {
        console.warn("Error procesando logo:", err);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      console.warn("No se pudo cargar el logo");
      resolve(null);
    };
    
    // Usar el logo SVG para reportes
    img.src = "/logo-reports.svg";
  });
};

/**
 * Pre-carga el logo para que esté disponible inmediatamente
 */
export const preloadLogo = () => {
  if (typeof window !== "undefined") {
    loadLogoForPDF();
  }
};

/**
 * Obtiene las dimensiones del logo para el PDF
 * @param {number} maxWidth - Ancho máximo en mm
 * @returns {{ width: number, height: number }} Dimensiones en mm
 */
export const getLogoDimensions = (maxWidth = 55) => {
  const aspectRatio = 3644.37 / 1300; // ~2.803:1
  const width = maxWidth;
  const height = width / aspectRatio;
  return { width, height };
};
