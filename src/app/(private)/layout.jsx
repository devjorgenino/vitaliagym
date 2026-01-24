"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import usePermissions from "@/hooks/usePermissions";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
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
import { items as sidebarItems, configItems } from "@/lib/sidebarData";
import { User, Settings, BrickWall } from "lucide-react";

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
      console.log("No user found, redirecting to login");
      router.push("/");
    } else if (!authLoading && user) {
      console.log("User authenticated:", user.email);
    }
  }, [authLoading, user, router]);

  // Estado de carga
  const isLoading = authLoading || !user;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full">
        <Skeleton className="h-full w-72" />
        <div className="flex flex-col flex-1 gap-4">
          <Skeleton className="h-14 w-full" />
          <div className="container mx-auto py-6 space-y-4">
            <Skeleton className="h-10 w-64" />
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
      return { title: "Gestión de Roles", icon: BrickWall };
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

  return (
    <div>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              {/* Trigger visible solo en móvil */}
              <SidebarTrigger className="-ml-1 md:hidden" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4 md:hidden"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  {showDashboardLink && (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link href="/dashboard" className="flex items-center gap-1.5">
                            {DashboardIcon && <DashboardIcon className="size-4" aria-hidden="true" />}
                            <span>Dashboard</span>
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                    </>
                  )}
                  {breadcrumbs.map((crumb, index) => {
                    const CrumbIcon = crumb.icon;
                    return (
                      <React.Fragment key={index}>
                        <BreadcrumbItem>
                          {crumb.href ? (
                            <BreadcrumbLink asChild>
                              <Link href={crumb.href} className="flex items-center gap-1.5">
                                {CrumbIcon && <CrumbIcon className="size-4" aria-hidden="true" />}
                                <span>{crumb.label}</span>
                              </Link>
                            </BreadcrumbLink>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              {CrumbIcon && <CrumbIcon className="size-4" aria-hidden="true" />}
                              <span>{crumb.label}</span>
                            </span>
                          )}
                        </BreadcrumbItem>
                        {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                      </React.Fragment>
                    );
                  })}
                  {breadcrumbs.length > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    <BreadcrumbPage className="flex items-center gap-1.5">
                      {PageIcon && <PageIcon className="size-4" aria-hidden="true" />}
                      <span>{currentPageInfo.title}</span>
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col justify-start items-start gap-4 p-4 pt-4">
            {/* Verificar acceso a la ruta */}
            {!hasRouteAccess ? (
              <div className="w-full">
                <AccessDeniedMessage
                  title="Acceso Restringido"
                  message="No tienes los permisos necesarios para acceder a esta sección. Contacta con un administrador si crees que deberías tener acceso."
                />
              </div>
            ) : permissionsLoading ? (
              <div className="w-full space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-[400px] w-full" />
              </div>
            ) : (
              children
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default PrivatePagesLayout;
