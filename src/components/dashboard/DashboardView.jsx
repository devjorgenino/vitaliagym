import React, { useState } from "react";
import { useDashboardMetrics } from "../../hooks/useDashboardMetrics";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { StatCard, StatsGrid } from "../ui/stat-card";
import { EmptyState } from "../ui/empty-state";
import { ExchangeRateCard } from "./ExchangeRateCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { toast } from "sonner";
import {
  Clock,
  Cake,
  UserPlus,
  RefreshCw,
  Copy,
  Phone,
  Mail,
  IdCard,
} from "lucide-react";

export function DashboardView() {
  const { metrics, loading, error, refetch } = useDashboardMetrics();
  const [selectedClient, setSelectedClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const copyToClipboard = (text, label = "Texto") => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${label} copiado`, { duration: 1500 });
      })
      .catch(() => {
        toast.error("Error al copiar", { duration: 1500 });
      });
  };

  const handleClientClick = (client) => {
    setSelectedClient(client);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div
        className="space-y-4 sm:space-y-6"
        role="status"
        aria-label="Cargando dashboard"
      >
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
    <div className="flex flex-col lg:h-full gap-4 sm:gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 shrink-0">
        <div className="min-w-0">
          <div className="relative inline-block">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <span className="absolute -top-1 -right-3 w-2 h-2 bg-primary rounded-full animate-pulse" />
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            Vista general del gimnasio
          </p>
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
            <RefreshCw
              className="h-3.5 w-3.5 sm:h-4 sm:w-4"
              aria-hidden="true"
            />
            <span className="hidden xs:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {/* Metricas Principales - Grid responsive */}
      <div className="shrink-0">
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
        </StatsGrid>
      </div>

      {/* Graficos y Listas — ocupa el espacio restante */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:flex-1 lg:min-h-0">
        {/* Clientes proximos a vencer */}
        <Card className="overflow-hidden flex flex-col min-h-0 bg-gradient-to-br from-card to-card/80">
          <CardHeader className="pb-3 sm:pb-4 shrink-0">
            <CardTitle className="flex items-center justify-between gap-2 text-base sm:text-lg">
              <div className="flex items-center gap-2">
                <Clock
                  className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 flex-shrink-0"
                  aria-hidden="true"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="truncate cursor-default md:hidden">Clientes Proximos a Vencer</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-medium md:hidden">
                    <p>Clientes Proximos a Vencer</p>
                  </TooltipContent>
                </Tooltip>
                <span className="hidden md:inline truncate">Clientes Proximos a Vencer</span>
              </div>
              {metrics.expiringSoon?.length > 0 && (
                <span className="text-xs sm:text-sm font-normal bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full">
                  {metrics.expiringSoon.length} cliente
                  {metrics.expiringSoon.length !== 1 ? "s" : ""}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex-1 min-h-0 overflow-y-auto">
            {metrics.expiringSoon?.length > 0 ? (
              <div
                className="space-y-2 sm:space-y-3 pr-1"
                role="list"
                aria-label={`Lista de ${metrics.expiringSoon.length} clientes proximos a vencer`}
              >
                {metrics.expiringSoon.map((client, index) => {
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

                  const isExpired = daysUntil <= 0;
                  const isUrgent = daysUntil <= 2 && daysUntil > 0;

                  const cardStyles = isExpired
                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                    : isUrgent
                      ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                      : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";

                  const textStyles = isExpired
                    ? "text-red-600 dark:text-red-400"
                    : isUrgent
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-amber-600 dark:text-amber-400";

                  return (
                    <div
                      key={client.id}
                      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-lg border gap-2 ${cardStyles} cursor-pointer hover:opacity-90 transition-opacity`}
                      role="listitem"
                      onClick={() => handleClientClick(client)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleClientClick(client)
                      }
                      tabIndex={0}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">
                          {client.first_name} {client.last_name}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {client.plans?.name || "Sin plan"}
                        </p>
                        {client.phone && (
                          <div className="flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {client.phone}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(client.phone, "Teléfono");
                                  }}
                                  className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded"
                                  aria-label="Copiar teléfono"
                                >
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Copiar</TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-medium whitespace-nowrap ${textStyles}`}
                        >
                          {isExpired
                            ? daysUntil === 0
                              ? "Vence hoy"
                              : `${Math.abs(daysUntil)} dia${Math.abs(daysUntil) !== 1 ? "s" : ""} vencido`
                            : `${daysUntil} dia${daysUntil !== 1 ? "s" : ""}`}
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
        <Card className="overflow-hidden flex flex-col min-h-0 bg-gradient-to-br from-card to-card/80">
          <CardHeader className="pb-3 sm:pb-4 shrink-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Cake
                className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 flex-shrink-0"
                aria-hidden="true"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate cursor-default md:hidden">Cumpleanos del Mes</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium md:hidden">
                  <p>Cumpleanos del Mes</p>
                </TooltipContent>
              </Tooltip>
              <span className="hidden md:inline truncate">Cumpleanos del Mes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex-1 min-h-0 overflow-y-auto">
            {metrics.upcomingBirthdays?.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {metrics.upcomingBirthdays.map((client, index) => {
                  const birthDateParts = client.birth_date.split("-");
                  const birthDate = new Date(
                    parseInt(birthDateParts[0], 10),
                    parseInt(birthDateParts[1], 10) - 1,
                    parseInt(birthDateParts[2], 10),
                  );
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

      {/* Client Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalles del Cliente</DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-4 mt-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-semibold">
                    {selectedClient.first_name?.[0]}
                    {selectedClient.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-lg">
                    {selectedClient.first_name} {selectedClient.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedClient.plans?.name || "Sin plan"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                {selectedClient.phone && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Teléfono</p>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedClient.phone}</span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() =>
                              copyToClipboard(selectedClient.phone, "Teléfono")
                            }
                            className="p-1.5 hover:bg-muted rounded-md transition-colors"
                            aria-label="Copiar teléfono"
                          >
                            <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}

                {selectedClient.email && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate">
                          {selectedClient.email}
                        </span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() =>
                              copyToClipboard(selectedClient.email, "Email")
                            }
                            className="p-1.5 hover:bg-muted rounded-md transition-colors"
                            aria-label="Copiar email"
                          >
                            <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}

                {selectedClient.cedula && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cédula</p>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <IdCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedClient.cedula}</span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() =>
                              copyToClipboard(selectedClient.cedula, "Cédula")
                            }
                            className="p-1.5 hover:bg-muted rounded-md transition-colors"
                            aria-label="Copiar cédula"
                          >
                            <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Último pago</p>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedClient.last_payment_date
                        ? new Date(
                            parseInt(
                              selectedClient.last_payment_date.split("-")[0],
                              10,
                            ),
                            parseInt(
                              selectedClient.last_payment_date.split("-")[1],
                              10,
                            ) - 1,
                            parseInt(
                              selectedClient.last_payment_date.split("-")[2],
                              10,
                            ),
                          ).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "Sin pagos registrados"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
