import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * Tarjeta de estadistica mejorada con responsive
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
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0">
              <Skeleton className="h-3 sm:h-4 w-16 sm:w-24" />
              <Skeleton className="h-6 sm:h-8 w-12 sm:w-16" />
              <Skeleton className="h-2.5 sm:h-3 w-14 sm:w-20" />
            </div>
            <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-lg sm:rounded-xl flex-shrink-0" />
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
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <CardContent className="p-3 sm:p-4 md:p-6">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="space-y-0.5 sm:space-y-1 flex-1 min-w-0">
            <p className="text-[11px] sm:text-xs md:text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">
                {subtitle}
              </p>
            )}
            {typeof change === "number" && (
              <div className={cn("flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-medium", trendColor)}>
                <TrendIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" aria-hidden="true" />
                <span>{change > 0 ? "+" : ""}{change}%</span>
                {changeLabel && (
                  <span className="text-muted-foreground font-normal ml-0.5 sm:ml-1 truncate">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn("p-1.5 sm:p-2 md:p-3 rounded-lg sm:rounded-xl flex-shrink-0", colorClasses.bg)}>
              <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6", colorClasses.icon)} aria-hidden="true" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Grid de estadisticas responsive
 */
export function StatsGrid({ children, className, columns = 4 }) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  };
  
  return (
    <div className={cn(
      "grid gap-3 sm:gap-4 md:gap-6",
      gridCols[columns] || gridCols[4],
      className
    )}>
      {children}
    </div>
  );
}

export default StatCard;
