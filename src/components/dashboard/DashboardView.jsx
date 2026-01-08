import React, { useState } from "react";
import { useDashboardMetrics } from "../../hooks/useDashboardMetrics";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { MetricCard } from "./DashboardCharts";
import { ExchangeRateCard } from "./ExchangeRateCard";

export function DashboardView() {
  const { metrics, loading, error, refetch } = useDashboardMetrics();

  // Debug temporal
  console.log("Dashboard metrics:", metrics);

  if (loading) {
    return (
      <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
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
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Error: {error}</p>
            <Button onClick={refetch}>Reintentar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Vista general del gimnasio</p>
        </div>
        <div className="flex items-center gap-2">
          <ExchangeRateCard compact={true} />
          <Button onClick={refetch} variant="outline" size="sm">
            Actualizar
          </Button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Clientes por Vencer"
          value={metrics.expiringSoon?.length || 0}
          icon="⏰"
          color="yellow"
          trend="Próximos 5 días"
        />

        <MetricCard
          title="Cumpleaños Próximos"
          value={metrics.upcomingBirthdays?.length || 0}
          icon="🎂"
          color="purple"
          trend="Próximos 7 días"
        />

        <MetricCard
          title="Clientes Nuevos"
          value={metrics.newClients?.length || 0}
          icon="👥"
          color="green"
          trend="Este mes"
        />

        <MetricCard
          title="Asistencia Semanal"
          value={`${metrics.weeklyAttendance || 0} registros`}
          icon="📊"
          color="blue"
          trend={`${metrics.weeklyUniqueClients || 0} clientes únicos (${(metrics.weeklyPercentage || 0).toFixed(1)}%)`}
        />
      </div>

      {/* Gráficos y Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clientes próximos a vencer */}
        <Card>
          <CardHeader>
            <CardTitle>⏰ Clientes Próximos a Vencer</CardTitle>
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
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
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
                        <span className="text-sm font-medium text-red-600">
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
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No hay clientes próximos a vencer
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos cumpleaños */}
        <Card>
          <CardHeader>
            <CardTitle>🎂 Cumpleaños del Mes</CardTitle>
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
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg"
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
                        <span className="text-sm font-medium text-purple-600">
                          {daysUntil === 0 ? "¡Hoy!" : `En ${daysUntil} días`}
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
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No hay cumpleaños próximos
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
