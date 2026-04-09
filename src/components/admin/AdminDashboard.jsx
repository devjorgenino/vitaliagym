"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import useAdminStats from "@/hooks/useAdminStats";
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  CreditCard,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { Button } from "@/components/ui/button";

// Colores del tema VitaliaGym
const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  chart1: "hsl(var(--chart-1))",
  chart2: "hsl(var(--chart-2))",
  chart3: "hsl(var(--chart-3))",
  chart4: "hsl(var(--chart-4))",
  chart5: "hsl(var(--chart-5))",
};

// Colores específicos para los gráficos (hex para mejor compatibilidad)
const PIE_COLORS = [
  "#626D21", // Dark Moss Green
  "#0A3317", // Dark Green
  "#E2F1BB", // Tea Green
  "#8B9B3D", // Moss Light
  "#4A5A15", // Moss Dark
  "#B5C98A", // Pale Green
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatShortCurrency = (value) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Summary Card Component
function SummaryCard({ title, value, subtitle, icon: Icon, trend, trendValue, variant = "default" }) {
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "border-l-4 border-l-green-500";
      case "warning":
        return "border-l-4 border-l-yellow-500";
      case "danger":
        return "border-l-4 border-l-red-500";
      case "primary":
        return "border-l-4 border-l-primary";
      default:
        return "";
    }
  };

  return (
    <Card className={getVariantStyles()}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1">
                {trend === "up" ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-xs font-medium ${trend === "up" ? "text-green-500" : "text-red-500"}`}>
                  {trendValue}
                </span>
              </div>
            )}
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading skeleton for cards
function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

// Loading skeleton for charts
function ChartSkeleton({ height = 300 }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const {
    loading,
    error,
    refetch,
    summaryStats,
    currentMonthStats,
    monthlyIncomeVsExpenses,
    expensesByCategory,
    staffByPosition,
    monthlyStaffPayments,
    recentActivity,
  } = useAdminStats();

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error al cargar datos</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={refetch} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Panel de Control</h2>
          <p className="text-sm text-muted-foreground">
            Resumen financiero y operativo - {currentYear}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards - Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard
              title="Ingresos del Mes"
              value={formatCurrency(currentMonthStats.income)}
              subtitle={currentMonthStats.monthName}
              icon={TrendingUp}
              variant="success"
            />
            <SummaryCard
              title="Gastos del Mes"
              value={formatCurrency(currentMonthStats.expenses)}
              subtitle="Gastos operativos"
              icon={Receipt}
              variant="warning"
            />
            <SummaryCard
              title="Nómina del Mes"
              value={formatCurrency(currentMonthStats.payroll)}
              subtitle="Pagos al personal"
              icon={CreditCard}
              variant="primary"
            />
            <SummaryCard
              title="Balance Mensual"
              value={formatCurrency(currentMonthStats.total)}
              subtitle="Ingresos - Egresos"
              icon={Wallet}
              variant={currentMonthStats.total >= 0 ? "success" : "danger"}
            />
          </>
        )}
      </div>

      {/* Summary Cards - Row 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard
              title="Personal Activo"
              value={summaryStats.staff.active}
              subtitle={`${summaryStats.staff.total} registrados`}
              icon={Users}
            />
            <SummaryCard
              title="Ingresos Anuales"
              value={formatCurrency(summaryStats.balance.totalIncome)}
              subtitle={`${summaryStats.income.completed} pagos`}
              icon={DollarSign}
              variant="success"
            />
            <SummaryCard
              title="Egresos Anuales"
              value={formatCurrency(summaryStats.balance.totalEgresos)}
              subtitle="Gastos + Nómina"
              icon={TrendingDown}
              variant="warning"
            />
            <SummaryCard
              title="Balance Anual"
              value={formatCurrency(summaryStats.balance.netBalance)}
              subtitle="Resultado neto"
              icon={Building2}
              variant={summaryStats.balance.netBalance >= 0 ? "success" : "danger"}
            />
          </>
        )}
      </div>

      {/* Charts Row 1 - Income vs Expenses (Main Chart) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {loading ? (
          <>
            <div className="lg:col-span-2">
              <ChartSkeleton height={350} />
            </div>
            <ChartSkeleton height={350} />
          </>
        ) : (
          <>
            {/* Bar Chart - Income vs Expenses by Month */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ingresos vs Egresos Mensuales</CardTitle>
                <CardDescription>
                  Comparativa de ingresos, gastos y nómina por mes - {currentYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={monthlyIncomeVsExpenses}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={formatShortCurrency}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="ingresos"
                      name="Ingresos"
                      fill="#626D21"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="gastos"
                      name="Gastos"
                      fill="#E2F1BB"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="nomina"
                      name="Nómina"
                      fill="#0A3317"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart - Expenses by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Gastos por Categoría</CardTitle>
                <CardDescription>
                  Distribución de gastos operativos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {expensesByCategory.length === 0 ? (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                    <p>No hay datos de gastos</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={expensesByCategory}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {expensesByCategory.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts Row 2 - Staff Distribution and Payroll Trend */}
      <div className="grid gap-6 md:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton height={300} />
            <ChartSkeleton height={300} />
          </>
        ) : (
          <>
            {/* Pie Chart - Staff by Position */}
            <Card>
              <CardHeader>
                <CardTitle>Personal por Puesto</CardTitle>
                <CardDescription>
                  Distribución del personal activo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {staffByPosition.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <p>No hay datos de personal</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={staffByPosition}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {staffByPosition.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Area Chart - Monthly Payroll */}
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Nómina</CardTitle>
                <CardDescription>
                  Pagos al personal por mes - {currentYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={monthlyStaffPayments}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={formatShortCurrency}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Total Nómina"
                      stroke="#626D21"
                      fill="#E2F1BB"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Recent Activity and Pending Items */}
      <div className="grid gap-6 md:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton height={300} />
            <ChartSkeleton height={300} />
          </>
        ) : (
          <>
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Actividad Reciente</CardTitle>
                <CardDescription>
                  Últimas transacciones registradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    <p>No hay actividad reciente</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              activity.type === "income"
                                ? "bg-green-100 text-green-600"
                                : activity.type === "expense"
                                ? "bg-yellow-100 text-yellow-600"
                                : "bg-blue-100 text-blue-600"
                            }`}
                          >
                            {activity.type === "income" ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : activity.type === "expense" ? (
                              <Receipt className="h-4 w-4" />
                            ) : (
                              <CreditCard className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium line-clamp-1">
                              {activity.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activity.date).toLocaleDateString("es-VE")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold ${
                              activity.type === "income"
                                ? "text-green-600"
                                : "text-foreground"
                            }`}
                          >
                            {activity.type === "income" ? "+" : "-"}
                            {formatCurrency(activity.amount)}
                          </p>
                          <Badge
                            variant={
                              activity.status === "paid" || activity.status === "completed"
                                ? "default"
                                : activity.status === "pending"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {activity.status === "paid" || activity.status === "completed"
                              ? "Pagado"
                              : activity.status === "pending"
                              ? "Pendiente"
                              : activity.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Resumen de Pendientes</CardTitle>
                <CardDescription>
                  Pagos y gastos por procesar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Pending Staff Payments */}
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">Nómina Pendiente</span>
                    </div>
                    <Badge variant="secondary">
                      {summaryStats.staffPayments.pending} pagos
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(summaryStats.staffPayments.totalPending)}
                  </p>
                </div>

                {/* Pending Expenses */}
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-yellow-500" />
                      <span className="font-medium">Gastos Pendientes</span>
                    </div>
                    <Badge variant="secondary">
                      {summaryStats.expenses.pending} gastos
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {formatCurrency(summaryStats.expenses.totalPending)}
                  </p>
                </div>

                {/* Total Pending */}
                <div className="p-4 rounded-lg border-2 border-dashed">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Total por Pagar</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      summaryStats.staffPayments.totalPending +
                        summaryStats.expenses.totalPending
                    )}
                  </p>
                </div>

                {/* Staff Info */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">
                    Costo mensual estimado de nómina
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(summaryStats.staff.totalMonthlySalaries)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Basado en {summaryStats.staff.active} empleados activos
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
