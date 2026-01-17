import useAuth from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarSkeleton } from "@/components/ui/avatar-skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { Button, buttonVariants } from "../ui/button";
import client from "@/api/client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/getInitials";
import { items } from "@/lib/sidebarData";
import { logoBlurDataURL, logoSmallBlurDataURL } from "@/lib/imagePlaceholders";
import "@/styles/image-optimization.css";
import { usePathname } from "next/navigation";

export const AppSidebar = () => {
  const { state } = useSidebar();
  const { user } = useAuth();
  const pathname = usePathname();

  const username = user?.user_metadata?.full_name || "Usuario";

  return (
    <Sidebar collapsible="icon">
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
        <SidebarGroup className="flex flex-col gap-1.5 items-center px-3 py-3">
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {items.map((item) => (
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
                            pathname === item.url
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
      </SidebarContent>
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
                        <p className="text-xs text-muted-foreground">
                          Administrador
                        </p>
                      </div>
                    </div>
                  </Link>
                </TooltipTrigger>
                {state === "collapsed" && (
                  <TooltipContent side="right" sideOffset={8}>
                    <p className="font-medium">{username}</p>
                    <p className="text-xs text-muted-foreground">
                      Administrador
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                   <button
                     onClick={() => client.auth.signOut()}
                     className={cn(
                       "w-10 h-10 rounded-lg bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:scale-105 transition-all duration-200 flex items-center justify-center",
                       "group-data-[collapsible=icon]:w-8 h-8 group-data-[collapsible=icon]:justify-center",
                     )}
                   >
                     <LogOut className={cn(
                       "!size-5",
                       "group-data-[collapsible=icon]:!size-4"
                     )} />
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
