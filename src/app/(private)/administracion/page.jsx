"use client";

import React, { useState } from "react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { PERMISSIONS } from "@/components/context/PermissionsProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AdminDashboard from "@/components/admin/AdminDashboard";
import StaffTable from "@/components/admin/StaffTable";
import StaffPaymentsTable from "@/components/admin/StaffPaymentsTable";
import ExpensesTable from "@/components/admin/ExpensesTable";
import ReportsPanel from "@/components/admin/ReportsPanel";
import {
  Briefcase,
  Users,
  Banknote,
  Receipt,
  FileBarChart,
  Building2,
  LayoutDashboard,
} from "lucide-react";

export default function AdministracionPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <PermissionGate 
      permission={PERMISSIONS.ADMIN_VIEW}
      fallback={
        <div className="w-full px-4 sm:px-6 lg:px-8 pb-6">
          <Card>
            <CardContent className="py-12 sm:py-16 text-center">
              <Briefcase className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg sm:text-xl font-semibold mb-2">Acceso Restringido</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                No tienes permisos para acceder al módulo de administración.
              </p>
            </CardContent>
          </Card>
        </div>
      }
    >
        <div className="w-full px-4 sm:px-6 lg:px-8 pb-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="relative inline-block">
                  <h1 className="text-2xl font-bold text-foreground">
                    Administración
                  </h1>
                  <span className="absolute -top-0.5 -right-3 w-2 h-2 bg-primary rounded-full animate-pulse" />
                </div>
                <p className="text-muted-foreground">
                  Gestiona el personal, pagos, gastos y genera reportes
                </p>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="gap-2 px-3 py-1.5 w-fit">
            <Building2 className="h-4 w-4" />
            VitaliaGym
          </Badge>
        </div>

        {/* Tabs de navegación */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 lg:w-auto lg:inline-grid h-auto gap-1 p-1">
            <TabsTrigger 
              value="dashboard" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="staff" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Personal</span>
            </TabsTrigger>
            <TabsTrigger 
              value="payments" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5"
            >
              <Banknote className="h-4 w-4" />
              <span className="hidden sm:inline">Pagos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="expenses" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5"
            >
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Gastos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5"
            >
              <FileBarChart className="h-4 w-4" />
              <span className="hidden sm:inline">Reportes</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Dashboard */}
          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <AdminDashboard />
          </TabsContent>

          {/* Tab: Personal */}
          <TabsContent value="staff" className="space-y-6 mt-6">
            <PermissionGate 
              permission={PERMISSIONS.ADMIN_STAFF_VIEW}
              fallback={
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No tienes permisos para ver el personal.
                  </CardContent>
                </Card>
              }
            >
              <StaffTable />
            </PermissionGate>
          </TabsContent>

          {/* Tab: Pagos */}
          <TabsContent value="payments" className="space-y-6 mt-6">
            <PermissionGate 
              permission={PERMISSIONS.ADMIN_STAFF_PAYMENTS_VIEW}
              fallback={
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No tienes permisos para ver los pagos.
                  </CardContent>
                </Card>
              }
            >
              <StaffPaymentsTable />
            </PermissionGate>
          </TabsContent>

          {/* Tab: Gastos */}
          <TabsContent value="expenses" className="space-y-6 mt-6">
            <PermissionGate 
              permission={PERMISSIONS.ADMIN_EXPENSES_VIEW}
              fallback={
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No tienes permisos para ver los gastos.
                  </CardContent>
                </Card>
              }
            >
              <ExpensesTable />
            </PermissionGate>
          </TabsContent>

          {/* Tab: Reportes */}
          <TabsContent value="reports" className="space-y-6 mt-6">
            <PermissionGate 
              permission={PERMISSIONS.ADMIN_REPORTS_VIEW}
              fallback={
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No tienes permisos para ver los reportes.
                  </CardContent>
                </Card>
              }
            >
              <ReportsPanel />
            </PermissionGate>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
