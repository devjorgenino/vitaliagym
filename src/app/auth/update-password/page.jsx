"use client";

import React, { useState, useEffect } from "react";
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
import { Loader2, ArrowLeft } from "lucide-react";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";
import { logoBlurDataURL } from "@/lib/imagePlaceholders";

const UpdatePassword = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <Card className="w-[400px] shadow-lg">
          <CardHeader className="space-y-3">
            <CardTitle className="text-center text-2xl text-destructive">
              Enlace inválido o expirado
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              <p>El enlace de recuperación ha expirado o ya fue utilizado.</p>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-sm text-muted-foreground">
              <p>Solicita un nuevo enlace de recuperación de contraseña.</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Link href="/auth/reset-password" className="w-full">
              <Button className="w-full">
                Solicitar nuevo enlace
              </Button>
            </Link>
            <Link href="/auth/login" className="w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al inicio de sesión
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

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
            <p>Nueva contraseña</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password" className="mb-2">
                  Nueva Contraseña
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="******"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword" className="mb-2">
                  Confirmar Contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="******"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  La contraseña debe tener al menos 6 caracteres.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Actualizar contraseña"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <Link href="/auth/login" className="w-full flex items-center justify-center text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio de sesión
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default UpdatePassword;
