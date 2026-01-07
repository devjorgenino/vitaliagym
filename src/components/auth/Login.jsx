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
import { Loader2 } from "lucide-react";

const Login = () => {
  const [loading, setLoading] = useState(false);
  
  const handleLogin = (e) => {
    e.preventDefault();
    const email = e.target[0]?.value;
    const password = e.target[1]?.value;

    if (!email || !password) {
      toast.error("Por favor, rellena todos los campos");
      return;
    }

    setLoading(true);
    try {
      const { error } = client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Error al iniciar sesión, Intenta de nuevo");
      } else {
        toast.success("Inicio de sesión exitoso");
        // Redirigir después de un breve delay para mostrar el éxito
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1000);
      }
    } catch (err) {
      toast.error("Error al iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center text-2xl mb-3 flex justify-center items-center">
            <Image src="/logo.png" alt="Logo" width={200} height={200} />
          </CardTitle>
          <CardDescription className="text-center">
            <p>Inicia sesión en tu cuenta</p>
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
                  type="email"
                  placeholder="example@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="mb-2">
                  Contraseña
                </Label>
                <Input id="password" type="password" placeholder="******" />
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
