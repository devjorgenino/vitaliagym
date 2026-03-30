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
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";

const UpdatePassword = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

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
      } finally {
        setIsChecking(false);
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

  if (isChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Verificando enlace...</span>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
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
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Enlace inválido o expirado
                </h2>
                <p className="text-muted-foreground">
                  El enlace de recuperación ha expirado o ya fue utilizado.
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
                <p>
                  Solicita un nuevo enlace de recuperación de contraseña desde 
                  la página de inicio de sesión.
                </p>
              </div>

              <div className="space-y-3">
                <Link href="/auth/reset-password" className="block">
                  <Button className="w-full">
                    Solicitar nuevo enlace
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
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
                  Nueva contraseña
                </h2>
                <p className="text-muted-foreground">
                  Ingresa tu nueva contraseña para completar el proceso
                </p>
              </div>

            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
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
                    className={`h-10 pr-10 transition-all duration-200 ${
                      focusedField === "password"
                        ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/5"
                        : ""
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
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
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
                    className={`h-10 pr-10 transition-all duration-200 ${
                      focusedField === "confirmPassword"
                        ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/5"
                        : ""
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
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Actualizando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Actualizar contraseña
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

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

export default UpdatePassword;
