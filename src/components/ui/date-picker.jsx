"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function DatePicker({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
  size = "default",
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showSelectors, setShowSelectors] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState(
    value ? new Date(value + "T00:00:00") : new Date()
  );
  const containerRef = React.useRef(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentYear = today.getFullYear();
  const years = Array.from({ length: currentYear - 1930 + 1 }, (_, i) => currentYear - i).reverse();

  const selectedDate = value ? new Date(value + "T00:00:00") : null;

  const sizeClasses = {
    sm: {
      button: "h-8 text-xs px-2",
      popup: "min-w-[240px] max-w-[260px] p-1.5",
      day: "h-7 w-7 text-xs",
      dayHeader: "h-5 text-xs",
      nav: "p-0.5",
      navIcon: "h-3 w-3",
      monthBtn: "text-xs px-1 py-0.5",
    },
    default: {
      button: "h-10 w-full text-sm px-3",
      popup: "min-w-[280px] max-w-[320px] p-2",
      day: "h-9 w-9 text-sm",
      dayHeader: "h-6 text-xs",
      nav: "p-1.5",
      navIcon: "h-4 w-4",
      monthBtn: "text-sm px-3 py-1.5",
    },
  };

  const sizes = sizeClasses[size] || sizeClasses.default;

  const daysInMonth = React.useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowSelectors(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (date) => {
    const formattedDate = format(date, "yyyy-MM-dd");
    onChange?.(formattedDate);
    setIsOpen(false);
    setShowSelectors(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setShowSelectors(false);
    }
  };

  const handleYearChange = (e) => {
    const year = parseInt(e.target.value, 10);
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
  };

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const dayNames = ["D", "L", "M", "X", "J", "V", "S"];

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <Button
        type="button"
        variant={"outline"}
        className={cn(
          "justify-between font-normal w-full",
          sizes.button,
          !value && "text-muted-foreground"
        )}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={value ? `Fecha: ${format(new Date(value + "T00:00:00"), "dd/MM/yyyy", { locale: es })}` : placeholder}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="truncate">
          {value ? format(new Date(value + "T00:00:00"), "dd/MM/yyyy", { locale: es }) : placeholder}
        </span>
        <CalendarIcon className={cn("ml-2 flex-shrink-0", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      </Button>

      {isOpen && (
        <div 
          className={cn(
            "absolute top-full left-1/2 -translate-x-1/2 z-50 mt-1",
            "bg-popover border rounded-md shadow-md",
            "w-full",
            sizes.popup
          )}
          role="dialog"
          aria-modal="true"
          onKeyDown={handleKeyDown}
        >
          {showSelectors ? (
            <div className="space-y-2" role="presentation">
              <div className="flex items-center justify-between">
                <span className={cn("font-medium", size === "sm" ? "text-xs" : "text-sm")}>Seleccionar año</span>
                <button
                  type="button"
                  className={cn(
                    "text-muted-foreground hover:text-foreground rounded hover:bg-accent",
                    size === "sm" ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-1"
                  )}
                  onClick={() => setShowSelectors(false)}
                >
                  ← Volver
                </button>
              </div>
              
              <select
                value={currentMonth.getFullYear()}
                onChange={(e) => {
                  handleYearChange(e);
                  setShowSelectors(false);
                }}
                className={cn(
                  "w-full border rounded bg-background",
                  size === "sm" ? "p-1.5 text-xs" : "p-2 text-sm"
                )}
                size={8}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className={cn("flex items-center justify-between mb-1.5", size === "sm" ? "mb-1" : "mb-2")}>
                <button
                  type="button"
                  className={cn("hover:bg-accent rounded transition-colors", sizes.nav)}
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className={sizes.navIcon} />
                </button>
                <button
                  type="button"
                  className={cn("font-medium hover:bg-accent rounded transition-colors", sizes.monthBtn)}
                  onClick={() => setShowSelectors(true)}
                  aria-label="Seleccionar año"
                >
                  {months[currentMonth.getMonth()].slice(0, 3)} {currentMonth.getFullYear()}
                </button>
                <button
                  type="button"
                  className={cn("hover:bg-accent rounded transition-colors", sizes.nav)}
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className={sizes.navIcon} />
                </button>
              </div>

              <div className={cn("grid grid-cols-7 gap-0.5 mb-1.5", size === "sm" ? "mb-1" : "mb-2")} role="row">
                {dayNames.map((day) => (
                  <div 
                    key={day} 
                    className={cn(
                      "flex items-center justify-center text-muted-foreground",
                      sizes.dayHeader
                    )}
                    role="columnheader"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5" role="grid">
                {daysInMonth.map(({ date, isCurrentMonth }, index) => {
                  const isSelected = selectedDate &&
                    date.getDate() === selectedDate.getDate() &&
                    date.getMonth() === selectedDate.getMonth() &&
                    date.getFullYear() === selectedDate.getFullYear();
                  
                  const isToday = date.getTime() === today.getTime();

                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={!isCurrentMonth}
                      onClick={() => handleSelect(date)}
                      className={cn(
                        "rounded transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary",
                        sizes.day,
                        !isCurrentMonth && "text-muted-foreground opacity-30",
                        isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                        isToday && !isSelected && "bg-accent font-bold",
                        !isCurrentMonth && "cursor-not-allowed"
                      )}
                      role="gridcell"
                      aria-selected={isSelected}
                      tabIndex={isCurrentMonth ? 0 : -1}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
