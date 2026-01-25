"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import gsap from "gsap";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

// Hook para combinar refs
function useCombinedRefs(...refs) {
  return React.useCallback((element) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(element);
      } else {
        ref.current = element;
      }
    });
  }, refs);
}

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => {
  const overlayRef = React.useRef(null);
  const combinedRef = useCombinedRefs(ref, overlayRef);

  React.useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    // Animación ultra rápida
    gsap.fromTo(
      el,
      { opacity: 0 },
      { opacity: 1, duration: 0.08, ease: "power1.out" }
    );
  }, []);

  return (
    <DialogPrimitive.Overlay
      ref={combinedRef}
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
        // Animación de salida CSS ultra rápida
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-75",
        className
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    const contentRef = React.useRef(null);
    const combinedRef = useCombinedRefs(ref, contentRef);

    React.useEffect(() => {
      const el = contentRef.current;
      if (!el) return;

      // Animacion snappy de entrada
      gsap.fromTo(
        el,
        {
          opacity: 0,
          scale: 0.96,
        },
        {
          opacity: 1,
          scale: 1,
          duration: 0.1,
          ease: "power2.out",
        }
      );
    }, []);

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={combinedRef}
          className={cn(
            // Positioning - full screen en movil, centrado en desktop
            "fixed z-50",
            "inset-0 sm:inset-auto",
            "sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]",
            // Layout
            "flex flex-col sm:grid w-full sm:max-w-lg gap-3 sm:gap-4",
            // Appearance
            "border-0 sm:border bg-background shadow-xl",
            "rounded-none sm:rounded-lg",
            // Padding responsive
            "p-4 sm:p-6",
            // Max height y scroll
            "max-h-screen sm:max-h-[90vh]",
            "overflow-y-auto",
            // Animacion de salida CSS ultra rapida
            "data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0",
            "data-[state=closed]:zoom-out-[0.98]",
            "data-[state=closed]:duration-75",
            // Focus
            "focus:outline-none",
            // Reduced motion
            "motion-reduce:transform-none",
            className
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close
            className={cn(
              "absolute right-3 top-3 sm:right-4 sm:top-4",
              "rounded-sm p-1.5 sm:p-1",
              "text-muted-foreground/60",
              "transition-colors duration-75",
              "hover:text-foreground hover:bg-accent",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "active:scale-95",
              "disabled:pointer-events-none",
              // Touch target mas grande en movil
              "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0",
              "flex items-center justify-center"
            )}
            aria-label="Cerrar dialogo"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  }
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
