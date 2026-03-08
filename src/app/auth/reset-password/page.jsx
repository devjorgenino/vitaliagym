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
import { Loader2, ArrowLeft } from "lucide-react";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";
import { logoBlurDataURL } from "@/lib/imagePlaceholders";

const ResetPassword = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  
  useCriticalImagePreload();
  
  const handleResetRequest = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Por favor, ingresa tu correo electrónico");
      return;
    }

    setLoading(true);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) {
        toast.error(error.message || "Error al enviar el correo de recuperación");
      } else {
        setEmailSent(true);
        toast.success("Correo de recuperación enviado. Revisa tu bandeja de entrada.");
      }
    } catch (err) {
      toast.error("Error al procesar la solicitud. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <Card className="w-[400px] shadow-lg">
          <CardHeader className="space-y-3">
            <CardTitle className="text-center text-2xl">
              Correo enviado
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              <p>Hemos enviado un enlace de recuperación a <strong>{email}</strong></p>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-sm text-muted-foreground space-y-4">
              <p>Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.</p>
              <p>Si no recibes el correo en unos minutos, revisa tu carpeta de spam.</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
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
            <p>Recupera tu contraseña</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetRequest}>
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ingresa tu correo electrónico y te enviaremos un enlace para recuperar tu contraseña.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar enlace de recuperación"
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

export default ResetPassword;
