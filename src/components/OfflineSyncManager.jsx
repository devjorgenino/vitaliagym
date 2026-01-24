"use client";

import { useEffect, useState } from 'react';
import { syncPendingData } from '../lib/data-sync';
import { WifiOff, RefreshCw, CheckCircle2, Wifi, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function OfflineSyncManager() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [dismissedOffline, setDismissedOffline] = useState(false);
  const [pwaOffset, setPwaOffset] = useState(false);
  const [isRestored, setIsRestored] = useState(false);

  useEffect(() => {
    // Check initial status
    setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine);

    const handleOnline = async () => {
      // Show restored state immediately
      setIsRestored(true);
      setIsOffline(false); // Stop showing offline state

      // Attempt sync
      try {
        await syncPendingData();
      } catch (err) {
        console.error("Auto-sync failed:", err);
      }

      // Wait a bit to show the icon, then hide it (optional) or let user dismiss
      setTimeout(() => {
         setIsRestored(false); // Optionally hide the restored icon after some time
         setShowSuccess(true); // Switch to success state
         setTimeout(() => setShowSuccess(false), 3000); // Hide success after 3s
      }, 5000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setDismissedOffline(false);
      setIsRestored(false);
    };

    const attemptSync = async () => {
      if (isSyncing) return;
      try {
        setIsSyncing(true);
        await syncPendingData();
        // Show success message briefly
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch (err) {
        console.error("Auto-sync failed:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    const handlePwaVisibility = (e) => {
      setPwaOffset(e.detail?.visible || false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pwa-toast-visibility-change', handlePwaVisibility);

    // Initial sync attempt if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
       attemptSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pwa-toast-visibility-change', handlePwaVisibility);
    };
  }, []);

  const positionClasses = cn(
    "!fixed !right-4 sm:!right-6 !left-auto z-[100] transition-[bottom] duration-500 ease-in-out",
    pwaOffset ? "!bottom-24" : "!bottom-6"
  );

  const cardClasses = "flex items-start gap-3 px-4 py-3 bg-background text-foreground rounded-lg shadow-lg border border-border animate-in fade-in slide-in-from-bottom-4 duration-300 w-auto max-w-[calc(100vw-2rem)] sm:max-w-sm";

  if (isRestored) {
    return (
      <div className={positionClasses}>
         <Tooltip>
            <TooltipTrigger asChild>
              <button
                  onClick={() => window.location.reload()}
                  className="flex items-center justify-center p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full shadow-lg border border-green-200 dark:border-green-800 animate-in fade-in zoom-in duration-300 cursor-pointer hover:scale-105 transition-transform"
                  aria-label="Conexión restaurada. Click para recargar si es necesario"
              >
                   <Wifi className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Conexión restaurada. (Click para recargar si deseas)</p>
            </TooltipContent>
         </Tooltip>
      </div>
    );
  }

  if (isOffline) {
      if (dismissedOffline) {
          return (
            <div className={positionClasses}>
               <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                        onClick={() => setDismissedOffline(false)}
                        className="flex items-center justify-center p-3 bg-background text-destructive rounded-full shadow-lg border border-border hover:bg-muted/50 transition-colors animate-in fade-in zoom-in duration-300"
                        aria-label="Modo sin conexión"
                    >
                         <WifiOff className="h-5 w-5 animate-pulse" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Modo sin conexión</p>
                  </TooltipContent>
               </Tooltip>
            </div>
          );
      }

      return (
          <div 
            role="status" 
            aria-live="polite"
            className={cn(positionClasses, cardClasses, "relative pr-10")}
          >
             <WifiOff className="h-5 w-5 text-destructive animate-pulse mt-0.5 shrink-0" />
             <div className="flex flex-col gap-1">
               <span className="text-sm font-medium leading-none">Modo sin conexión</span>
               <span className="text-xs text-muted-foreground leading-snug">
                 Puedes seguir usando la app. Los cambios se guardarán y se sincronizarán automáticamente al recuperar la conexión.
               </span>
             </div>
             <button 
                onClick={() => setDismissedOffline(true)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/50 transition-colors"
                aria-label="Minimizar notificación"
             >
                <X className="h-4 w-4" />
             </button>
          </div>
      );
  }

  if (isSyncing) {
      return (
          <div 
            role="status" 
            aria-live="polite"
            className={cn(positionClasses, cardClasses)}
          >
             <RefreshCw className="h-5 w-5 text-primary animate-spin mt-0.5 shrink-0" />
             <div className="flex flex-col gap-1">
               <span className="text-sm font-medium leading-none">Sincronizando...</span>
               <span className="text-xs text-muted-foreground leading-snug">
                 Actualizando tus datos en la nube.
               </span>
             </div>
          </div>
      );
  }

  if (showSuccess) {
      return (
          <div 
            role="status" 
            aria-live="polite"
            className={cn(positionClasses, cardClasses)}
          >
             <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
             <div className="flex flex-col gap-1">
               <span className="text-sm font-medium leading-none">¡Todo al día!</span>
               <span className="text-xs text-muted-foreground leading-snug">
                 Tus cambios se han sincronizado correctamente.
               </span>
             </div>
          </div>
      );
  }

  return null;
}
