"use client";

import Link from "next/link";
import { ShieldX, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="text-center max-w-md">
        {/* Icono */}
        <div className="mx-auto w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
          <ShieldX className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>

        {/* Título */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Acceso Denegado
        </h1>

        {/* Descripción */}
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          No tienes los permisos necesarios para acceder a esta página. 
          Si crees que esto es un error, contacta con el administrador del sistema.
        </p>

        {/* Información adicional */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-8">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Tip:</strong> Verifica que tu cuenta tenga asignados los roles correctos 
            para acceder a esta sección.
          </p>
        </div>

        {/* Botones */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            asChild
            className="flex items-center gap-2"
          >
            <Link href="javascript:history.back()">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Button asChild className="flex items-center gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Ir al Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
