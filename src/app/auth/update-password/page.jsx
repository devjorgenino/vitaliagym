"use client";

import React, { useState, useEffect } from "react";
import "@/styles/image-optimization.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import client from "@/api/client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";
import { logoBlurDataURL } from "@/lib/imagePlaceholders";

const UpdatePassword = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);

  useCriticalImagePreload();

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const { data: { session }, error } = await client.auth.getSession();
        
        if (error || !session) {
          setIsValidToken(false);
        }
      } catch (err) {
        setIsValidToken(false);
      }
    };

    verifyToken();
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error("Por favor, completa todos los campos");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { error } = await client.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message || "Error al actualizar la contraseña");
      } else {
        toast.success("Contraseña actualizada correctamente");
        setTimeout(() => {
          router.push("/auth/login");
        }, 2000);
      }
    } catch (err) {
      toast.error("Error al procesar la solicitud. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!isValidToken) {
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
        </div>

        <div className="relative z-10 w-full max-w-md px-4">
          <div
            className="bg-[--card] border border-[--border]/30 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-md text-center"
            style={{
              boxShadow:
                "0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255,255,255,0.5) inset",
            }}
          >
            {/* Error icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-red-500" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[--foreground] mb-3">
              Enlace inválido o expirado
            </h1>
            <p className="text-[--muted-foreground] mb-6">
              El enlace de recuperación ha expirado o ya fue utilizado.
            </p>

            <div className="bg-[--background]/50 rounded-xl p-4 mb-6 text-sm text-[--muted-foreground]">
              <p>
                Solicita un nuevo enlace de recuperación de contraseña.
              </p>
            </div>

            <div className="space-y-3">
              <Link href="/auth/reset-password" className="block">
                <Button className="w-full">
                  Solicitar nuevo enlace
                </Button>
              </Link>
              <Link href="/auth/login" className="block">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-5 h-5 mr-2" />
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
          className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Floating decorative icons */}
      <div className="absolute top-32 left-10 w-12 h-12 rounded-xl bg-primary/10 backdrop-blur-sm flex items-center justify-center animate-float hidden sm:flex">
        <Sparkles className="w-6 h-6 text-primary" />
      </div>
      <div className="absolute bottom-32 right-10 w-10 h-10 rounded-xl bg-secondary/20 backdrop-blur-sm flex items-center justify-center animate-float-delayed hidden sm:flex">
        <CheckCircle2 className="w-5 h-5 text-secondary-foreground" />
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
              Nueva contraseña
            </h1>
            <p className="text-[--muted-foreground] text-sm">
              Ingresa tu nueva contraseña
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-[--foreground] ml-1"
              >
                Nueva Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`h-10 rounded-md bg-[--background]/50 border-[--border] px-4 pr-12 transition-all duration-200 ${
                    focusedField === "password"
                      ? "border-primary ring-2 ring-primary/20"
                      : "hover:border-primary/50"
                  }`}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-[--foreground] ml-1"
              >
                Confirmar Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`h-10 rounded-md bg-[--background]/50 border-[--border] px-4 pr-12 transition-all duration-200 ${
                    focusedField === "confirmPassword"
                      ? "border-primary ring-2 ring-primary/20"
                      : "hover:border-primary/50"
                  }`}
                  onFocus={() => setFocusedField("confirmPassword")}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-[--muted-foreground] px-1">
                La contraseña debe tener al menos 6 caracteres.
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
                  Actualizando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Actualizar contraseña
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
    </div>
  );
};

export default UpdatePassword;
