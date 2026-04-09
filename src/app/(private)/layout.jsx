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
import { User, Settings, ShieldUser } from "lucide-react";

const PrivatePagesLayout = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { canAccessRoute, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  const allItems = useMemo(() => [...sidebarItems, ...configItems], []);

  const hasRouteAccess = useMemo(() => {
    if (permissionsLoading) return true;
    return canAccessRoute(pathname);
  }, [canAccessRoute, pathname, permissionsLoading]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  const isLoading = authLoading || !user;

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] w-full" role="status" aria-label="Cargando aplicación">
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

  const showDashboardLink =
    !pathname.startsWith("/perfil") && pathname !== "/dashboard";

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
    <div className="h-[100dvh] overflow-hidden flex flex-col relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-0 right-0 w-[600px] h-[400px] rounded-full opacity-[0.04] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute bottom-0 left-0 w-[500px] h-[350px] rounded-full opacity-[0.03] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--secondary) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full opacity-[0.02] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 50%)' }}
        />
      </div>
      
      <a 
        href="#main-content" 
        className="skip-link"
      >
        Saltar al contenido principal
      </a>
      
      <SidebarProvider className="flex-1 min-h-0 h-full" defaultOpen={true}>
        <AppSidebar />
        <SidebarInset className="relative flex flex-col min-h-0 overflow-hidden">
          <header 
            className="flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b border-[--border]/20 bg-[--background]/60 backdrop-blur-xl supports-[backdrop-filter]:bg-[--background]/40 sticky top-0 z-40 transition-[height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
            role="banner"
          >
            <div className="flex items-center gap-2 px-3 sm:px-4">
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
          
          <main 
            id="main-content"
            className="flex flex-1 flex-col gap-3 sm:gap-4 md:gap-6 p-3 sm:p-4 md:p-6 overflow-y-auto min-h-0 relative"
            role="main"
          >
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
              <div className="absolute top-20 right-10 w-32 h-32 rounded-full bg-primary/5 blur-2xl" style={{ animation: 'float 6s ease-in-out infinite' }} />
              <div className="absolute bottom-40 left-20 w-24 h-24 rounded-full bg-secondary/5 blur-xl" style={{ animation: 'float 8s ease-in-out infinite', animationDelay: '2s' }} />
              <div className="absolute top-1/2 left-1/3 w-16 h-16 rounded-full bg-primary/3 blur-lg" style={{ animation: 'float 10s ease-in-out infinite', animationDelay: '4s' }} />
            </div>
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
              <div className="animate-fade-in flex flex-col flex-1 min-h-0 w-full">
                {children}
              </div>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default PrivatePagesLayout;
