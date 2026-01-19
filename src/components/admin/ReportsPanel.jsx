"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import useStaff from "@/hooks/useStaff";
import useStaffPayments from "@/hooks/useStaffPayments";
import useExpenses from "@/hooks/useExpenses";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { PERMISSIONS } from "@/components/context/PermissionsProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Users,
  Banknote,
  Receipt,
  TrendingUp,
  Calendar,
  FileBarChart,
  Loader2,
} from "lucide-react";
import {
  generateStaffReport,
  generatePaymentsReport,
  generateExpensesReport,
  generateFinancialReport,
  downloadPDF,
  openPDF,
} from "@/lib/pdfGenerator";

const REPORT_TYPES = [
  {
    id: "staff",
    name: "Reporte de Personal",
    description: "Lista completa del personal con información detallada",
    icon: Users,
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
  },
  {
    id: "payments",
    name: "Reporte de Pagos",
    description: "Historial de pagos al personal",
    icon: Banknote,
    color: "text-green-600 bg-green-100 dark:bg-green-900/30",
  },
  {
    id: "expenses",
    name: "Reporte de Gastos",
    description: "Resumen de gastos operativos por categoría",
    icon: Receipt,
    color: "text-red-600 bg-red-100 dark:bg-red-900/30",
  },
  {
    id: "financial",
    name: "Reporte Financiero",
    description: "Resumen financiero general (nómina + gastos)",
    icon: TrendingUp,
    color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
  },
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function ReportsPanel() {
  const { staff, loading: staffLoading } = useStaff();
  const { payments, loading: paymentsLoading } = useStaffPayments();
  const { expenses, loading: expensesLoading } = useExpenses();

  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isGenerating, setIsGenerating] = useState(false);

  const loading = staffLoading || paymentsLoading || expensesLoading;

  // Años disponibles
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  // Período seleccionado
  const periodLabel = useMemo(() => {
    return `${MONTHS[parseInt(selectedMonth)]} ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  // Filtrar datos por período
  const getFilteredData = () => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    
    const startDate = new Date(year, month, 1).toISOString().split("T")[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

    const filteredPayments = payments.filter((p) => {
      return p.payment_date >= startDate && p.payment_date <= endDate;
    });

    const filteredExpenses = expenses.filter((e) => {
      return e.expense_date >= startDate && e.expense_date <= endDate;
    });

    return { filteredPayments, filteredExpenses, startDate, endDate };
  };

  const handleGenerateReport = async (action = "download") => {
    if (!selectedReport) {
      toast.error("Selecciona un tipo de reporte");
      return;
    }

    setIsGenerating(true);

    try {
      const { filteredPayments, filteredExpenses } = getFilteredData();
      let doc;

      switch (selectedReport) {
        case "staff":
          doc = await generateStaffReport(staff, { subtitle: "Personal activo e inactivo" });
          break;
        case "payments":
          doc = await generatePaymentsReport(filteredPayments, { period: periodLabel });
          break;
        case "expenses":
          doc = await generateExpensesReport(filteredExpenses, { period: periodLabel });
          break;
        case "financial":
          doc = await generateFinancialReport(
            {
              staff,
              payments: filteredPayments,
              expenses: filteredExpenses,
              income: 0, // Aquí podrías conectar con los ingresos reales
            },
            { period: periodLabel }
          );
          break;
        default:
          throw new Error("Tipo de reporte no válido");
      }

      if (action === "download") {
        const reportName = REPORT_TYPES.find((r) => r.id === selectedReport)?.name || "reporte";
        downloadPDF(doc, reportName.toLowerCase().replace(/ /g, "_"));
        toast.success("Reporte descargado correctamente");
      } else {
        openPDF(doc);
        toast.success("Reporte abierto en nueva pestaña");
      }
    } catch (err) {
      console.error("Error generating report:", err);
      toast.error("Error al generar el reporte");
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              Reportes
            </CardTitle>
            <CardDescription>
              Genera reportes en PDF profesionales y listos para imprimir.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Selector de período */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Calendar className="h-4 w-4" />
            Período del Reporte
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mes</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Año</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tipos de reportes */}
        <div className="mb-6">
          <Label className="text-sm font-medium mb-3 block">Tipo de Reporte</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORT_TYPES.map((report) => {
              const Icon = report.icon;
              const isSelected = selectedReport === report.id;
              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`
                    flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all
                    ${isSelected 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                      : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                    }
                  `}
                >
                  <div className={`p-3 rounded-lg ${report.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{report.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {report.description}
                    </p>
                    {isSelected && (
                      <Badge className="mt-2" variant="secondary">
                        Seleccionado
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Resumen de datos */}
        <div className="bg-muted/30 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-medium mb-3">Datos disponibles para {periodLabel}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Personal total</p>
              <p className="font-bold text-lg">{staff.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Personal activo</p>
              <p className="font-bold text-lg text-green-600">
                {staff.filter((s) => s.status === "active").length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Pagos del período</p>
              <p className="font-bold text-lg">{getFilteredData().filteredPayments.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Gastos del período</p>
              <p className="font-bold text-lg">{getFilteredData().filteredExpenses.length}</p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <PermissionGate permission={PERMISSIONS.ADMIN_REPORTS_EXPORT}>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => handleGenerateReport("download")}
              disabled={!selectedReport || isGenerating}
              className="flex-1 gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Descargar PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => handleGenerateReport("preview")}
              disabled={!selectedReport || isGenerating}
              className="flex-1 gap-2"
            >
              <FileText className="h-4 w-4" />
              Vista Previa
            </Button>
          </div>
        </PermissionGate>

        {!selectedReport && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Selecciona un tipo de reporte para continuar
          </p>
        )}
      </CardContent>
    </Card>
  );
}
