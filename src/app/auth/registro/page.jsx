"use client";

import React, { useState } from "react";
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
import { toast } from "sonner";
import client from "@/api/client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";
import { logoBlurDataURL } from "@/lib/imagePlaceholders";
import "@/styles/image-optimization.css";

const Registro = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Precargar imágenes críticas con máxima prioridad
  useCriticalImagePreload();

  const handleRegister = async (e) => {
    e.preventDefault();

    const firstname = e.target[0]?.value;
    const lastname = e.target[1]?.value;
    const email = e.target[2]?.value;
    const phone = e.target[3]?.value;
    const password = e.target[4]?.value;
    const password2 = e.target[5]?.value;

    if (!email || !password || !password2 || !firstname || !lastname) {
      toast.error("Por favor, rellena todos los campos obligatorios");
      return;
    }

    if (password !== password2) {
      toast.error("Las contraseñas no coinciden");
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
            phone: phone,
          },
        },
      });

      if (error) {
        toast.error(error.message || "Error al registrarte, Intenta de nuevo");
        return;
      }

      if (data) {
        toast.success("Registro exitoso, porfavor Inicia Sesión con tu cuenta");
        client.auth.signOut();
        router.push("/auth/login");
      }
    } catch (err) {
      toast.error("Error al registrarte. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Card className="w-[400px] shadow-lg">
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
            <p>Crea tu cuenta</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="firstname" className="mb-2">
                  Nombre
                </Label>
                <Input
                  id="firstname"
                  type="text"
                  placeholder="Tu nombre"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastname" className="mb-2">
                  Apellido
                </Label>
                <Input
                  id="lastname"
                  type="text"
                  placeholder="Tu apellido"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="mb-2">
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone" className="mb-2">
                  Teléfono (opcional)
                </Label>
                <Input id="phone" type="tel" placeholder="+1234567890" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="mb-2">
                  Contraseña
                </Label>
                <Input id="password" type="password" placeholder="******" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password2" className="mb-2">
                  Confirmar Contraseña
                </Label>
                <Input id="password2" type="password" placeholder="******" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Registrate"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <p className="w-full text-center text-sm text-muted-foreground flex justify-between">
            ¿Ya tienes cuenta? <Link href="/auth/login">Iniciar Sesión</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Registro;
