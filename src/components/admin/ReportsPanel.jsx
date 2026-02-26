"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import useStaff from "@/hooks/useStaff";
import useStaffPayments from "@/hooks/useStaffPayments";
import useExpenses from "@/hooks/useExpenses";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { PERMISSIONS } from "@/components/context/PermissionsProvider";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Download, Users, Banknote, Receipt,
  TrendingUp, Calendar, FileBarChart, Loader2, DollarSign, Info,
} from "lucide-react";
import {
  generateStaffReport,
  generatePaymentsReport,
  generateExpensesReport,
  generateFinancialReport,
  generateIncomeReport,
  downloadPDF,
  openPDF,
} from "@/lib/pdfGenerator";
import client from "@/api/client";
import { fetchWithOffline } from "@/lib/offline-read";

// Reportes que usan el selector de período (mes/año)
const PERIOD_REPORTS = new Set(["financial"]);

const REPORT_TYPES = [
  {
    id: "income",
    name: "Consolidado de Ingresos",
    description: "TODOS los ingresos por membresías desde el inicio del sistema, agrupados por mes",
    icon: DollarSign,
    color: "text-green-600 bg-green-100 dark:bg-green-900/30",
    usePeriod: false,
  },
  {
    id: "staff",
    name: "Reporte de Personal",
    description: "Lista completa del personal activo e inactivo con salarios",
    icon: Users,
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    usePeriod: false,
  },
  {
    id: "payments",
    name: "Reporte de Nómina",
    description: "Historial completo de todos los pagos al personal registrados",
    icon: Banknote,
    color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30",
    usePeriod: false,
  },
  {
    id: "expenses",
    name: "Reporte de Gastos",
    description: "Todos los gastos operativos registrados, agrupados por categoría",
    icon: Receipt,
    color: "text-red-600 bg-red-100 dark:bg-red-900/30",
    usePeriod: false,
  },
  {
    id: "financial",
    name: "Reporte Financiero",
    description: "Resumen financiero del período seleccionado: ingresos, nómina y gastos",
    icon: TrendingUp,
    color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
    usePeriod: true,
  },
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
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

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  const periodLabel = useMemo(
    () => `${MONTHS[parseInt(selectedMonth)]} ${selectedYear}`,
    [selectedMonth, selectedYear]
  );

  const selectedReportMeta = REPORT_TYPES.find((r) => r.id === selectedReport);
  const showPeriodSelector = selectedReportMeta?.usePeriod ?? false;

  // ── Helpers de fetch ──────────────────────────────────────────────────────

  /** Todos los pagos de membresías desde el inicio */
  const fetchAllClientPayments = async () => {
    const { data, error } = await fetchWithOffline(
      "report-client-payments-all",
      () =>
        client
          .from("payments")
          .select("*, clients(first_name, last_name, cedula), plans(name)")
          .order("payment_date", { ascending: true })
    );
    if (error) throw new Error(error.message);
    return data || [];
  };

  /** Pagos de membresías de un período específico (para reporte financiero) */
  const fetchClientPaymentsByPeriod = async (startDate, endDate) => {
    const { data, error } = await fetchWithOffline(
      `report-client-payments-${startDate}-${endDate}`,
      () =>
        client
          .from("payments")
          .select("*, clients(first_name, last_name, cedula), plans(name)")
          .gte("payment_date", startDate)
          .lte("payment_date", endDate)
          .order("payment_date", { ascending: true })
    );
    if (error) throw new Error(error.message);
    return data || [];
  };

  // ── Generación de reportes ────────────────────────────────────────────────

  const handleGenerateReport = async (action = "download") => {
    if (!selectedReport) {
      toast.error("Selecciona un tipo de reporte");
      return;
    }

    setIsGenerating(true);
    try {
      let doc;

      switch (selectedReport) {

        case "income": {
          // Todos los pagos de membresías históricos
          const allPayments = await fetchAllClientPayments();
          doc = await generateIncomeReport(allPayments, { period: "Histórico completo" });
          break;
        }

        case "staff": {
          // Todo el personal cargado en el hook
          doc = await generateStaffReport(staff, { subtitle: "Personal activo e inactivo" });
          break;
        }

        case "payments": {
          // Todos los pagos de nómina cargados en el hook (sin filtro de mes)
          doc = await generatePaymentsReport(payments, { period: "Histórico completo" });
          break;
        }

        case "expenses": {
          // Todos los gastos cargados en el hook (sin filtro de mes)
          doc = await generateExpensesReport(expenses, { period: "Histórico completo" });
          break;
        }

        case "financial": {
          // Solo el período seleccionado
          const year  = parseInt(selectedYear);
          const month = parseInt(selectedMonth);
          const startDate = new Date(year, month, 1).toISOString().split("T")[0];
          const endDate   = new Date(year, month + 1, 0).toISOString().split("T")[0];

          const periodPayments = payments.filter(
            (p) => p.payment_date >= startDate && p.payment_date <= endDate
          );
          const periodExpenses = expenses.filter(
            (e) => e.expense_date >= startDate && e.expense_date <= endDate
          );
          const clientPayments = await fetchClientPaymentsByPeriod(startDate, endDate);
          const totalIncome = clientPayments.reduce(
            (sum, p) => sum + (parseFloat(p.amount_usd) || 0), 0
          );

          doc = await generateFinancialReport(
            { staff, payments: periodPayments, expenses: periodExpenses, income: totalIncome },
            { period: periodLabel }
          );
          break;
        }

        default:
          throw new Error("Tipo de reporte no válido");
      }

      const reportName =
        REPORT_TYPES.find((r) => r.id === selectedReport)?.name || "reporte";

      if (action === "download") {
        downloadPDF(doc, reportName.toLowerCase().replace(/ /g, "_"));
        toast.success("Reporte descargado correctamente");
      } else {
        openPDF(doc);
        toast.success("Reporte abierto en nueva pestaña");
      }
    } catch (err) {
      console.error("Error generating report:", err);
      toast.error(`Error al generar el reporte: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
        <CardTitle className="flex items-center gap-2">
          <FileBarChart className="h-5 w-5" />
          Reportes
        </CardTitle>
        <CardDescription>
          Genera reportes en PDF con datos reales del sistema.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* ── Tipos de reporte ─────────────────────────────────────────── */}
        <div>
          <Label className="text-sm font-medium mb-3 block">Tipo de Reporte</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REPORT_TYPES.map((report) => {
              const Icon = report.icon;
              const isSelected = selectedReport === report.id;
              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  <div className={`p-3 rounded-lg shrink-0 ${report.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{report.name}</h4>
                      {report.usePeriod && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Calendar className="h-3 w-3" />
                          Por período
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
                    {isSelected && (
                      <Badge className="mt-2" variant="secondary">Seleccionado</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Selector de período (solo reporte financiero) ─────────────── */}
        {showPeriodSelector && (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Calendar className="h-4 w-4" />
              Período del Reporte Financiero
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
        )}

        {/* ── Resumen de datos disponibles ──────────────────────────────── */}
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Info className="h-4 w-4" />
            Datos en el sistema
          </div>
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
              <p className="text-muted-foreground">Pagos nómina totales</p>
              <p className="font-bold text-lg">{payments.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Gastos totales</p>
              <p className="font-bold text-lg">{expenses.length}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Acciones ─────────────────────────────────────────────────── */}
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
          <p className="text-center text-sm text-muted-foreground">
            Selecciona un tipo de reporte para continuar
          </p>
        )}
      </CardContent>
    </Card>
  );
}
