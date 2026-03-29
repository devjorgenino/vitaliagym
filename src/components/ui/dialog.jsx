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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Combining multiple refs into one callback
  return React.useCallback((element) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(element);
      } else {
        ref.current = element;
      }
    });
  }, []);
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
  ({ className, children, size = "default", ...props }, ref) => {
    const contentRef = React.useRef(null);
    const combinedRef = useCombinedRefs(ref, contentRef);

    const sizeClasses = {
      default: "max-w-2xl",
      large: "max-w-4xl",
      full: "max-w-full",
    };

    React.useEffect(() => {
      const el = contentRef.current;
      if (!el) return;

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
            "fixed z-50",
            "inset-0 md:inset-auto md:left-[50%] md:top-[50%] md:translate-x-[-50%] md:translate-y-[-50%]",
            "w-full md:w-[85vw]",
            sizeClasses[size] || sizeClasses.default,
            "flex flex-col",
            "border-0 md:border bg-background shadow-xl",
            "rounded-none md:rounded-lg",
            "p-3 sm:p-4 md:p-5 overflow-y-auto",
            "max-h-[90vh] pb-4",
            "data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0",
            "data-[state=closed]:zoom-out-[0.98]",
            "data-[state=closed]:duration-75",
            "focus:outline-none",
            "motion-reduce:transform-none",
            className
          )}
          {...props}
        >
          <div className="flex-1 px-3">
            {children}
          </div>
          <DialogPrimitive.Close
            className={cn(
              "absolute right-2 top-2 md:right-3 md:top-3",
              "rounded-sm p-1.5",
              "text-muted-foreground/60",
              "transition-colors duration-75",
              "hover:text-foreground hover:bg-accent",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "active:scale-95",
              "disabled:pointer-events-none",
              "min-h-[36px] min-w-[36px] md:min-h-0 md:min-w-0",
              "flex items-center justify-center",
              "z-10"
            )}
            aria-label="Cerrar dialogo"
          >
            <X className="h-4 w-4 md:h-4 md:w-4" />
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
