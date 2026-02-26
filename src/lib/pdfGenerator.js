import jsPDF from "jspdf";
import "jspdf-autotable";
import { loadLogoForPDF, getLogoDimensions } from "./logoLoader";

/**
 * Utilidades para generación de reportes PDF profesionales
 * VitaliaGym - Sistema de Gestión
 * 
 * Colores basados en el tema VitaliaGym:
 * - Primary: Dark Moss Green (#626D21)
 * - Secondary: Tea Green (#E2F1BB)
 * - Background: Ivory (#FFFFEB)
 * - Foreground: Night (#0E120D)
 * - Dark Green: (#0A3317)
 */

// Colores del tema VitaliaGym (RGB)
const COLORS = {
  // Colores principales del tema
  primary: [98, 109, 33],        // Dark Moss Green #626D21
  primaryDark: [10, 51, 23],     // Dark Green #0A3317
  secondary: [226, 241, 187],    // Tea Green #E2F1BB
  background: [255, 255, 235],   // Ivory #FFFFEB
  foreground: [14, 18, 13],      // Night #0E120D
  
  // Colores funcionales
  success: [34, 139, 34],        // Forest Green (armoniza con el tema)
  warning: [184, 134, 11],       // Dark Goldenrod
  danger: [178, 34, 34],         // Firebrick
  
  // Colores neutros
  muted: [128, 128, 100],        // Gris verdoso
  light: [248, 250, 240],        // Casi blanco con tinte verde
  white: [255, 255, 255],
};

// Configuración base del documento
const createBasePDF = (orientation = "portrait") => {
  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  // Configurar fuente por defecto
  doc.setFont("helvetica");
  
  return doc;
};

// Agregar encabezado del documento con logo
const addHeader = async (doc, title, subtitle = "") => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Fondo del header con color primary
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 38, "F");
  
  // Borde inferior decorativo con secondary
  doc.setFillColor(...COLORS.secondary);
  doc.rect(0, 38, pageWidth, 2, "F");
  
  // Cargar logo
  const logoData = await loadLogoForPDF();
  
  if (logoData) {
    // Obtener dimensiones proporcionales del logo
    // El logo tiene proporción 2.8:1, usar ancho de 55mm
    const logoDims = getLogoDimensions(55);
    
    try {
      // Centrar verticalmente en el header (altura 38mm)
      const logoY = (38 - logoDims.height) / 2;
      doc.addImage(logoData, "PNG", 12, logoY, logoDims.width, logoDims.height);
    } catch (err) {
      // Fallback: texto del nombre
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("VitaliaGym", 15, 20);
    }
  } else {
    // Fallback: texto del nombre
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("VitaliaGym", 15, 20);
  }
  
  // Título del reporte (alineado a la derecha)
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth - 15, 15, { align: "right" });
  
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.secondary);
    doc.text(subtitle, pageWidth - 15, 23, { align: "right" });
  }
  
  // Fecha de generación
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.secondary);
  doc.text(
    `Generado: ${new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    pageWidth - 15,
    31,
    { align: "right" }
  );
  
  return 48; // Retorna la posición Y después del header
};

// Agregar pie de página
const addFooter = (doc, pageNumber, totalPages) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Línea separadora con color primary
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 18, pageWidth - 15, pageHeight - 18);
  
  // Barra de color
  doc.setFillColor(...COLORS.secondary);
  doc.rect(15, pageHeight - 17, 40, 0.8, "F");
  
  // Texto del pie
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("VitaliaGym", 15, pageHeight - 10);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text(" - Documento confidencial", 15 + doc.getTextWidth("VitaliaGym"), pageHeight - 10);
  
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 15, pageHeight - 10, { align: "right" });
};

// Agregar tarjeta de estadísticas
const addStatCard = (doc, x, y, width, label, value, color = COLORS.primary) => {
  // Fondo de la tarjeta
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(x, y, width, 25, 3, 3, "F");
  
  // Borde izquierdo de color
  doc.setFillColor(...color);
  doc.roundedRect(x, y, 4, 25, 2, 2, "F");
  doc.rect(x + 2, y, 2, 25, "F"); // Completar el borde
  
  // Valor
  doc.setTextColor(...COLORS.foreground);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  
  // Ajustar tamaño si el texto es muy largo
  const valueText = String(value);
  if (valueText.length > 12) {
    doc.setFontSize(12);
  }
  doc.text(valueText, x + 12, y + 12);
  
  // Label
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(label, x + 12, y + 20);
  
  return y + 30;
};

// Agregar sección con título
const addSection = (doc, y, title) => {
  doc.setTextColor(...COLORS.foreground);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 15, y);
  
  // Línea bajo el título con color primary
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(1);
  doc.line(15, y + 2, 15 + doc.getTextWidth(title) + 5, y + 2);
  
  // Línea más delgada que continúa
  doc.setDrawColor(...COLORS.secondary);
  doc.setLineWidth(0.5);
  doc.line(15 + doc.getTextWidth(title) + 8, y + 2, 80, y + 2);
  
  return y + 12;
};

// Formatear moneda
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "VES",
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

// Formatear fecha
const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Generar reporte de personal
 */
export const generateStaffReport = async (staff, options = {}) => {
  const doc = createBasePDF("landscape");
  let y = await addHeader(doc, "Reporte de Personal", options.subtitle || "Lista completa");
  
  // Estadísticas
  const activeStaff = staff.filter((s) => s.status === "active");
  const totalSalary = activeStaff.reduce((sum, s) => sum + (parseFloat(s.salary) || 0), 0);
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = (pageWidth - 60) / 4;
  
  addStatCard(doc, 15, y, cardWidth, "Total Personal", staff.length, COLORS.primary);
  addStatCard(doc, 15 + cardWidth + 10, y, cardWidth, "Activos", activeStaff.length, COLORS.success);
  addStatCard(doc, 15 + (cardWidth + 10) * 2, y, cardWidth, "Inactivos", staff.filter((s) => s.status !== "active").length, COLORS.warning);
  addStatCard(doc, 15 + (cardWidth + 10) * 3, y, cardWidth, "Nómina Mensual", formatCurrency(totalSalary), COLORS.primaryDark);
  
  y += 35;
  y = addSection(doc, y, "Listado de Personal");
  
  // Tabla de personal
  const tableData = staff.map((s) => [
    `${s.first_name} ${s.last_name}`,
    s.position,
    s.email,
    s.phone || "-",
    formatDate(s.hire_date),
    formatCurrency(s.salary),
    s.status === "active" ? "Activo" : s.status === "inactive" ? "Inactivo" : s.status === "on_leave" ? "Licencia" : "Terminado",
  ]);
  
  doc.autoTable({
    startY: y,
    head: [["Nombre", "Cargo", "Email", "Teléfono", "Fecha Ingreso", "Salario", "Estado"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.foreground,
    },
    alternateRowStyles: {
      fillColor: COLORS.light,
    },
    columnStyles: {
      0: { fontStyle: "bold" },
      5: { halign: "right" },
      6: { halign: "center" },
    },
    margin: { left: 15, right: 15 },
    styles: {
      lineColor: COLORS.muted,
      lineWidth: 0.1,
    },
  });
  
  // Agregar pies de página
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }
  
  return doc;
};

/**
 * Generar reporte de pagos al personal (nómina)
 * Recibe TODOS los pagos sin filtrar; filtra internamente por período si se indica.
 */
export const generatePaymentsReport = async (payments, options = {}) => {
  const doc = createBasePDF("landscape");
  const period = options.period || "Todos los períodos";
  let y = await addHeader(doc, "Reporte de Nómina", period);

  // Estadísticas sobre TODOS los pagos recibidos
  const paidPayments    = payments.filter((p) => p.status === "paid");
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const totalPaid    = paidPayments.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);
  const totalPending = pendingPayments.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);

  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = (pageWidth - 60) / 4;

  addStatCard(doc, 15,                        y, cardWidth, "Total Registros",  payments.length,          COLORS.primary);
  addStatCard(doc, 15 + (cardWidth + 10),     y, cardWidth, "Pagados",          paidPayments.length,      COLORS.success);
  addStatCard(doc, 15 + (cardWidth + 10) * 2, y, cardWidth, "Total Pagado",     formatCurrency(totalPaid),    COLORS.success);
  addStatCard(doc, 15 + (cardWidth + 10) * 3, y, cardWidth, "Total Pendiente",  formatCurrency(totalPending), COLORS.warning);

  y += 35;
  y = addSection(doc, y, "Detalle de Pagos al Personal");

  const PAYMENT_METHOD_LABELS = {
    cash: "Efectivo", transfer: "Transferencia",
    check: "Cheque", mobile_payment: "Pago Móvil",
  };

  const tableData = payments.map((p) => [
    p.staff ? `${p.staff.first_name} ${p.staff.last_name}` : "—",
    p.staff?.position || "—",
    formatDate(p.payment_date),
    `${formatDate(p.period_start)} - ${formatDate(p.period_end)}`,
    formatCurrency(parseFloat(p.base_amount) || 0),
    formatCurrency(parseFloat(p.bonus) || 0),
    formatCurrency(parseFloat(p.deductions) || 0),
    formatCurrency(parseFloat(p.total_amount) || 0),
    PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method || "—",
    p.status === "paid" ? "Pagado" : p.status === "pending" ? "Pendiente" : "Cancelado",
  ]);

  doc.autoTable({
    startY: y,
    head: [["Empleado", "Cargo", "Fecha Pago", "Período", "Base", "Bonos", "Deduc.", "Total", "Método", "Estado"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 6.5, textColor: COLORS.foreground },
    alternateRowStyles: { fillColor: COLORS.light },
    foot: [["", "", "", "TOTAL", "", "", "", formatCurrency(totalPaid), "", ""]],
    footStyles: { fillColor: COLORS.secondary, textColor: COLORS.primaryDark, fontStyle: "bold", fontSize: 7 },
    columnStyles: {
      0: { fontStyle: "bold" },
      4: { halign: "right" }, 5: { halign: "right" },
      6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" },
      8: { halign: "center" }, 9: { halign: "center" },
    },
    margin: { left: 15, right: 15 },
    styles: { lineColor: COLORS.muted, lineWidth: 0.1, overflow: "ellipsize" },
  });

  // Caja de totales
  const finalY = doc.lastAutoTable.finalY + 6;
  doc.setFillColor(...COLORS.secondary);
  doc.roundedRect(pageWidth - 125, finalY, 110, 28, 3, 3, "F");
  doc.setTextColor(...COLORS.primaryDark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL PAGADO:", pageWidth - 120, finalY + 10);
  doc.setFontSize(13);
  doc.text(formatCurrency(totalPaid), pageWidth - 18, finalY + 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Pendiente: ${formatCurrency(totalPending)}`, pageWidth - 120, finalY + 21);

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) { doc.setPage(i); addFooter(doc, i, totalPages); }
  return doc;
};

/**
 * Generar reporte de gastos
 * Incluye TODOS los gastos recibidos, sin filtrar por status en el total visible.
 */
export const generateExpensesReport = async (expenses, options = {}) => {
  const doc = createBasePDF("portrait");
  const period = options.period || "Todos los períodos";
  let y = await addHeader(doc, "Reporte de Gastos", period);

  // Todos los gastos (independiente de status) para conteo; monto solo pagados
  const paidExpenses = expenses.filter((e) => e.status === "paid");
  const totalAmount  = paidExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalPending = expenses
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  // Agrupar pagados por categoría
  const byCategory = paidExpenses.reduce((acc, e) => {
    const cat = e.category || "Sin categoría";
    acc[cat] = (acc[cat] || 0) + (parseFloat(e.amount) || 0);
    return acc;
  }, {});

  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = (pageWidth - 50) / 3;

  addStatCard(doc, 15,                        y, cardWidth, "Total Gastos",   expenses.length,           COLORS.primary);
  addStatCard(doc, 15 + (cardWidth + 10),     y, cardWidth, "Monto Pagado",   formatCurrency(totalAmount),   COLORS.danger);
  addStatCard(doc, 15 + (cardWidth + 10) * 2, y, cardWidth, "Monto Pendiente",formatCurrency(totalPending),  COLORS.warning);

  y += 35;

  // Resumen por categoría
  y = addSection(doc, y, "Resumen por Categoría");

  const categoryData = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => [
      category,
      formatCurrency(amount),
      totalAmount > 0 ? `${((amount / totalAmount) * 100).toFixed(1)}%` : "0%",
    ]);

  if (categoryData.length === 0) categoryData.push(["Sin datos", formatCurrency(0), "0%"]);

  doc.autoTable({
    startY: y,
    head: [["Categoría", "Monto", "Porcentaje"]],
    body: categoryData,
    theme: "grid",
    headStyles: { fillColor: COLORS.primaryDark, textColor: COLORS.white, fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: COLORS.foreground },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" }, 2: { halign: "center" } },
    margin: { left: 15, right: 15 },
    tableWidth: pageWidth - 30,
    styles: { lineColor: COLORS.muted, lineWidth: 0.1 },
  });

  y = doc.lastAutoTable.finalY + 15;

  // Detalle completo de gastos
  y = addSection(doc, y, "Detalle de Gastos");

  const tableData = expenses.map((e) => {
    const desc = e.description || "—";
    return [
      formatDate(e.expense_date),
      e.category || "—",
      desc.length > 40 ? desc.substring(0, 40) + "…" : desc,
      e.vendor || "—",
      formatCurrency(parseFloat(e.amount) || 0),
      e.status === "paid" ? "Pagado" : e.status === "pending" ? "Pendiente" : "Cancelado",
    ];
  });

  doc.autoTable({
    startY: y,
    head: [["Fecha", "Categoría", "Descripción", "Proveedor", "Monto", "Estado"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: COLORS.foreground },
    alternateRowStyles: { fillColor: COLORS.light },
    foot: [["", "", "", "TOTAL PAGADO", formatCurrency(totalAmount), ""]],
    footStyles: { fillColor: COLORS.secondary, textColor: COLORS.primaryDark, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      4: { halign: "right", fontStyle: "bold" },
      5: { halign: "center" },
    },
    margin: { left: 15, right: 15 },
    styles: { lineColor: COLORS.muted, lineWidth: 0.1, overflow: "ellipsize" },
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) { doc.setPage(i); addFooter(doc, i, totalPages); }
  return doc;
};

/**
 * Generar reporte financiero general
 */
export const generateFinancialReport = async (data, options = {}) => {
  const { staff, payments, expenses, income } = data;
  const doc = createBasePDF("portrait");
  const period = options.period || new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  let y = await addHeader(doc, "Reporte Financiero", period);

  const pageWidth = doc.internal.pageSize.getWidth();

  // income ya viene en USD (amount_usd sumado en ReportsPanel)
  const formatUSD = (v) => `$${(v || 0).toFixed(2)}`;

  const totalIncome   = income || 0;
  const totalPayroll  = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);
  const totalExpenses = expenses
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  // balance: ingresos USD - egresos Bs (nota informativa; si quieres comparar en la misma moneda
  //           necesitarías la tasa de cambio, pero mostramos las cifras separadas)
  const netResult = totalIncome - totalPayroll - totalExpenses;

  // Tarjetas — ingresos en USD, egresos en Bs (se indica la moneda)
  const cardWidth = (pageWidth - 50) / 3;
  addStatCard(doc, 15,                        y, cardWidth, "Ingresos (USD)",       formatUSD(totalIncome),          COLORS.success);
  addStatCard(doc, 15 + (cardWidth + 10),     y, cardWidth, "Nómina Pagada (Bs)",   formatCurrency(totalPayroll),    COLORS.warning);
  addStatCard(doc, 15 + (cardWidth + 10) * 2, y, cardWidth, "Gastos Operativos (Bs)",formatCurrency(totalExpenses),  COLORS.danger);

  y += 35;

  // Resultado neto en USD
  const resultColor = netResult >= 0 ? COLORS.success : COLORS.danger;
  doc.setFillColor(...resultColor);
  doc.roundedRect(15, y, pageWidth - 30, 22, 3, 3, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("RESULTADO NETO (USD):", 25, y + 14);
  doc.setFontSize(15);
  doc.text(formatUSD(netResult), pageWidth - 25, y + 14, { align: "right" });

  y += 32;

  // ── Resumen de nómina del período ──────────────────────────────────────────
  y = addSection(doc, y, "Resumen de Nómina del Período");

  const staffByPosition = staff.reduce((acc, s) => {
    if (s.status === "active") {
      acc[s.position] = (acc[s.position] || 0) + 1;
    }
    return acc;
  }, {});

  const staffData = Object.entries(staffByPosition).map(([position, count]) => [
    position,
    count,
    formatCurrency(
      staff
        .filter((s) => s.position === position && s.status === "active")
        .reduce((sum, s) => sum + (parseFloat(s.salary) || 0), 0)
    ),
  ]);

  if (staffData.length === 0) staffData.push(["Sin personal activo", "0", formatCurrency(0)]);

  doc.autoTable({
    startY: y,
    head: [["Cargo", "Cantidad", "Costo Mensual Estimado (Bs)"]],
    body: staffData,
    theme: "grid",
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: COLORS.foreground },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
    margin: { left: 15, right: 15 },
    styles: { lineColor: COLORS.muted, lineWidth: 0.1 },
  });

  y = doc.lastAutoTable.finalY + 15;

  // ── Nómina pagada en el período ────────────────────────────────────────────
  if (payments.length > 0) {
    y = addSection(doc, y, "Detalle de Nómina Pagada");

    const payrollData = payments
      .filter((p) => p.status === "paid")
      .map((p) => [
        p.staff ? `${p.staff.first_name} ${p.staff.last_name}` : "—",
        p.staff?.position || "—",
        formatDate(p.payment_date),
        formatCurrency(parseFloat(p.total_amount) || 0),
      ]);

    if (payrollData.length > 0) {
      doc.autoTable({
        startY: y,
        head: [["Empleado", "Cargo", "Fecha Pago", "Monto (Bs)"]],
        body: payrollData,
        theme: "grid",
        headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: COLORS.foreground },
        alternateRowStyles: { fillColor: COLORS.light },
        foot: [["", "", "TOTAL", formatCurrency(totalPayroll)]],
        footStyles: { fillColor: COLORS.secondary, textColor: COLORS.primaryDark, fontStyle: "bold", fontSize: 8 },
        columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 },
        styles: { lineColor: COLORS.muted, lineWidth: 0.1 },
      });
      y = doc.lastAutoTable.finalY + 15;
    }
  }

  // ── Gastos por categoría ───────────────────────────────────────────────────
  y = addSection(doc, y, "Gastos por Categoría");

  const expensesByCategory = expenses
    .filter((e) => e.status === "paid")
    .reduce((acc, e) => {
      const cat = e.category || "Sin categoría";
      acc[cat] = (acc[cat] || 0) + (parseFloat(e.amount) || 0);
      return acc;
    }, {});

  const expensesData = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => [category, formatCurrency(amount)]);

  if (expensesData.length === 0) expensesData.push(["Sin gastos en el período", formatCurrency(0)]);

  doc.autoTable({
    startY: y,
    head: [["Categoría", "Monto (Bs)"]],
    body: expensesData,
    theme: "grid",
    headStyles: { fillColor: COLORS.danger, textColor: COLORS.white, fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: COLORS.foreground },
    alternateRowStyles: { fillColor: COLORS.light },
    foot: [["TOTAL", formatCurrency(totalExpenses)]],
    footStyles: { fillColor: COLORS.secondary, textColor: COLORS.primaryDark, fontStyle: "bold", fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 15, right: 15 },
    styles: { lineColor: COLORS.muted, lineWidth: 0.1 },
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) { doc.setPage(i); addFooter(doc, i, totalPages); }
  return doc;
};

/**
 * Generar reporte de consolidación de ingresos (membresías de clientes)
 * Incluye TODOS los pagos desde el inicio del sistema, agrupados por mes/año.
 */
export const generateIncomeReport = async (payments, options = {}) => {
  const doc = createBasePDF("landscape");
  const period = options.period || "Histórico completo";
  let y = await addHeader(doc, "Consolidado de Ingresos", period);

  const pageWidth = doc.internal.pageSize.getWidth();

  const PAYMENT_TYPE_LABELS = {
    pago_movil:        "Pago Móvil",
    transferencia:     "Transferencia",
    punto_de_venta:    "Punto de Venta",
    efectivo_dolares:  "Efectivo USD",
    efectivo_bolivares:"Efectivo Bs",
  };

  const formatUSD = (v) => `$${(v || 0).toFixed(2)}`;
  const formatBs  = (v) => `Bs ${(v || 0).toFixed(2)}`;

  // ── Totales globales ───────────────────────────────────────────────────────
  const totalUSD = payments.reduce((s, p) => s + (parseFloat(p.amount_usd) || 0), 0);
  const totalBs  = payments.reduce((s, p) => s + (parseFloat(p.amount_bs)  || 0), 0);

  // ── Agrupación por mes/año (orden cronológico) ─────────────────────────────
  const byMonth = {};
  payments.forEach((p) => {
    const d = new Date(p.payment_date + "T00:00:00"); // evitar offset UTC
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) {
      byMonth[key] = {
        label: d.toLocaleDateString("es-VE", { month: "long", year: "numeric" }),
        count: 0,
        usd: 0,
        bs: 0,
      };
    }
    byMonth[key].count += 1;
    byMonth[key].usd   += parseFloat(p.amount_usd) || 0;
    byMonth[key].bs    += parseFloat(p.amount_bs)  || 0;
  });

  const monthKeys = Object.keys(byMonth).sort();

  // ── Agrupación por método de pago ──────────────────────────────────────────
  const byType = {};
  payments.forEach((p) => {
    const lbl = PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type || "Otro";
    if (!byType[lbl]) byType[lbl] = { count: 0, usd: 0 };
    byType[lbl].count += 1;
    byType[lbl].usd   += parseFloat(p.amount_usd) || 0;
  });

  // ── Agrupación por plan ────────────────────────────────────────────────────
  const byPlan = {};
  payments.forEach((p) => {
    const lbl = p.plans?.name || "Sin plan";
    if (!byPlan[lbl]) byPlan[lbl] = { count: 0, usd: 0 };
    byPlan[lbl].count += 1;
    byPlan[lbl].usd   += parseFloat(p.amount_usd) || 0;
  });

  // ── Tarjetas de resumen ────────────────────────────────────────────────────
  const cardWidth = (pageWidth - 60) / 4;
  addStatCard(doc, 15,                        y, cardWidth, "Total Transacciones", payments.length,                                           COLORS.primary);
  addStatCard(doc, 15 + (cardWidth + 10),     y, cardWidth, "Total USD",           formatUSD(totalUSD),                                       COLORS.success);
  addStatCard(doc, 15 + (cardWidth + 10) * 2, y, cardWidth, "Total Bs",            formatBs(totalBs),                                         COLORS.primaryDark);
  addStatCard(doc, 15 + (cardWidth + 10) * 3, y, cardWidth, "Meses con ingresos",  monthKeys.length,                                          COLORS.muted);

  y += 35;

  // ══════════════════════════════════════════════════════════════════════════
  // SECCIÓN 1 — RESUMEN POR MES / AÑO
  // ══════════════════════════════════════════════════════════════════════════
  y = addSection(doc, y, "Resumen por Mes / Año");

  const monthTableData = monthKeys.map((k) => {
    const m = byMonth[k];
    const pct = totalUSD > 0 ? ((m.usd / totalUSD) * 100).toFixed(1) : "0.0";
    return [
      // Capitalizar primera letra del mes
      m.label.charAt(0).toUpperCase() + m.label.slice(1),
      m.count.toString(),
      formatUSD(m.usd),
      formatBs(m.bs),
      `${pct}%`,
    ];
  });

  // Fila de totales
  monthTableData.push([
    "TOTAL GENERAL",
    payments.length.toString(),
    formatUSD(totalUSD),
    formatBs(totalBs),
    "100%",
  ]);

  doc.autoTable({
    startY: y,
    head: [["Mes / Año", "N° Pagos", "Total USD", "Total Bs", "% del Total"]],
    body: monthTableData,
    theme: "grid",
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8, textColor: COLORS.foreground },
    alternateRowStyles: { fillColor: COLORS.light },
    foot: [],
    didParseCell: (data) => {
      // Resaltar fila de totales
      if (data.row.index === monthTableData.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = COLORS.secondary;
        data.cell.styles.textColor = COLORS.primaryDark;
      }
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55 },
      1: { halign: "center" },
      2: { halign: "right", fontStyle: "bold" },
      3: { halign: "right" },
      4: { halign: "center" },
    },
    margin: { left: 15, right: pageWidth / 2 + 5 },
    styles: { lineColor: COLORS.muted, lineWidth: 0.1 },
    tableWidth: pageWidth / 2 - 25,
  });

  // ── Métodos de pago (columna derecha) ──────────────────────────────────────
  const typeTableY = y;
  const typeData = Object.entries(byType)
    .sort((a, b) => b[1].usd - a[1].usd)
    .map(([lbl, v]) => [
      lbl,
      v.count.toString(),
      formatUSD(v.usd),
      totalUSD > 0 ? `${((v.usd / totalUSD) * 100).toFixed(1)}%` : "0%",
    ]);

  doc.autoTable({
    startY: typeTableY,
    head: [["Método de Pago", "N°", "Total USD", "%"]],
    body: typeData,
    theme: "grid",
    headStyles: {
      fillColor: COLORS.primaryDark,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8, textColor: COLORS.foreground },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      2: { halign: "right" },
      3: { halign: "center" },
    },
    margin: { left: pageWidth / 2 + 5, right: 15 },
    styles: { lineColor: COLORS.muted, lineWidth: 0.1 },
    tableWidth: pageWidth / 2 - 25,
  });

  y = doc.lastAutoTable.finalY + 15;

  // ── Resumen por plan (tabla estrecha, nueva fila) ──────────────────────────
  y = addSection(doc, y, "Resumen por Plan / Membresía");

  const planData = Object.entries(byPlan)
    .sort((a, b) => b[1].usd - a[1].usd)
    .map(([lbl, v]) => [
      lbl,
      v.count.toString(),
      formatUSD(v.usd),
      totalUSD > 0 ? `${((v.usd / totalUSD) * 100).toFixed(1)}%` : "0%",
    ]);

  doc.autoTable({
    startY: y,
    head: [["Plan / Membresía", "N° Pagos", "Total USD", "% del Total"]],
    body: planData,
    theme: "grid",
    headStyles: {
      fillColor: COLORS.primaryDark,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8, textColor: COLORS.foreground },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      2: { halign: "right", fontStyle: "bold" },
      3: { halign: "center" },
    },
    margin: { left: 15, right: 15 },
    styles: { lineColor: COLORS.muted, lineWidth: 0.1 },
  });

  y = doc.lastAutoTable.finalY + 15;

  // ══════════════════════════════════════════════════════════════════════════
  // SECCIÓN 2 — DETALLE COMPLETO (una fila por pago, ordenado fecha ASC)
  // ══════════════════════════════════════════════════════════════════════════
  y = addSection(doc, y, "Detalle Completo de Pagos");

  const detailData = payments.map((p, idx) => [
    (idx + 1).toString(),
    formatDate(p.payment_date),
    p.clients
      ? `${p.clients.first_name} ${p.clients.last_name}`
      : "—",
    p.clients?.cedula || "—",
    p.plans?.name || "—",
    PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type || "—",
    p.bank || "—",
    p.reference || "—",
    formatUSD(parseFloat(p.amount_usd) || 0),
    formatBs(parseFloat(p.amount_bs) || 0),
  ]);

  doc.autoTable({
    startY: y,
    head: [[
      "#", "Fecha", "Cliente", "Cédula", "Plan",
      "Método", "Banco", "Referencia", "Monto USD", "Monto Bs",
    ]],
    body: detailData,
    theme: "striped",
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 7,
    },
    bodyStyles: { fontSize: 6.5, textColor: COLORS.foreground },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0:  { halign: "center", cellWidth: 8 },
      1:  { cellWidth: 20 },
      2:  { fontStyle: "bold", cellWidth: 38 },
      3:  { cellWidth: 22 },
      4:  { cellWidth: 28 },
      5:  { cellWidth: 28 },
      6:  { cellWidth: 22 },
      7:  { cellWidth: 26 },
      8:  { halign: "right", fontStyle: "bold", cellWidth: 22 },
      9:  { halign: "right", cellWidth: 26 },
    },
    margin: { left: 15, right: 15 },
    styles: { lineColor: COLORS.muted, lineWidth: 0.1, overflow: "ellipsize" },
    // Fila de gran total al final de la tabla
    foot: [[
      "", "TOTAL", "", "", "",
      "", "", "",
      formatUSD(totalUSD),
      formatBs(totalBs),
    ]],
    footStyles: {
      fillColor: COLORS.secondary,
      textColor: COLORS.primaryDark,
      fontStyle: "bold",
      fontSize: 7,
    },
  });

  // ── Caja de gran total ─────────────────────────────────────────────────────
  const finalY = doc.lastAutoTable.finalY + 6;
  const boxWidth = 130;
  doc.setFillColor(...COLORS.secondary);
  doc.roundedRect(pageWidth - boxWidth - 15, finalY, boxWidth, 28, 3, 3, "F");
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(pageWidth - boxWidth - 15, finalY, 4, 28, 2, 2, "F");

  doc.setTextColor(...COLORS.primaryDark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL HISTÓRICO USD:", pageWidth - boxWidth - 8, finalY + 10);
  doc.setFontSize(13);
  doc.text(formatUSD(totalUSD), pageWidth - 18, finalY + 10, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Total Bs:", pageWidth - boxWidth - 8, finalY + 21);
  doc.setFont("helvetica", "bold");
  doc.text(formatBs(totalBs), pageWidth - 18, finalY + 21, { align: "right" });

  // ── Pies de página ─────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  return doc;
};

/**
 * Generar recibo de pago individual
 */
export const generatePaymentReceipt = async (payment, staffMember) => {
  const doc = createBasePDF("portrait");
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header especial para recibo con colores del tema
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 50, "F");
  
  // Patrón decorativo
  doc.setFillColor(...COLORS.primaryDark);
  doc.rect(0, 45, pageWidth, 5, "F");
  
  // Acento con Tea Green
  doc.setFillColor(...COLORS.secondary);
  doc.rect(0, 50, pageWidth, 3, "F");
  
  // Cargar logo
  const logoData = await loadLogoForPDF();
  
  if (logoData) {
    try {
      // Logo centrado con proporción correcta
      const logoDims = getLogoDimensions(70); // Un poco más grande para el recibo
      const logoX = (pageWidth - logoDims.width) / 2;
      const logoY = 8;
      doc.addImage(logoData, "PNG", logoX, logoY, logoDims.width, logoDims.height);
    } catch {
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("VitaliaGym", pageWidth / 2, 22, { align: "center" });
    }
  } else {
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("VitaliaGym", pageWidth / 2, 22, { align: "center" });
  }
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);
  doc.text("RECIBO DE PAGO", pageWidth / 2, 38, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`N° ${payment.id.substring(0, 8).toUpperCase()}`, pageWidth / 2, 48, { align: "center" });
  
  let y = 65;
  
  // Información del empleado
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(15, y, pageWidth - 30, 50, 4, 4, "F");
  
  // Borde superior con color
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(15, y, pageWidth - 30, 4, 4, 4, "F");
  doc.rect(15, y + 2, pageWidth - 30, 2, "F");
  
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL EMPLEADO", 25, y + 15);
  
  doc.setTextColor(...COLORS.foreground);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 25;
  
  doc.setFont("helvetica", "bold");
  doc.text("Nombre:", 25, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${staffMember.first_name} ${staffMember.last_name}`, 55, y);
  
  doc.setFont("helvetica", "bold");
  doc.text("Cargo:", pageWidth / 2, y);
  doc.setFont("helvetica", "normal");
  doc.text(staffMember.position, pageWidth / 2 + 25, y);
  
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Cédula:", 25, y);
  doc.setFont("helvetica", "normal");
  doc.text(staffMember.document_id || "N/A", 55, y);
  
  doc.setFont("helvetica", "bold");
  doc.text("Email:", pageWidth / 2, y);
  doc.setFont("helvetica", "normal");
  doc.text(staffMember.email, pageWidth / 2 + 25, y);
  
  y += 25;
  
  // Información del pago
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(15, y, pageWidth - 30, 85, 4, 4, "F");
  
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(15, y, pageWidth - 30, 4, 4, 4, "F");
  doc.rect(15, y + 2, pageWidth - 30, 2, "F");
  
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DETALLE DEL PAGO", 25, y + 15);
  
  doc.setTextColor(...COLORS.foreground);
  doc.setFontSize(10);
  
  const detailY = y + 28;
  const leftCol = 25;
  const rightCol = pageWidth - 25;
  
  doc.setFont("helvetica", "normal");
  doc.text("Período:", leftCol, detailY);
  doc.setFont("helvetica", "bold");
  doc.text(`${formatDate(payment.period_start)} - ${formatDate(payment.period_end)}`, rightCol, detailY, { align: "right" });
  
  doc.setFont("helvetica", "normal");
  doc.text("Fecha de Pago:", leftCol, detailY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(formatDate(payment.payment_date), rightCol, detailY + 10, { align: "right" });
  
  // Línea separadora
  doc.setDrawColor(...COLORS.secondary);
  doc.setLineWidth(0.5);
  doc.line(25, detailY + 18, pageWidth - 25, detailY + 18);
  
  doc.setFont("helvetica", "normal");
  doc.text("Salario Base:", leftCol, detailY + 28);
  doc.text(formatCurrency(payment.base_amount), rightCol, detailY + 28, { align: "right" });
  
  doc.setTextColor(...COLORS.success);
  doc.text("Bonificaciones:", leftCol, detailY + 38);
  doc.text(`+${formatCurrency(payment.bonus || 0)}`, rightCol, detailY + 38, { align: "right" });
  
  doc.setTextColor(...COLORS.danger);
  doc.text("Deducciones:", leftCol, detailY + 48);
  doc.text(`-${formatCurrency(payment.deductions || 0)}`, rightCol, detailY + 48, { align: "right" });
  
  y += 95;
  
  // Total
  doc.setFillColor(...COLORS.success);
  doc.roundedRect(15, y, pageWidth - 30, 28, 4, 4, "F");
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL A PAGAR:", 25, y + 18);
  doc.setFontSize(20);
  doc.text(formatCurrency(payment.total_amount), pageWidth - 25, y + 18, { align: "right" });
  
  y += 40;
  
  // Método de pago
  doc.setFillColor(...COLORS.secondary);
  doc.roundedRect(15, y, pageWidth - 30, 25, 4, 4, "F");
  
  doc.setTextColor(...COLORS.primaryDark);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const methodLabels = {
    cash: "Efectivo",
    transfer: "Transferencia Bancaria",
    check: "Cheque",
    mobile_payment: "Pago Móvil",
  };
  
  doc.text(`Método de Pago: ${methodLabels[payment.payment_method] || payment.payment_method}`, 25, y + 10);
  if (payment.payment_reference) {
    doc.text(`Referencia: ${payment.payment_reference}`, 25, y + 18);
  }
  
  y += 40;
  
  // Firmas
  doc.setDrawColor(...COLORS.foreground);
  doc.setLineWidth(0.5);
  doc.line(25, y + 20, 90, y + 20);
  doc.line(pageWidth - 90, y + 20, pageWidth - 25, y + 20);
  
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(9);
  doc.text("Firma del Empleado", 57.5, y + 28, { align: "center" });
  doc.text("Firma Autorizada", pageWidth - 57.5, y + 28, { align: "center" });
  
  // Notas
  if (payment.notes) {
    y += 45;
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Notas: ${payment.notes}`, 25, y);
  }
  
  // Footer
  addFooter(doc, 1, 1);
  
  return doc;
};

/**
 * Descargar PDF
 */
export const downloadPDF = (doc, filename) => {
  doc.save(`${filename}_${new Date().toISOString().split("T")[0]}.pdf`);
};

/**
 * Abrir PDF en nueva pestaña
 */
export const openPDF = (doc) => {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
};
