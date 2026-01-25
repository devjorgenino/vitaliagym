import React, { useState } from "react";
import { useDashboardMetrics } from "../../hooks/useDashboardMetrics";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { StatCard, StatsGrid } from "../ui/stat-card";
import { EmptyState } from "../ui/empty-state";
import { ExchangeRateCard } from "./ExchangeRateCard";
import { Clock, Cake, UserPlus, Activity, RefreshCw } from "lucide-react";

export function DashboardView() {
  const { metrics, loading, error, refetch } = useDashboardMetrics();

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6" role="status" aria-label="Cargando dashboard">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Skeleton className="h-10 sm:h-12 flex-1" />
          <Skeleton className="h-10 sm:h-12 w-full sm:w-32" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 sm:h-28 md:h-32 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-48 sm:h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon="empty"
            title="Error al cargar datos"
            description={error}
            action={{
              label: "Reintentar",
              onClick: refetch,
              icon: <RefreshCw className="h-4 w-4" />,
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Vista general del gimnasio</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ExchangeRateCard compact={true} />
          <Button
            onClick={refetch}
            variant="outline"
            size="sm"
            className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
            aria-label="Actualizar datos del dashboard"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            <span className="hidden xs:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {/* Metricas Principales - Grid responsive */}
      <StatsGrid>
        <StatCard
          title="Clientes por Vencer"
          value={metrics.expiringSoon?.length || 0}
          subtitle="Proximos 5 dias"
          icon={Clock}
          color="amber"
        />

        <StatCard
          title="Cumpleanos Proximos"
          value={metrics.upcomingBirthdays?.length || 0}
          subtitle="Proximos 7 dias"
          icon={Cake}
          color="purple"
        />

        <StatCard
          title="Clientes Nuevos"
          value={metrics.newClients?.length || 0}
          subtitle="Este mes"
          icon={UserPlus}
          color="green"
        />

        <StatCard
          title="Asistencia Semanal"
          value={metrics.weeklyAttendance || 0}
          subtitle={`${metrics.weeklyUniqueClients || 0} clientes unicos (${(
            metrics.weeklyPercentage || 0
          ).toFixed(1)}%)`}
          icon={Activity}
          color="blue"
        />
      </StatsGrid>

      {/* Graficos y Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Clientes proximos a vencer */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">Clientes Proximos a Vencer</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {metrics.expiringSoon?.length > 0 ? (
              <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto scrollbar-thin">
                {metrics.expiringSoon.map((client, index) => {
                  // Parsear la fecha correctamente evitando problemas de zona horaria
                  const paymentDateParts = client.next_payment_date.split("-");
                  const paymentDate = new Date(
                    parseInt(paymentDateParts[0], 10),
                    parseInt(paymentDateParts[1], 10) - 1,
                    parseInt(paymentDateParts[2], 10),
                  );
                  paymentDate.setHours(0, 0, 0, 0);

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  const daysUntil = Math.round(
                    (paymentDate - today) / (1000 * 60 * 60 * 24),
                  );
                  return (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">
                          {client.first_name} {client.last_name}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {client.plans?.name || "Sin plan"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {daysUntil <= 0
                            ? `${Math.abs(daysUntil)} dias vencido`
                            : `${daysUntil} dias`}
                        </span>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {paymentDate.toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Clock}
                title="Sin clientes por vencer"
                description="No hay clientes con pagos proximos a vencer en los proximos 5 dias"
              />
            )}
          </CardContent>
        </Card>

        {/* Proximos cumpleanos */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Cake className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">Cumpleanos del Mes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {metrics.upcomingBirthdays?.length > 0 ? (
              <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto scrollbar-thin">
                {metrics.upcomingBirthdays.map((client, index) => {
                  const birthDate = new Date(client.birth_date);
                  const today = new Date();
                  const nextBirthday = new Date(
                    today.getFullYear(),
                    birthDate.getMonth(),
                    birthDate.getDate(),
                  );
                  if (nextBirthday < today) {
                    nextBirthday.setFullYear(today.getFullYear());
                  }
                  const daysUntil = Math.ceil(
                    (nextBirthday - today) / (1000 * 60 * 60 * 24),
                  );

                  return (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-2.5 sm:p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800 gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">
                          {client.first_name} {client.last_name}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {birthDate.toLocaleDateString("es-ES", {
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs sm:text-sm font-medium text-purple-600 dark:text-purple-400 whitespace-nowrap">
                          {daysUntil === 0 ? "Hoy!" : `En ${daysUntil} dias`}
                        </span>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {nextBirthday.toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Cake}
                title="Sin cumpleanos proximos"
                description="No hay clientes con cumpleanos en los proximos 7 dias"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
