"use client";

import useAuth from "@/hooks/useAuth";
import usePermissions from "@/hooks/usePermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarSkeleton } from "@/components/ui/avatar-skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Download, X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Image from "next/image";
import { Button, buttonVariants } from "../ui/button";
import client from "@/api/client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/getInitials";
import { items, configItems, filterItemsByPermission } from "@/lib/sidebarData";
import { logoBlurDataURL, logoSmallBlurDataURL } from "@/lib/imagePlaceholders";
import "@/styles/image-optimization.css";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useInstallPWA } from "@/hooks/useInstallPWA";

export const AppSidebar = () => {
  const { state } = useSidebar();
  const { user } = useAuth();
  const {
    hasPermission,
    roles,
    loading: permissionsLoading,
  } = usePermissions();
  const pathname = usePathname();
  const { canShow: canShowInstall, install, dismiss } = useInstallPWA();

  const username = user?.user_metadata?.full_name || "Usuario";

  // Filtrar items por permisos
  const filteredMainItems = useMemo(() => {
    if (permissionsLoading) return items; // Mientras carga, mostrar todos
    return filterItemsByPermission(items, hasPermission);
  }, [hasPermission, permissionsLoading]);

  const filteredConfigItems = useMemo(() => {
    if (permissionsLoading) return [];
    return filterItemsByPermission(configItems, hasPermission);
  }, [hasPermission, permissionsLoading]);

  // Obtener el rol principal para mostrar
  const primaryRole = useMemo(() => {
    if (roles.length === 0) return null;
    // Priorizar Admin > otros
    const admin = roles.find((r) => r.name === "Admin");
    if (admin) return admin;
    return roles[0];
  }, [roles]);

  // Determinar el color del badge del rol
  const getRoleBadgeVariant = (roleName) => {
    switch (roleName) {
      case "Admin":
        return "default";
      case "Secretaria":
        return "secondary";
      case "Entrenador":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <Sidebar collapsible="icon" id="sidebar">
      <SidebarGroup>
        <SidebarHeader className="flex justify-center items-center m-auto">
          {state === "collapsed" ? (
            <Link
              href="/dashboard"
              className="logo-container flex items-center justify-center w-9 h-9"
            >
              <Image
                src="/logo-collapsible.png"
                alt="Vitalia Gym"
                width={40}
                height={40}
                priority={true}
                loading="eager"
                placeholder="blur"
                blurDataURL={logoSmallBlurDataURL}
                className="object-contain"
              />
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="logo-container flex items-center justify-center"
            >
              <Image
                src="/logo-sidebar.png"
                alt="Vitalia Gym"
                width={120}
                height={36}
                priority={true}
                loading="eager"
                placeholder="blur"
                blurDataURL={logoBlurDataURL}
                className="object-contain"
              />
            </Link>
          )}
        </SidebarHeader>
      </SidebarGroup>
      <SidebarContent>
        {/* Menú principal */}
        <SidebarGroup className="flex flex-col gap-1.5 items-center px-3 py-3">
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {permissionsLoading ? (
                // Skeleton mientras cargan los permisos
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <SidebarMenuItem key={i}>
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </SidebarMenuItem>
                  ))}
                </>
              ) : (
                filteredMainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <Link
                            href={item.url}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-left text-muted-foreground transition-all duration-200 rounded-lg hover:bg-muted",
                              "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:gap-0",
                              // Active state con colores del tema
                              pathname === item.url ||
                                pathname.startsWith(item.url + "/")
                                ? "bg-primary text-primary-foreground hover:bg-primary"
                                : "",
                            )}
                          >
                            <item.icon className="!size-5 transition-colors" />
                            <span className="group-data-[collapsible=icon]:hidden transition-colors">
                              {item.title}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {state === "collapsed" && (
                        <TooltipContent side="right" sideOffset={5}>
                          <p>{item.title}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Separador y menú de configuración (solo si hay items) */}
        {filteredConfigItems.length > 0 && (
          <>
            <SidebarSeparator className="mx-3" />
            <SidebarGroup className="flex flex-col gap-1.5 items-center px-3 py-2">
              {state !== "collapsed" && (
                <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                  Configuración
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {filteredConfigItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton asChild>
                            <Link
                              href={item.url}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-left text-muted-foreground transition-all duration-200 rounded-lg hover:bg-muted",
                                "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:gap-0",
                                pathname === item.url ||
                                  pathname.startsWith(item.url + "/")
                                  ? "bg-primary text-primary-foreground hover:bg-primary"
                                  : "",
                              )}
                            >
                              <item.icon className="!size-5 transition-colors" />
                              <span className="group-data-[collapsible=icon]:hidden transition-colors">
                                {item.title}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {state === "collapsed" && (
                          <TooltipContent side="right" sideOffset={5}>
                            <p>{item.title}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Install App Option */}
      {canShowInstall && (
        <>
          <SidebarSeparator className="mx-3" />
          <SidebarGroup className="px-3 py-2">
            <SidebarGroupContent>
              <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                <SidebarMenuItem>
                  <div className="flex items-center w-full">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={install}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 flex-1 text-sm font-medium text-left text-muted-foreground transition-all duration-200 rounded-lg hover:bg-muted",
                            "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:gap-0",
                          )}
                        >
                          <Download className="!size-5 transition-colors" />
                          <span className="group-data-[collapsible=icon]:hidden transition-colors">
                            Instalar App
                          </span>
                        </button>
                      </TooltipTrigger>
                      {state === "collapsed" && (
                        <TooltipContent side="right" sideOffset={5}>
                          <p>Instalar App</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    {state !== "collapsed" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={dismiss}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors mr-1"
                            aria-label="Ocultar opción de instalación"
                          >
                            <X className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={5}>
                          <p>Ocultar</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </>
      )}

      <SidebarGroup>
        <SidebarFooter className="px-3 py-3">
          <div
            className={cn(
              "flex flex-row justify-between items-center gap-3",
              "group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-2",
            )}
          >
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/perfil"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Avatar className="w-9 h-9 border-2 border-blue-100">
                        <AvatarImage
                          src={
                            user?.user_metadata?.avatar_url
                              ? user?.user_metadata?.avatar_url
                              : "/avatar.jpg"
                          }
                          alt="Avatar"
                          loading="lazy"
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm font-medium">
                          {getInitials(username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="text-sm font-medium text-foreground">
                          {username}
                        </span>
                        {primaryRole ? (
                          <Badge
                            variant={getRoleBadgeVariant(primaryRole.name)}
                            className="text-xs w-fit"
                          >
                            {primaryRole.name}
                          </Badge>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Sin rol asignado
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </TooltipTrigger>
                {state === "collapsed" && (
                  <TooltipContent side="right" sideOffset={8}>
                    <p className="font-medium">{username}</p>
                    {primaryRole && (
                      <p className="text-xs text-muted-foreground">
                        {primaryRole.name}
                      </p>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
            <div className="flex items-center gap-1">
              {/* Theme Toggle 
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <ThemeToggle variant="simple" />
                  </div>
                </TooltipTrigger>
                {state === "collapsed" && (
                  <TooltipContent side="right" sideOffset={5}>
                    <p>Cambiar tema</p>
                  </TooltipContent>
                )}
              </Tooltip> */}

              {/* Logout Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => client.auth.signOut()}
                    className={cn(
                      "w-9 h-9 rounded-lg bg-muted text-muted-foreground hover:bg-destructive hover:text-white hover:scale-105 transition-all duration-200 flex items-center justify-center",
                      "group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8",
                    )}
                  >
                    <LogOut
                      className={cn(
                        "!size-5",
                        "group-data-[collapsible=icon]:!size-4",
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side={state === "collapsed" ? "right" : "top"}
                  sideOffset={5}
                >
                  <p>Cerrar sesión</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </SidebarFooter>
      </SidebarGroup>
    </Sidebar>
  );
};
