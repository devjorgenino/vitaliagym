"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import client from "@/api/client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Shield,
  ArrowRight,
  Sparkles,
  Dumbbell,
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";
import useRolesList from "@/hooks/useRolesList";
import { logoBlurDataURL } from "@/lib/imagePlaceholders";
import { PHONE_OPERATORS, formatPhone } from "@/lib/venezuelanData";
import "@/styles/image-optimization.css";

const Registro = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const { roles, loading: rolesLoading } = useRolesList();

  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    phone_operator: "0414",
    phone: "",
    password: "",
    password2: "",
    roleId: "",
  });

  useCriticalImagePreload();

  useEffect(() => {
    if (roles.length > 0 && !formData.roleId) {
      const defaultRole =
        roles.find((r) => r.name === "Entrenador") || roles[0];
      setFormData((prev) => ({ ...prev, roleId: defaultRole.id }));
    }
  }, [roles, formData.roleId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value) => {
    setFormData((prev) => ({ ...prev, roleId: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    const { firstname, lastname, email, phone, password, password2, roleId } =
      formData;

    if (!email || !password || !password2 || !firstname || !lastname) {
      toast.error("Por favor, completa todos los campos obligatorios");
      return;
    }

    if (password !== password2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: firstname + " " + lastname,
            phone: phone ? formatPhone(formData.phone_operator, phone) : "",
          },
        },
      });

      if (error) {
        toast.error(error.message || "Error al registrarte. Intenta de nuevo.");
        return;
      }

      if (data?.user) {
        if (roleId && roleId !== "default") {
          await client.from("user_roles").delete().eq("user_id", data.user.id);

          const { error: roleError } = await client.from("user_roles").insert({
            user_id: data.user.id,
            role_id: roleId,
          });

          if (roleError) {
            console.warn("Error al asignar rol:", roleError);
          }
        }

        toast.success("¡Registro exitoso! Por favor inicia sesión.");
        await client.auth.signOut();
        router.push("/auth/login");
      }
    } catch (err) {
      console.error("Error en registro:", err);
      toast.error("Error al registrarte. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

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
          className="absolute -bottom-1/4 -left-1/3 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--secondary) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Floating elements */}
      <div className="absolute top-16 right-12 w-14 h-14 rounded-2xl bg-primary/10 backdrop-blur-sm flex items-center justify-center animate-float hidden sm:flex">
        <UserPlus className="w-7 h-7 text-primary" />
      </div>
      <div
        className="absolute bottom-24 left-16 w-12 h-12 rounded-xl bg-secondary/20 backdrop-blur-sm flex items-center justify-center animate-float-delayed hidden sm:flex"
        style={{ animationDelay: "1.5s" }}
      >
        <Sparkles className="w-6 h-6 text-primary" />
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-lg">
        <div
          className="relative bg-[--card] border border-[--border]/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md"
          style={{
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255,255,255,0.5) inset",
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative w-24 h-16">
              <Image
                src="/logo.png"
                alt="VitaliaGym"
                fill
                sizes="96px"
                priority={true}
                placeholder="blur"
                blurDataURL={logoBlurDataURL}
                className="object-contain"
              />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-[--foreground] mb-2">
              ¡Únete a VitaliaGym!
            </h1>
            <p className="text-[--muted-foreground] text-sm">
              Crea tu cuenta y comienza a entrenar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="firstname"
                  className="text-sm font-medium text-[--foreground] ml-1"
                >
                  Nombre *
                </Label>
                <Input
                  id="firstname"
                  name="firstname"
                  type="text"
                  placeholder="Tu nombre"
                  value={formData.firstname}
                  onChange={handleInputChange}
                  required
                  className={`h-11 rounded-xl bg-[--background]/50 border-[--border] transition-all duration-200 ${
                    focusedField === "firstname"
                      ? "border-primary ring-2 ring-primary/20"
                      : "hover:border-primary/50"
                  }`}
                  onFocus={() => setFocusedField("firstname")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="lastname"
                  className="text-sm font-medium text-[--foreground] ml-1"
                >
                  Apellido *
                </Label>
                <Input
                  id="lastname"
                  name="lastname"
                  type="text"
                  placeholder="Tu apellido"
                  value={formData.lastname}
                  onChange={handleInputChange}
                  required
                  className={`h-11 rounded-xl bg-[--background]/50 border-[--border] transition-all duration-200 ${
                    focusedField === "lastname"
                      ? "border-primary ring-2 ring-primary/20"
                      : "hover:border-primary/50"
                  }`}
                  onFocus={() => setFocusedField("lastname")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-[--foreground] ml-1"
              >
                Correo electrónico *
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={handleInputChange}
                required
                className={`h-11 rounded-xl bg-[--background]/50 border-[--border] transition-all duration-200 ${
                  focusedField === "email"
                    ? "border-primary ring-2 ring-primary/20"
                    : "hover:border-primary/50"
                }`}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
              />
            </div>

            {/* Phone and Role */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="phone"
                  className="text-sm font-medium text-[--foreground] ml-1"
                >
                  Teléfono
                </Label>
                <div className="flex gap-1">
                  <Select
                    value={formData.phone_operator}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone_operator: value,
                      }))
                    }
                  >
                    <SelectTrigger
                      size="lg"
                      className="w-[85px] rounded-xl bg-[--background]/50 border-[--border] px-3"
                      aria-label="Operador telefónico"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHONE_OPERATORS.map((op) => (
                        <SelectItem key={op.code} value={op.code}>
                          <span className="font-medium">{op.code}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="1234567"
                    maxLength={7}
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="flex-1 h-11 rounded-xl bg-[--background]/50 border-[--border] px-3"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="role"
                  className="text-sm font-medium text-[--foreground] ml-1 flex items-center gap-1"
                >
                  <Shield className="w-3 h-3" />
                  Rol *
                </Label>
                <Select
                  value={formData.roleId}
                  onValueChange={handleRoleChange}
                  disabled={rolesLoading}
                >
                  <SelectTrigger size="lg" className="rounded-xl bg-[--background]/50 border-[--border] px-3">
                    <SelectValue
                      placeholder={rolesLoading ? "Cargando..." : "Selecciona"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-[--foreground] ml-1"
                >
                  Contraseña *
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mín. 6 caracteres"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className={`h-11 rounded-xl bg-[--background]/50 border-[--border] pr-12 transition-all duration-200 ${
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
              <div className="space-y-1.5">
                <Label
                  htmlFor="password2"
                  className="text-sm font-medium text-[--foreground] ml-1"
                >
                  Confirmar *
                </Label>
                <div className="relative">
                  <Input
                    id="password2"
                    name="password2"
                    type={showPassword2 ? "text" : "password"}
                    placeholder="Repite"
                    value={formData.password2}
                    onChange={handleInputChange}
                    required
                    className={`h-11 rounded-xl bg-[--background]/50 border-[--border] pr-12 transition-all duration-200 ${
                      focusedField === "password2"
                        ? "border-primary ring-2 ring-primary/20"
                        : "hover:border-primary/50"
                    }`}
                    onFocus={() => setFocusedField("password2")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword2(!showPassword2)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword2 ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword2 ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || rolesLoading}
              className="w-full mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creando cuenta...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Crear Cuenta
                  <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-[--border]/20">
            <p className="text-center text-sm text-[--muted-foreground]">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/auth/login"
                className="text-primary font-semibold hover:text-primary/80 transition-colors inline-flex items-center gap-1"
              >
                Iniciar Sesión
                <ArrowRight className="w-4 h-4" />
              </Link>
            </p>
          </div>
        </div>

        {/* Back to home */}
        <div className="text-center mt-5">
          <Link
            href="/"
            className="text-sm text-[--muted-foreground] hover:text-primary transition-colors"
          >
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
        }
        @keyframes float-delayed {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-18px);
          }
        }
        .animate-float {
          animation: float 4.5s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 5.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Registro;
