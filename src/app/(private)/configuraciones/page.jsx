"use client";

import React from "react";
import Link from "next/link";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import {
  Settings,
  Shield,
  Users,
  Palette,
  Bell,
  Database,
  Building2,
  ChevronRight,
  ExternalLink,
  Lock,
  UserCog,
  Briefcase,
} from "lucide-react";

// Secciones de configuración disponibles
const configSections = [
  {
    id: "roles",
    title: "Roles y Permisos",
    description: "Gestiona los roles del sistema y asigna permisos a cada uno",
    icon: Shield,
    href: "/configuracion/roles",
    badge: null,
    available: true,
  },
  {
    id: "users",
    title: "Usuarios del Sistema",
    description: "Administra los usuarios con acceso al sistema",
    icon: UserCog,
    href: "/usuarios",
    badge: null,
    available: true,
  },
  {
    id: "admin",
    title: "Administración",
    description: "Personal, nómina, gastos operativos y reportes",
    icon: Briefcase,
    href: "/administracion",
    badge: null,
    available: true,
  },
  {
    id: "diagnostic",
    title: "Diagnóstico del Sistema",
    description: "Verifica la conexión con Supabase y el estado de las tablas",
    icon: Database,
    href: "/config",
    badge: null,
    available: true,
  },
];

// Secciones próximamente disponibles
const comingSoonSections = [
  {
    id: "notifications",
    title: "Notificaciones",
    description: "Configura alertas de pagos vencidos y recordatorios",
    icon: Bell,
  },
  {
    id: "appearance",
    title: "Apariencia",
    description: "Personaliza el tema y colores del sistema",
    icon: Palette,
  },
  {
    id: "gym",
    title: "Datos del Gimnasio",
    description: "Información del gimnasio para facturas y reportes",
    icon: Building2,
  },
];

const Configuraciones = () => {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <div className="relative inline-block">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
              <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-foreground" aria-hidden="true" />
              Configuraciones
            </h1>
            <span className="absolute -top-0.5 -right-3 w-2 h-2 bg-primary rounded-full animate-pulse" />
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestiona la configuración del sistema, usuarios, roles y preferencias
          </p>
        </div>

        {/* Secciones disponibles */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Configuración del Sistema</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {configSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link key={section.id} href={section.href}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                          </div>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {section.title}
                              {section.badge && (
                                <Badge variant="secondary" className="text-xs">
                                  {section.badge}
                                </Badge>
                              )}
                            </CardTitle>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription>{section.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Secciones próximamente */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Próximamente
            <Badge variant="outline" className="font-normal">En desarrollo</Badge>
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {comingSoonSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card key={section.id} className="opacity-60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {section.title}
                          <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription>{section.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Ayuda */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">¿Necesitas ayuda?</CardTitle>
            <CardDescription>
              Si tienes dudas sobre la configuración del sistema, consulta la documentación o contacta al administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link href="/config">
                  <Database className="h-4 w-4" />
                  Ver estado del sistema
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Configuraciones;
