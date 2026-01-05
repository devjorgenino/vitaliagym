"use client";
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { toast } from "sonner";
import client from "@/../../src/api/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

const Login = () => {
  const router = useRouter();

  const handleLogin = (e) => {
    e.preventDefault();
    const email = e.target[0]?.value;
    const password = e.target[1]?.value;

    if (!email || !password) {
      toast.error("Por favor, rellena todos los campos");
      return;
    }

    const { data, error } = client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Error al iniciar sesión, Intenta de nuevo");
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
              <div>
                <Label htmlFor="password" className="mb-2">
                  Contraseña
                </Label>
                <Input id="password" type="password" placeholder="******" />
              </div>
              <Button type="submit" className="w-full">
                Iniciar Sesión
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
