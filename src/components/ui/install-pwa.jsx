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
      <div className="flex items-center bg-zinc-900 text-white rounded-full shadow-xl overflow-hidden dark:bg-zinc-100 dark:text-zinc-950 border border-white/10 dark:border-black/5">
        <button 
          onClick={handleInstallClick} 
          className="flex items-center gap-2 px-5 py-3 font-semibold hover:bg-white/10 dark:hover:bg-black/5 transition-colors active:scale-95 duration-200"
        >
          <Download className="h-4 w-4" />
          <span>Instalar App</span>
        </button>
        <div className="w-px h-5 bg-white/20 dark:bg-black/10"></div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
          className="pr-4 pl-3 py-3 hover:bg-white/20 dark:hover:bg-black/10 transition-colors flex items-center justify-center text-white/90 dark:text-zinc-900/90 group"
          aria-label="Cerrar sugerencia de instalación"
        >
          <X className="h-4 w-4 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
}
