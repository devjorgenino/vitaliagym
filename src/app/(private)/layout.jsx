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
        <div className="flex flex-col flex-1 p-4 gap-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  // Determinar el título de la página
  let pageTitle;
  if (pathname.startsWith("/perfil")) {
    pageTitle = "Perfil";
  } else if (pathname.startsWith("/configuracion/roles")) {
    pageTitle = "Gestión de Roles";
  } else {
    const currentPage = allItems.find(
      (item) => pathname === item.url || pathname.startsWith(item.url + "/")
    );
    pageTitle = currentPage ? currentPage.title : "Dashboard";
  }

  // Determinar si mostrar el link al dashboard
  const showDashboardLink =
    !pathname.startsWith("/perfil") && pathname !== "/dashboard";

  // Determinar breadcrumbs para rutas anidadas
  const getBreadcrumbs = () => {
    const crumbs = [];

    if (pathname.startsWith("/configuracion")) {
      crumbs.push({ label: "Configuración", href: null });
      
      if (pathname.includes("/roles")) {
        crumbs.push({ label: "Roles", href: "/configuracion/roles" });
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
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  {showDashboardLink && (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link href="/dashboard">Dashboard</Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                    </>
                  )}
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={index}>
                      <BreadcrumbItem>
                        {crumb.href ? (
                          <BreadcrumbLink asChild>
                            <Link href={crumb.href}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        ) : (
                          <span className="text-muted-foreground">
                            {crumb.label}
                          </span>
                        )}
                      </BreadcrumbItem>
                      {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                    </React.Fragment>
                  ))}
                  {breadcrumbs.length > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
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
