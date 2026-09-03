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
import { Loader2, Dumbbell, ArrowRight, Sparkles, Eye, EyeOff } from "lucide-react";
import { logoBlurDataURL } from "@/lib/imagePlaceholders";

const Login = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const finalEmail = (email || e.target.email?.value || e.target[0]?.value || "").trim();
    const finalPassword = password || e.target.password?.value || e.target[1]?.value || "";

    if (!finalEmail || !finalPassword) {
      toast.error("Por favor, completa todos los campos");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: finalEmail,
        password: finalPassword,
      });

      if (error) {
        console.error("Login error:", error);
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Credenciales inválidas. Verifica tu correo y contraseña.");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("El correo no ha sido confirmado. Por favor revisa tu bandeja de entrada.");
        } else {
          toast.error(`Error al iniciar sesión: ${error.message}`);
        }
      } else if (data?.user) {
        toast.success("¡Bienvenido de vuelta!");
        router.push("/dashboard");
      } else {
        toast.error("Respuesta inesperada del servidor");
      }
    } catch (err) {
      console.error("Login exception:", err);
      toast.error(`Error de conexión: ${err.message || "Inténtalo de nuevo."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[--background]">
      {/* Organic background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-1/3 -right-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--secondary) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, var(--primary) 0%, transparent 50%)",
          }}
        />
      </div>

      {/* Floating elements */}
      <div className="absolute top-20 left-10 w-16 h-16 rounded-2xl bg-primary/10 backdrop-blur-sm flex items-center justify-center animate-float hidden sm:flex">
        <Dumbbell className="w-8 h-8 text-primary" />
      </div>
      <div
        className="absolute bottom-32 right-16 w-12 h-12 rounded-xl bg-secondary/20 backdrop-blur-sm flex items-center justify-center animate-float-delayed hidden sm:flex"
        style={{ animationDelay: "1s" }}
      >
        <Sparkles className="w-6 h-6 text-primary" />
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md px-4 sm:px-0">
        <div
          className="relative bg-[--card] border border-[--border]/30 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-md"
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
              ¡Bienvenido de vuelta!
            </h1>
            <p className="text-[--muted-foreground] text-sm">
              Ingresa a tu cuenta para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-[--foreground] ml-1"
              >
                Correo electrónico
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className={`h-12 rounded-xl bg-[--background]/50 border-[--border] px-4 transition-all duration-200 ${
                    focusedField === "email"
                      ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10"
                      : "hover:border-primary/50"
                  }`}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-[--foreground] ml-1"
              >
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`h-12 rounded-xl bg-[--background]/50 border-[--border] px-4 pr-12 transition-all duration-200 ${
                    focusedField === "password"
                      ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10"
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
              <div className="flex justify-end pt-1">
                <Link
                  href="/auth/reset-password"
                  className="text-xs text-primary/80 hover:text-primary font-medium transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Iniciando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Iniciar Sesión
                  <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[--border]/20">
            <p className="text-center text-sm text-[--muted-foreground]">
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

        {/* Back to home */}
        {/*  <div className="text-center mt-6">
          <Link 
            href="/" 
            className="text-sm text-[--muted-foreground] hover:text-primary transition-colors"
          >
            ← Volver al inicio
          </Link>
        </div> */}
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

export default Login;
