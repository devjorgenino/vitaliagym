"use client";

import React, { useState } from "react";
import "@/styles/image-optimization.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import client from "@/api/client";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";

const ResetPassword = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useCriticalImagePreload();

  const handleResetRequest = async (e) => {
    e.preventDefault();

    if (!email) {
      toast.error("Por favor, ingresa tu correo electrónico");
      return;
    }

    setLoading(true);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) {
        toast.error(
          error.message || "Error al enviar el correo de recuperación",
        );
      } else {
        setEmailSent(true);
        toast.success("¡Correo enviado! Revisa tu bandeja de entrada.");
      }
    } catch (err) {
      toast.error("Error al procesar la solicitud. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen w-full flex">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop"
            alt="Gimnasio moderno"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/80 to-[#4a5a1a]/90" />
          
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-32 right-32 w-96 h-96 bg-secondary/30 rounded-full blur-3xl" />
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-64 h-48 sm:w-72 sm:h-54 lg:w-96 lg:h-72 lg:absolute lg:top-0">
              <Image
                src="/logo-dark.png"
                alt="VitaliaGym"
                fill
                sizes="(max-width: 768px) 256px, (max-width: 1024px) 288px, 320px"
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white text-left leading-tight lg:absolute lg:top-52 lg:left-0">
              Tu energía vital<br />en movimiento
            </h1>
          </div>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 bg-background">
          <div className="lg:hidden relative w-full mb-6">
            <div className="absolute left-1/2 -translate-x-1/2 top-0 w-48 h-36 sm:w-56 sm:h-42">
              <Image
                src="/logo-light.png"
                alt="VitaliaGym"
                fill
                sizes="(max-width: 640px) 192px, 224px"
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="w-full max-w-md lg:mt-0 mt-24 md:mt-32">
            <div className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-6">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  ¡Correo enviado!
                </h2>
                <p className="text-muted-foreground">
                  Hemos enviado un enlace de recuperación a<br />
                  <span className="font-semibold text-foreground">{email}</span>
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
                <p>
                  Revisa tu bandeja de entrada y sigue las instrucciones para 
                  restablecer tu contraseña. El enlace expira en 1 hora.
                </p>
              </div>

              <Link href="/auth/login" className="block">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop"
          alt="Gimnasio moderno"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/80 to-[#4a5a1a]/90" />
        
        <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 right-32 w-96 h-96 bg-secondary/30 rounded-full blur-3xl" />
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-64 h-48 sm:w-72 sm:h-54 lg:w-[28rem] lg:h-80">
            <Image
              src="/logo-dark.png"
              alt="VitaliaGym"
              fill
              sizes="(max-width: 768px) 256px, (max-width: 1024px) 288px, 448px"
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>

        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 bg-background">
          <div className="lg:hidden relative w-full mb-6">
            <div className="absolute left-1/2 -translate-x-1/2 top-0 w-48 h-36 sm:w-56 sm:h-42">
              <Image
                src="/logo-light.png"
                alt="VitaliaGym"
                fill
                sizes="(max-width: 640px) 192px, 224px"
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="w-full max-w-md lg:mt-0 mt-24 md:mt-32">
            <div className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  ¿Olvidaste tu contraseña?
                </h2>
                <p className="text-muted-foreground">
                  Ingresa tu correo y te enviaremos un enlace para recuperarla
                </p>
              </div>

            <form onSubmit={handleResetRequest} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`h-10 transition-all duration-200 ${
                    focusedField === "email"
                      ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/5"
                      : ""
                  }`}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Enviar enlace de recuperación
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  O
                </span>
              </div>
            </div>

            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </Link>
            </div>
          </div>
      </div>
    </div>
  );
};

export default ResetPassword;
