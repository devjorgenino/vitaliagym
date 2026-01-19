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
      <div className="space-y-6">
        <div>
          <Skeleton key="1" className="h-12 w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="space-y-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Vista general del gimnasio</p>
        </div>
        <div className="flex items-center gap-2">
          <ExchangeRateCard compact={true} />
          <Button onClick={refetch} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Métricas Principales */}
      <StatsGrid>
        <StatCard
          title="Clientes por Vencer"
          value={metrics.expiringSoon?.length || 0}
          subtitle="Próximos 5 días"
          icon={Clock}
          color="amber"
        />

        <StatCard
          title="Cumpleaños Próximos"
          value={metrics.upcomingBirthdays?.length || 0}
          subtitle="Próximos 7 días"
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
          subtitle={`${metrics.weeklyUniqueClients || 0} clientes únicos (${(
            metrics.weeklyPercentage || 0
          ).toFixed(1)}%)`}
          icon={Activity}
          color="blue"
        />
      </StatsGrid>

      {/* Gráficos y Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clientes próximos a vencer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Clientes Próximos a Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.expiringSoon?.length > 0 ? (
              <div className="space-y-3">
                {metrics.expiringSoon.map((client, index) => {
                  const daysUntil = Math.ceil(
                    (new Date(client.next_payment_date) - new Date()) /
                      (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800"
                    >
                      <div>
                        <p className="font-medium">
                          {client.first_name} {client.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {client.plans?.name || "Sin plan"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                          {daysUntil <= 0
                            ? `${Math.abs(daysUntil)} días vencido`
                            : `${daysUntil} días`}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {new Date(
                            client.next_payment_date
                          ).toLocaleDateString("es-ES")}
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
                description="No hay clientes con pagos próximos a vencer en los próximos 5 días"
              />
            )}
          </CardContent>
        </Card>

        {/* Próximos cumpleaños */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5 text-purple-600" />
              Cumpleaños del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.upcomingBirthdays?.length > 0 ? (
              <div className="space-y-3">
                {metrics.upcomingBirthdays.map((client, index) => {
                  const birthDate = new Date(client.birth_date);
                  const today = new Date();
                  const nextBirthday = new Date(
                    today.getFullYear(),
                    birthDate.getMonth(),
                    birthDate.getDate()
                  );
                  if (nextBirthday < today) {
                    nextBirthday.setFullYear(today.getFullYear());
                  }
                  const daysUntil = Math.ceil(
                    (nextBirthday - today) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800"
                    >
                      <div>
                        <p className="font-medium">
                          {client.first_name} {client.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {birthDate.toLocaleDateString("es-ES", {
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                          {daysUntil === 0 ? "Hoy!" : `En ${daysUntil} días`}
                        </span>
                        <p className="text-xs text-muted-foreground">
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
                title="Sin cumpleaños próximos"
                description="No hay clientes con cumpleaños en los próximos 7 días"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
