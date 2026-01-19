"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
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
import { Loader2, Shield } from "lucide-react";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";
import useRolesList from "@/hooks/useRolesList";
import { logoBlurDataURL } from "@/lib/imagePlaceholders";
import "@/styles/image-optimization.css";

const Registro = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { roles, loading: rolesLoading } = useRolesList();

  // Estado del formulario
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
    password: "",
    password2: "",
    roleId: "",
  });

  // Precargar imágenes críticas con máxima prioridad
  useCriticalImagePreload();

  // Establecer rol por defecto cuando cargan los roles
  useEffect(() => {
    if (roles.length > 0 && !formData.roleId) {
      // Buscar rol "Entrenador" como default, o el primero disponible
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
      toast.error("Por favor, rellena todos los campos obligatorios");
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
      // 1. Crear usuario en Supabase Auth
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: firstname + " " + lastname,
            phone: phone,
          },
        },
      });

      if (error) {
        toast.error(error.message || "Error al registrarte, Intenta de nuevo");
        return;
      }

      if (data?.user) {
        // 2. Asignar rol al usuario en la tabla user_roles
        // Usamos upsert para reemplazar cualquier rol existente (por si el trigger asignó uno)
        if (roleId && roleId !== "default") {
          // Primero eliminar cualquier rol existente (por si el trigger lo asignó)
          await client.from("user_roles").delete().eq("user_id", data.user.id);

          // Luego insertar el rol seleccionado
          const { error: roleError } = await client.from("user_roles").insert({
            user_id: data.user.id,
            role_id: roleId,
          });

          if (roleError) {
            console.warn("Error al asignar rol:", roleError);
            // No fallar el registro si no se puede asignar el rol
          }
        }

        toast.success(
          "Registro exitoso, por favor Inicia Sesión con tu cuenta",
        );
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4">
      <Card className="w-[450px] shadow-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="text-center text-2xl flex justify-center items-center">
            <div className="logo-container relative w-32 h-16">
              <Image
                src="/logo.png"
                alt="Logo Vitalia Gym"
                fill
                sizes="128px"
                priority={true}
                loading="eager"
                placeholder="blur"
                blurDataURL={logoBlurDataURL}
                className="object-contain"
              />
            </div>
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            <p>Crea tu cuenta de acceso al sistema</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister}>
            <div className="flex flex-col gap-4">
              {/* Nombre y Apellido en una fila */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstname">Nombre *</Label>
                  <Input
                    id="firstname"
                    name="firstname"
                    type="text"
                    placeholder="Tu nombre"
                    value={formData.firstname}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastname">Apellido *</Label>
                  <Input
                    id="lastname"
                    name="lastname"
                    type="text"
                    placeholder="Tu apellido"
                    value={formData.lastname}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="email">Correo Electrónico *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="example@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Teléfono y Rol en una fila */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+58 412 1234567"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Rol *
                    </span>
                  </Label>
                  <Select
                    value={formData.roleId}
                    onValueChange={handleRoleChange}
                    disabled={rolesLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          rolesLoading ? "Cargando..." : "Selecciona un rol"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex flex-col">
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contraseñas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password2">Confirmar *</Label>
                  <Input
                    id="password2"
                    name="password2"
                    type="password"
                    placeholder="Repite la contraseña"
                    value={formData.password2}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={loading || rolesLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Crear Cuenta"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <p className="w-full text-center text-sm text-muted-foreground flex justify-between">
            ¿Ya tienes cuenta?{" "}
            <Link href="/auth/login" className="text-primary hover:underline">
              Iniciar Sesión
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Registro;
