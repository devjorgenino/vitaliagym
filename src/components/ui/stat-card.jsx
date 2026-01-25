import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * Tarjeta de estadística mejorada
 * 
 * @example
 * <StatCard
 *   title="Clientes Activos"
 *   value={150}
 *   change={+12}
 *   changeLabel="vs mes anterior"
 *   icon={Users}
 *   color="blue"
 * />
 */
export function StatCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon: Icon,
  color = "primary",
  loading = false,
  className,
  onClick,
}) {
  const colors = {
    primary: {
      bg: "bg-primary/10",
      icon: "text-primary",
      border: "border-primary/20",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      icon: "text-blue-600 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800",
    },
    green: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      icon: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      icon: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800",
    },
    red: {
      bg: "bg-red-50 dark:bg-red-950/30",
      icon: "text-red-600 dark:text-red-400",
      border: "border-red-200 dark:border-red-800",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-950/30",
      icon: "text-purple-600 dark:text-purple-400",
      border: "border-purple-200 dark:border-purple-800",
    },
  };

  const colorClasses = colors[color] || colors.primary;

  if (loading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const trendColor = change > 0 ? "text-emerald-600" : change < 0 ? "text-red-600" : "text-muted-foreground";

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all duration-200 border",
        colorClasses.border,
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tight">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
            {typeof change === "number" && (
              <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span>{change > 0 ? "+" : ""}{change}%</span>
                {changeLabel && (
                  <span className="text-muted-foreground font-normal ml-1">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn("p-3 rounded-xl", colorClasses.bg)}>
              <Icon className={cn("h-6 w-6", colorClasses.icon)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Grid de estadísticas
 */
export function StatsGrid({ children, className }) {
  return (
    <div className={cn(
      "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
      className
    )}>
      {children}
    </div>
  );
}

export default StatCard;
