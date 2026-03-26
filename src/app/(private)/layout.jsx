"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import usePermissions from "@/hooks/usePermissions";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/auth/SidebarApp";
import { AccessDeniedMessage } from "@/components/auth/PermissionGate";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { items as sidebarItems, configItems } from "@/lib/sidebarData";
import { User, Settings, ShieldUser } from "lucide-react";

const PrivatePagesLayout = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { canAccessRoute, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  // Combinar todos los items para buscar el título
  const allItems = useMemo(() => [...sidebarItems, ...configItems], []);

  // Verificar si puede acceder a la ruta actual
  const hasRouteAccess = useMemo(() => {
    if (permissionsLoading) return true; // Mientras carga, permitir
    return canAccessRoute(pathname);
  }, [canAccessRoute, pathname, permissionsLoading]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  // Estado de carga
  const isLoading = authLoading || !user;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full" role="status" aria-label="Cargando aplicación">
        <Skeleton className="h-full w-64 hidden md:block" />
        <div className="flex flex-col flex-1 gap-4 p-4">
          <Skeleton className="h-12 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Obtener información de la página actual (título e icono)
  const getCurrentPageInfo = () => {
    if (pathname.startsWith("/perfil")) {
      return { title: "Perfil", icon: User };
    } else if (pathname.startsWith("/configuracion/roles")) {
      return { title: "Gestión de Roles", icon: ShieldUser };
    } else {
      const currentPage = allItems.find(
        (item) => pathname === item.url || pathname.startsWith(item.url + "/")
      );
      return currentPage 
        ? { title: currentPage.title, icon: currentPage.icon }
        : { title: "Dashboard", icon: sidebarItems[0]?.icon };
    }
  };

  const currentPageInfo = getCurrentPageInfo();
  const PageIcon = currentPageInfo.icon;
  const DashboardIcon = sidebarItems.find(i => i.url === "/dashboard")?.icon;

  // Determinar si mostrar el link al dashboard
  const showDashboardLink =
    !pathname.startsWith("/perfil") && pathname !== "/dashboard";

  // Determinar breadcrumbs para rutas anidadas
  const getBreadcrumbs = () => {
    const crumbs = [];

    if (pathname.startsWith("/configuracion")) {
      crumbs.push({ label: "Configuración", href: null, icon: Settings });
      
      if (pathname.includes("/roles")) {
        const rolesItem = configItems.find(i => i.url === "/configuracion/roles");
        crumbs.push({ 
          label: "Roles", 
          href: "/configuracion/roles",
          icon: rolesItem?.icon
        });
      }
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  // Componente para ajustar el contenido según el estado del sidebar
  const AdaptiveSidebarContent = ({ children }) => {
    const { state } = useSidebar();
    const isExpanded = state === "expanded";

    return (
      <div 
        id="main-content"
        className={cn(
          "flex flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6 overflow-y-auto min-h-0",
          // Agregar padding-left cuando el sidebar está expandido
          isExpanded && "lg:pl-4"
        )}
        role="main"
      >
        {/* Verificar acceso a la ruta */}
        {!hasRouteAccess ? (
          <AccessDeniedMessage
            title="Acceso Restringido"
            message="No tienes los permisos necesarios para acceder a esta sección. Contacta con un administrador si crees que deberías tener acceso."
          />
        ) : permissionsLoading ? (
          <div className="w-full space-y-4" role="status" aria-label="Cargando contenido">
            <Skeleton className="h-8 w-48 sm:w-64" />
            <Skeleton className="h-[300px] sm:h-[400px] w-full" />
          </div>
        ) : (
          <div className="animate-fade-in flex flex-col flex-1 min-h-0">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      {/* Skip link for accessibility */}
      <a 
        href="#main-content" 
        className="skip-link"
      >
        Saltar al contenido principal
      </a>
      
      <SidebarProvider className="flex-1 min-h-0 h-full">
        <AppSidebar />
        <SidebarInset>
          <header 
            className="flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 transition-[height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
            role="banner"
          >
            <div className="flex items-center gap-2 px-3 sm:px-4">
              {/* Trigger visible solo en móvil */}
              <SidebarTrigger 
                className="-ml-1 md:hidden touch-target" 
                aria-label="Abrir menú de navegación"
              />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4 md:hidden"
              />
              <Breadcrumb>
                <BreadcrumbList className="flex-wrap">
                  {showDashboardLink && (
                    <>
                      <BreadcrumbItem className="hidden sm:flex">
                        <BreadcrumbLink asChild>
                          <Link 
                            href="/dashboard" 
                            className="flex items-center gap-1.5 text-xs sm:text-sm"
                          >
                            {DashboardIcon && (
                              <DashboardIcon 
                                className="size-3.5 sm:size-4" 
                                aria-hidden="true" 
                              />
                            )}
                            <span>Dashboard</span>
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden sm:flex" />
                    </>
                  )}
                  {breadcrumbs.map((crumb, index) => {
                    const CrumbIcon = crumb.icon;
                    return (
                      <React.Fragment key={index}>
                        <BreadcrumbItem className="hidden sm:flex">
                          {crumb.href ? (
                            <BreadcrumbLink asChild>
                              <Link 
                                href={crumb.href} 
                                className="flex items-center gap-1.5 text-xs sm:text-sm"
                              >
                                {CrumbIcon && (
                                  <CrumbIcon 
                                    className="size-3.5 sm:size-4" 
                                    aria-hidden="true" 
                                  />
                                )}
                                <span>{crumb.label}</span>
                              </Link>
                            </BreadcrumbLink>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                              {CrumbIcon && (
                                <CrumbIcon 
                                  className="size-3.5 sm:size-4" 
                                  aria-hidden="true" 
                                />
                              )}
                              <span>{crumb.label}</span>
                            </span>
                          )}
                        </BreadcrumbItem>
                        {index < breadcrumbs.length - 1 && (
                          <BreadcrumbSeparator className="hidden sm:flex" />
                        )}
                      </React.Fragment>
                    );
                  })}
                  {breadcrumbs.length > 0 && (
                    <BreadcrumbSeparator className="hidden sm:flex" />
                  )}
                  <BreadcrumbItem>
                    <BreadcrumbPage className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
                      {PageIcon && (
                        <PageIcon 
                          className="size-3.5 sm:size-4" 
                          aria-hidden="true" 
                        />
                      )}
                      <span>{currentPageInfo.title}</span>
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          
          <AdaptiveSidebarContent>
            {children}
          </AdaptiveSidebarContent>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default PrivatePagesLayout;
