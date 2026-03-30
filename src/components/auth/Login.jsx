"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import client from "@/api/client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";

const Login = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target[0]?.value;
    const password = e.target[1]?.value;

    if (!email || !password) {
      toast.error("Por favor, completa todos los campos");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Error al iniciar sesión. Verifica tus credenciales.");
      } else if (data?.user) {
        toast.success("¡Bienvenido de vuelta!");
        router.push("/dashboard");
      } else {
        toast.error("Respuesta inesperada del servidor");
      }
    } catch (err) {
      toast.error("Error al iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

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
              ¡Bienvenido de nuevo!
            </h2>
            <p className="text-muted-foreground">
              Ingresa a tu cuenta para continuar entrenando
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  className={`h-10 pr-12 transition-all duration-200 ${
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
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="flex justify-end">
                <Link
                  href="/auth/reset-password"
                  className="text-sm text-primary/80 hover:text-primary font-medium transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Iniciando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Iniciar Sesión
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

          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link
              href="/auth/registro"
              className="text-primary font-semibold hover:text-primary/80 transition-colors inline-flex items-center gap-1"
            >
              Regístrate
              <ArrowRight className="w-4 h-4" />
            </Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
