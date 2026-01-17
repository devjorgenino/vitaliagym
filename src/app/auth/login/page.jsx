"use client";

import React, { useState } from "react";
import "@/styles/image-optimization.css";
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

const Login = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Precargar imágenes críticas con máxima prioridad
  useCriticalImagePreload();
  
  const handleLogin = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get("email");
    const password = formData.get("password");

    if (!email || !password) {
      toast.error("Por favor, rellena todos los campos");
      return;
    }

    setLoading(true);
    try {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Error al iniciar sesión, Intenta de nuevo");
      } else {
        toast.success("Inicio de sesión exitoso");
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error("Error al iniciar sesión. Inténtalo de nuevo.");
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
            <p>Bienvenido de nuevo</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email" className="mb-2">
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="example@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="mb-2">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="******"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando Sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <p className=" w-full text-center text-sm text-muted-foreground flex justify-between">
            ¿No tienes cuenta? <Link href="/auth/registro">Regístrate</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
