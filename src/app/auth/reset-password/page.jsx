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
  Sparkles,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";
import { logoBlurDataURL } from "@/lib/imagePlaceholders";

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
      <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[--background] p-4">
        {/* Organic background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-md px-4">
          <div
            className="bg-[--card] border border-[--border]/30 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-md text-center"
            style={{
              boxShadow:
                "0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255,255,255,0.5) inset",
            }}
          >
            {/* Success icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[--foreground] mb-3">
              ¡Correo enviado!
            </h1>
            <p className="text-[--muted-foreground] mb-6">
              Hemos enviado un enlace de recuperación a <br />
              <span className="font-semibold text-[--foreground]">{email}</span>
            </p>

            <div className="bg-[--background]/50 rounded-xl p-4 mb-6 text-sm text-[--muted-foreground]">
              <p>
                Revisa tu bandeja de entrada y sigue las instrucciones para
                restablecer tu contraseña.
              </p>
            </div>

            <Link href="/auth/login" className="block">
              <Button
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al inicio de sesión
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[--background] p-4">
      {/* Organic background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-1/3 -left-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--secondary) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Floating elements */}
      <div className="absolute top-20 left-10 w-12 h-12 rounded-xl bg-primary/10 backdrop-blur-sm flex items-center justify-center animate-float hidden sm:flex">
        <Mail className="w-6 h-6 text-primary" />
      </div>
      <div
        className="absolute bottom-32 right-16 w-10 h-10 rounded-lg bg-secondary/20 backdrop-blur-sm flex items-center justify-center animate-float-delayed hidden sm:flex"
        style={{ animationDelay: "1s" }}
      >
        <Sparkles className="w-5 h-5 text-primary" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div
          className="bg-[--card] border border-[--border]/30 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-md"
          style={{
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255,255,255,0.5) inset",
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="relative w-28 h-20">
              <Image
                src="/logo.png"
                alt="VitaliaGym"
                fill
                sizes="112px"
                priority={true}
                placeholder="blur"
                blurDataURL={logoBlurDataURL}
                className="object-contain"
              />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[--foreground] mb-2">
              ¿Olvidaste tu contraseña?
            </h1>
            <p className="text-[--muted-foreground] text-sm">
              No te preocupes, te enviaremos un enlace para recuperarla
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleResetRequest} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-[--foreground] ml-1"
              >
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
                className={`h-10 rounded-md bg-[--background]/50 border-[--border] px-4 transition-all duration-200 ${
                  focusedField === "email"
                    ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10"
                    : "hover:border-primary/50"
                }`}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
              />
              <p className="text-xs text-[--muted-foreground] px-1">
                Ingresa tu correo y te enviaremos un enlace de recuperación
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Enviar enlace de recuperación
                  <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[--border]/20">
            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 text-sm text-[--muted-foreground] hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes float-delayed {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-15px);
          }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ResetPassword;
