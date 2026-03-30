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
import { Loader2, Shield, ArrowRight } from "lucide-react";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";
import useRolesList from "@/hooks/useRolesList";
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
              ¡Únete a VitaliaGym!
            </h2>
            <p className="text-muted-foreground">
              Crea tu cuenta y comienza a transformar tu cuerpo
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstname" className="text-sm font-medium">
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
                  className={`h-10 transition-all duration-200 ${
                    focusedField === "firstname"
                      ? "border-primary ring-2 ring-primary/20"
                      : ""
                  }`}
                  onFocus={() => setFocusedField("firstname")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastname" className="text-sm font-medium">
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
                  className={`h-10 transition-all duration-200 ${
                    focusedField === "lastname"
                      ? "border-primary ring-2 ring-primary/20"
                      : ""
                  }`}
                  onFocus={() => setFocusedField("lastname")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
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
                className={`h-10 transition-all duration-200 ${
                  focusedField === "email"
                    ? "border-primary ring-2 ring-primary/20"
                    : ""
                }`}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
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
                      className="w-[85px]"
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
                    className="flex-1 h-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="role"
                  className="text-sm font-medium flex items-center gap-1"
                >
                  <Shield className="w-3 h-3" />
                  Rol *
                </Label>
                <Select
                  value={formData.roleId}
                  onValueChange={handleRoleChange}
                  disabled={rolesLoading}
                >
                  <SelectTrigger className="h-10">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
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
                    className={`h-10 pr-10 transition-all duration-200 ${
                      focusedField === "password"
                        ? "border-primary ring-2 ring-primary/20"
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
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password2" className="text-sm font-medium">
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
                    className={`h-10 pr-10 transition-all duration-200 ${
                      focusedField === "password2"
                        ? "border-primary ring-2 ring-primary/20"
                        : ""
                    }`}
                    onFocus={() => setFocusedField("password2")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword2(!showPassword2)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={
                      showPassword2
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    {showPassword2 ? (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || rolesLoading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando cuenta...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Crear Cuenta
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
      </div>
    </div>
  );
};

export default Registro;
