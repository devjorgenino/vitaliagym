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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { Button } from "../ui/button";
import client from "@/api/client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/getInitials";
import { items } from "@/lib/sidebarData";

export const AppSidebar = () => {
  const { state } = useSidebar();
  const { user } = useAuth();

  const username = user?.user_metadata?.full_name || "Usuario";

  return (
    <Sidebar collapsible="icon">
      <SidebarGroup>
        <SidebarHeader className="flex justify-center items-center m-auto p-0.5">
          {state === "collapsed" ? (
            <Link href="/dashboard">
              <Image
                src="/logo-collapsible.png"
                alt="Logo Collapsible"
                width={40}
                height={40}
              />
            </Link>
          ) : (
            <Link href="/dashboard">
              <Image
                src="/logo-sidebar.png"
                alt="Logo"
                width={200}
                height={200}
              />
            </Link>
          )}
        </SidebarHeader>
      </SidebarGroup>
      <SidebarContent>
        <SidebarGroup className="flex flex-col gap-2 items-center p-3">
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
                            "flex items-center gap-2 px-4 py-2 w-full text-sm font-medium text-left text-muted-foreground transition-all hover:bg-muted duration-300",
                            "group-data-[collapsible=icon]:justify-center"
                          )}
                        >
                          <item.icon className="!size-5" />
                          <span className="group-data-[collapsible=icon]:hidden">
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
        <SidebarFooter>
          <div
            className={cn(
              "flex flex-row justify-between items-center gap-4",
              "group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-2"
            )}
          >
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/perfil">
                    <div className="flex items-center justify-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage
                          src={
                            user?.user_metadata?.avatar_url
                              ? user?.user_metadata?.avatar_url
                              : "/avatar.jpg"
                          }
                          alt="Avatar"
                        />
                        <AvatarFallback>{getInitials(username)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="text-sm font-medium">{username}</span>
                        <p className="text-xs">Rol</p>
                      </div>
                    </div>
                  </Link>
                </TooltipTrigger>
                {state === "collapsed" && (
                  <TooltipContent side="right" sideOffset={5}>
                    <p>{username}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    onClick={() => client.auth.signOut()}
                    className={cn("group-data-[collapsible=icon]:w-full")}
                  >
                    <LogOut className="!size-5" />
                  </Button>
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
