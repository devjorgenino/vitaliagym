"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Si ya está ejecutándose como app (standalone), no mostrar nada
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstallable(false);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const installedHandler = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  // Notificar cambios de visibilidad para ajustar otros elementos UI (como el toast offline)
  useEffect(() => {
    const isVisible = isInstallable && !isDismissed;
    const event = new CustomEvent('pwa-toast-visibility-change', { detail: { visible: isVisible } });
    window.dispatchEvent(event);
  }, [isInstallable, isDismissed]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (!isInstallable || isDismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center bg-background text-foreground rounded-full shadow-xl overflow-hidden border border-input">
        <button 
          onClick={handleInstallClick} 
          className="flex items-center gap-2 px-5 py-3 font-semibold hover:bg-accent transition-colors active:scale-95 duration-200"
        >
          <Download className="h-4 w-4" />
          <span>Instalar App</span>
        </button>
        <div className="w-px h-5 bg-border"></div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
          className="pr-4 pl-3 py-3 hover:bg-accent transition-colors flex items-center justify-center group"
          aria-label="Cerrar sugerencia de instalación"
        >
          <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:scale-110 transition-all" />
        </button>
      </div>
    </div>
  );
}
