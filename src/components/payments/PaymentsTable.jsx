import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePayments } from "../../hooks/usePayments";
import { useClients } from "../../hooks/useClients";
import { usePlans } from "../../hooks/usePlans";
import { useExchangeRate } from "../../hooks/useExchangeRate";
import {
  VENEZUELAN_BANKS,
  PHONE_OPERATORS,
  formatPhone,
  parsePhone,
} from "../../lib/venezuelanData";
import { toast } from "sonner";
import {
  Loader2,
  Phone,
  CreditCard,
  RefreshCw,
  Settings2,
  CalendarClock,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  EditIcon,
  TrashIcon,
  SearchIcon,
  FilterXIcon,
  DollarSignIcon,
} from "../ui/icons";
import { TruncatedCell } from "../ui/truncated-cell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SearchableSelect } from "../ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Pagination, usePagination } from "../ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ConfirmDialog } from "../ui/confirm-dialog";

// Improved debounce function with cancellation support
function debounce(func, delay) {
  let timeout;
  let cancelled = false;

  const debounced = function (...args) {
    const context = this;
    clearTimeout(timeout);

    if (cancelled) {
      cancelled = false;
      return;
    }

    timeout = setTimeout(() => {
      if (!cancelled) {
        func.apply(context, args);
      }
    }, delay);
  };

  debounced.cancel = () => {
    clearTimeout(timeout);
    cancelled = true;
  };

  return debounced;
}

export function PaymentsTable({
  preselectedClient = null,
  payRemaining = false,
  remainingAmount = null,
  paymentId = null,
}) {
  const {
    payments,
    loading,
    error,
    refetch,
    createPayment,
    updatePayment,
    deletePayment,
    recalculateAllNextPaymentDates,
  } = usePayments();

  const { clients, loading: clientsLoading } = useClients();
  const { plans, loading: plansLoading } = usePlans();
  const {
    rate,
    formatMultiCurrency,
    formatCurrency,
    loading: rateLoading,
  } = useExchangeRate();

  // Estados del modal unificado para crear/editar
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentMode, setPaymentMode] = useState("full"); // "full" o "partial"

  const [formData, setFormData] = useState({
    client_id: preselectedClient?.id || "",
    plan_id: "",
    amount_usd: "",
    amount_bs: "",
    exchange_rate: rate || 1,
    payment_date: new Date().toISOString().split("T")[0],
    reference: "",
    bank: "",
    payment_type: "pago_movil",
    phone_operator: "0414",
    phone_payment: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partialValidationError, setPartialValidationError] = useState("");

  // Estados para modo de pago restante
  const [isPayingRemaining, setIsPayingRemaining] = useState(false);
  const [remainingPaymentData, setRemainingPaymentData] = useState(null);

  // Estado para eliminación
  const [deletingId, setDeletingId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    payment: null,
  });

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedPaymentType, setSelectedPaymentType] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [displayPayments, setDisplayPayments] = useState([]);
  const [isFiltering, setIsFiltering] = useState(false);

  // Estados para paginación
  const {
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    resetPage,
    paginateData,
  } = usePagination(10);

  // Efecto para abrir modal automáticamente cuando viene desde vista de clientes
  useEffect(() => {
    // Solo procesar si hay un cliente preseleccionado y los planes ya cargaron
    if (!preselectedClient || plansLoading || plans.length === 0) return;

    // Si es modo pago restante
    if (payRemaining && remainingAmount && paymentId) {
      const clientPlan = plans.find((p) => p.id === preselectedClient.plan_id);

      if (clientPlan) {
        // Configurar modo de pago restante
        setPaymentMode("partial");
        setIsPayingRemaining(true);

        // Precargar formulario con los datos del pago restante
        setFormData({
          client_id: preselectedClient.id,
          plan_id: preselectedClient.plan_id,
          amount_usd: remainingAmount,
          amount_bs: (parseFloat(remainingAmount) * (rate || 1)).toFixed(2),
          exchange_rate: rate || 1,
          payment_date: new Date().toISOString().split("T")[0],
          reference: "",
          bank: "",
          payment_type: "pago_movil",
          phone_operator: "0414",
          phone_payment: "",
        });

        // Configurar datos del pago restante para visualización
        setRemainingPaymentData({
          client_id: preselectedClient.id,
          client_name: `${preselectedClient.first_name} ${preselectedClient.last_name}`,
          plan_id: preselectedClient.plan_id,
          plan_name: clientPlan.name,
          remaining_amount: parseFloat(remainingAmount),
          plan_price: parseFloat(clientPlan.price),
          total_paid:
            parseFloat(clientPlan.price) - parseFloat(remainingAmount),
        });

        // Abrir el modal
        setIsDialogOpen(true);
      }
    } else {
      // Modo normal: solo preseleccionar cliente y abrir modal
      const clientPlan = plans.find((p) => p.id === preselectedClient.plan_id);
      const planPrice = clientPlan ? parseFloat(clientPlan.price) || 0 : 0;

      setFormData({
        client_id: preselectedClient.id,
        plan_id: preselectedClient.plan_id || "",
        amount_usd: planPrice > 0 ? planPrice.toFixed(2) : "",
        amount_bs: planPrice > 0 ? (planPrice * (rate || 1)).toFixed(2) : "",
        exchange_rate: rate || 1,
        payment_date: new Date().toISOString().split("T")[0],
        reference: "",
        bank: "",
        payment_type: "pago_movil",
        phone_operator: "0414",
        phone_payment: "",
      });

      setPaymentMode("full");
      setIsPayingRemaining(false);
      setIsEditing(false);
      setSelectedPayment(null);

      // Abrir el modal automáticamente
      setIsDialogOpen(true);
    }
  }, [
    payRemaining,
    preselectedClient,
    remainingAmount,
    paymentId,
    plans,
    plansLoading,
    rate,
  ]);

  // Obtener el precio del plan seleccionado
  const getPlanPrice = useCallback(
    (planId) => {
      const plan = plans.find((p) => p.id === planId);
      return plan ? parseFloat(plan.price) || 0 : 0;
    },
    [plans],
  );

  // Memo para calcular el restante y precio del plan actual de forma segura
  const currentPaymentInfo = useMemo(() => {
    if (isDialogOpen && formData.plan_id) {
      const planPrice = getPlanPrice(formData.plan_id);

      // Si hay un cliente seleccionado, podemos verificar pagos anteriores.
      if (formData.client_id) {
        const allClientPayments = payments.filter(
          (p) =>
            p.client_id === formData.client_id &&
            p.plan_id === formData.plan_id,
        );

        const totalPaid = allClientPayments.reduce(
          (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
          0,
        );

        if (planPrice > 0) {
          let paidForCurrentCycle = totalPaid % planPrice;

          // Si el módulo es casi cero y se ha pagado, significa que se completó un ciclo.
          if (paidForCurrentCycle < 0.001 && totalPaid > 0) {
            paidForCurrentCycle = planPrice;
          }

          const remainingAmount = planPrice - paidForCurrentCycle;

          // Si se está pagando restante, se muestra lo que falta.
          // Si no, y lo que falta es cero (ciclo completo), se propone el precio completo para un nuevo ciclo.
          return {
            planPrice,
            totalPaid,
            remainingAmount:
              remainingAmount < 0.001 && !isPayingRemaining
                ? planPrice
                : remainingAmount,
          };
        }
      }

      // Para un pago nuevo sin cliente seleccionado, o si el plan no tiene precio.
      return {
        planPrice,
        totalPaid: 0,
        remainingAmount: planPrice,
      };
    }
    return { planPrice: 0, totalPaid: 0, remainingAmount: 0 };
  }, [
    isDialogOpen,
    formData.client_id,
    formData.plan_id,
    payments,
    isPayingRemaining,
    getPlanPrice,
  ]);

  // Calcular pago restante (para formularios)
  const calculateRemainingAmount = (planId, currentAmount) => {
    const planPrice = getPlanPrice(planId);
    const amount = parseFloat(currentAmount || 0) || 0;
    const remaining = Math.max(0, planPrice - amount);

    return {
      amount: remaining,
      isOverpaid: amount > planPrice,
      formattedAmount: remaining.toFixed(2),
    };
  };

  // Calcular pago restante DESPUÉS del monto actual (para campo informativo)
  const calculateRemainingAfterCurrentAmount = (planId, currentAmount) => {
    const planPrice = getPlanPrice(planId);
    const amount = parseFloat(currentAmount || 0) || 0;
    let totalPaidSoFar = 0;

    // Solo sumar pagos existentes si estamos pagando un restante.
    if (isPayingRemaining) {
      const allClientPayments = payments.filter(
        (p) => p.client_id === formData.client_id && p.plan_id === planId,
      );
      totalPaidSoFar = allClientPayments.reduce(
        (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
        0,
      );
    }

    // Calcular lo que quedaría DESPUÉS de agregar el monto actual
    const remainingAfterCurrentPayment = Math.max(
      0,
      planPrice - (totalPaidSoFar + amount),
    );

    return {
      amount: remainingAfterCurrentPayment,
      isOverpaid: amount > planPrice,
      formattedAmount: remainingAfterCurrentPayment.toFixed(2),
    };
  };

  // Obtener pagos anteriores de un cliente para un plan específico
  const getPreviousPayments = (clientId, planId) => {
    const clientPayments = payments.filter(
      (p) => p.client_id === clientId && p.plan_id === planId,
    );
    const totalPaid = clientPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0,
    );
    return totalPaid;
  };

  // Calcular total pagado y restante para un cliente-plan
  const calculatePaymentStatus = (payment) => {
    const planPrice = getPlanPrice(payment.plan_id);
    if (planPrice <= 0) {
      return {
        planPrice: 0,
        totalPaid: 0,
        currentPayment: parseFloat(payment.amount_usd) || 0,
        remaining: 0,
        isFullyPaid: true,
        remainingFormatted: "0.00",
      };
    }

    // Obtener todos los pagos del cliente para este plan
    const allClientPayments = payments.filter(
      (p) => p.client_id === payment.client_id && p.plan_id === payment.plan_id,
    );

    // Calcular el total pagado hasta ahora
    const totalPaidSoFar = allClientPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0,
    );

    // Lógica para manejar renovaciones/ciclos de pago
    let paidForCurrentCycle = totalPaidSoFar % planPrice;

    // Si el módulo es 0 (o muy cercano) y se ha pagado algo, significa que se completó un ciclo.
    if (paidForCurrentCycle < 0.001 && totalPaidSoFar > 0) {
      paidForCurrentCycle = planPrice;
    }

    const currentRemaining = planPrice - paidForCurrentCycle;
    const isFullyPaid = currentRemaining < 0.001;

    return {
      planPrice,
      totalPaid: totalPaidSoFar,
      currentPayment: parseFloat(payment.amount_usd) || 0,
      remaining: isFullyPaid ? 0 : currentRemaining,
      isFullyPaid: isFullyPaid,
      remainingFormatted: (isFullyPaid ? 0 : currentRemaining).toFixed(2),
    };
  };

  // Calcular pago restante EXCLUYENDO el pago actual (para el botón "Pagar Restante")
  const calculateRemainingForNewPayment = (payment) => {
    const planPrice = getPlanPrice(payment.plan_id);

    // Obtener todos los pagos ANTERIORES del cliente para este plan (excluyendo el actual)
    const previousPayments = payments.filter(
      (p) =>
        p.client_id === payment.client_id &&
        p.plan_id === payment.plan_id &&
        p.id !== payment.id, // Excluir el pago actual
    );

    // Calcular el total pagado ANTES del pago actual
    const totalPaidBefore = previousPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0,
    );

    // Calcular el restante ANTES de hacer un nuevo pago
    const remainingForNewPayment = Math.max(0, planPrice - totalPaidBefore);

    return {
      planPrice,
      totalPaid: totalPaidBefore,
      remaining: remainingForNewPayment,
      isFullyPaid: remainingForNewPayment === 0,
      remainingFormatted: remainingForNewPayment.toFixed(2),
    };
  };

  // Calcular el total pagado por un cliente-plan (TODOS los pagos)
  const calculateTotalPaidByClientPlan = (clientId, planId) => {
    const allClientPayments = payments.filter(
      (p) => p.client_id === clientId && p.plan_id === planId,
    );

    return allClientPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0,
    );
  };

  // Calcular el total pagado por un cliente-plan (TODOS los pagos incluido el actual)

  // Actualizar amount_bs cuando cambia amount_usd o la tasa
  useEffect(() => {
    if (formData.amount_usd && rate) {
      setFormData((prev) => ({
        ...prev,
        amount_bs: (parseFloat(formData.amount_usd) * rate).toFixed(2),
        exchange_rate: rate,
      }));
    } else if (!formData.amount_usd) {
      setFormData((prev) => ({
        ...prev,
        amount_bs: "",
      }));
    }
  }, [formData.amount_usd, rate]);

  // Efecto unificado para auto-cargar el monto al cambiar cliente, plan o modo de pago
  useEffect(() => {
    if (
      isDialogOpen &&
      !isEditing &&
      formData.plan_id &&
      paymentMode === "full"
    ) {
      const amountToPay = currentPaymentInfo.remainingAmount;
      setFormData((prev) => ({
        ...prev,
        amount_usd: amountToPay > 0 ? amountToPay.toString() : "0",
        amount_bs:
          amountToPay > 0 ? (amountToPay * (rate || 1)).toFixed(2) : "0.00",
      }));
    }
  }, [
    isDialogOpen,
    isEditing,
    formData.client_id,
    formData.plan_id,
    paymentMode,
    currentPaymentInfo.remainingAmount,
    rate,
  ]);

  // Validar monto parcial en tiempo real
  useEffect(() => {
    if (paymentMode === "partial" && formData.plan_id && formData.amount_usd) {
      const planPrice = getPlanPrice(formData.plan_id);
      const amount = parseFloat(formData.amount_usd);

      if (amount > planPrice) {
        setPartialValidationError(
          `El monto no puede ser mayor al precio del plan ($${planPrice.toFixed(
            2,
          )})`,
        );
      } else if (amount <= 0) {
        setPartialValidationError("El monto debe ser mayor a 0");
      } else {
        setPartialValidationError("");
      }
    } else {
      setPartialValidationError("");
    }
  }, [formData.amount_usd, formData.plan_id, paymentMode]);

  // Lógica de filtrado local memorizada para evitar ciclo infinito
  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      // Filtrar por término de búsqueda (nombre, apellido o cédula del cliente)
      const matchesSearch =
        searchTerm === "" ||
        payment.clients?.first_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        payment.clients?.last_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        payment.clients?.cedula
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      // Filtrar por plan
      const matchesPlan =
        selectedPlan === "" || payment.plan_id === selectedPlan;

      // Filtrar por tipo de pago
      const matchesPaymentType =
        selectedPaymentType === "" ||
        payment.payment_type === selectedPaymentType;

      // Filtrar por banco
      const matchesBank = selectedBank === "" || payment.bank === selectedBank;

      // Filtrar por fecha desde
      let matchesDateFrom = true;
      if (dateFrom) {
        matchesDateFrom = new Date(payment.payment_date) >= new Date(dateFrom);
      }

      // Filtrar por fecha hasta
      let matchesDateTo = true;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDateTo = new Date(payment.payment_date) <= toDate;
      }

      return (
        matchesSearch &&
        matchesPlan &&
        matchesPaymentType &&
        matchesBank &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    payments,
    searchTerm,
    selectedPlan,
    selectedPaymentType,
    selectedBank,
    dateFrom,
    dateTo,
  ]);

  // Sincronizar displayPayments con filteredPayments
  useEffect(() => {
    setDisplayPayments(filteredPayments);
  }, [filteredPayments]);

  // Actualizar remainingPaymentData cuando cambia el cliente o plan en modo de creación
  useEffect(() => {
    if (isDialogOpen && !isEditing && formData.client_id && formData.plan_id) {
      // Calcular el restante actual
      const allClientPayments = payments.filter(
        (p) =>
          p.client_id === formData.client_id && p.plan_id === formData.plan_id,
      );
      const totalPaid = allClientPayments.reduce(
        (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
        0,
      );
      const planPrice = getPlanPrice(formData.plan_id);
      const remainingAmount = Math.max(0, planPrice - totalPaid);

      // Encontrar cliente y plan de forma segura para evitar re-renders
      const selectedClient = clients.find((c) => c.id === formData.client_id);
      const selectedPlanData = plans.find((p) => p.id === formData.plan_id);

      setRemainingPaymentData({
        client_id: formData.client_id,
        client_name: selectedClient
          ? `${selectedClient.first_name} ${selectedClient.last_name}`
          : "",
        plan_id: formData.plan_id,
        plan_name: selectedPlanData ? selectedPlanData.name : "",
        remaining_amount: remainingAmount,
        plan_price: planPrice,
        total_paid: totalPaid,
      });

      // Si el modo es "full" (pagar completo), cargar el monto del plan automáticamente
      // Solo si no hay un monto ya establecido por el usuario (para no sobreescribir)
      if (paymentMode === "full" && !formData.amount_usd) {
        setFormData((prev) => ({
          ...prev,
          amount_usd: currentPaymentInfo.planPrice.toString(),
          amount_bs: (currentPaymentInfo.planPrice * (rate || 1)).toFixed(2),
        }));
      }
    } else if (!isDialogOpen) {
      setRemainingPaymentData(null);
    }
  }, [
    isDialogOpen,
    isEditing,
    formData.client_id,
    formData.plan_id,
    paymentMode,
    payments,
    rate,
  ]);

  // Resetear formulario
  const resetForm = useCallback(() => {
    setFormData({
      client_id: preselectedClient?.id || "",
      plan_id: "",
      amount_usd: "",
      amount_bs: "",
      exchange_rate: rate || 1,
      payment_date: new Date().toISOString().split("T")[0],
      reference: "",
      bank: "",
      payment_type: "pago_movil",
      phone_operator: "0414",
      phone_payment: "",
    });
    setSelectedPayment(null);
    setIsEditing(false);
    setPaymentMode("full");
    setPartialValidationError("");
    setIsPayingRemaining(false);
    setRemainingPaymentData(null);
  }, [preselectedClient, rate]);

  // Abrir modal para crear
  const handleOpenCreateDialog = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  // Abrir modal para editar
  const handleOpenEditDialog = useCallback((payment) => {
    setSelectedPayment(payment);
    const isFullPayment =
      payment.amount_usd === parseFloat(payment.plans?.price || 0);
    setPaymentMode(isFullPayment ? "full" : "partial");
    // Parse phone to separate operator and number
    const { operator, number } = parsePhone(payment.phone_payment || "");
    setFormData({
      client_id: payment.client_id,
      plan_id: payment.plan_id,
      amount_usd: payment.amount_usd.toString(),
      amount_bs: payment.amount_bs.toString(),
      exchange_rate: payment.exchange_rate.toString(),
      payment_date: payment.payment_date,
      reference: payment.reference || "",
      bank: payment.bank || "",
      payment_type: payment.payment_type,
      phone_operator: operator,
      phone_payment: number,
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  }, []);

  // Cerrar modal
  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setTimeout(resetForm, 150);
  }, [resetForm]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Si estamos pagando restante, no permitir cambiar cliente o plan
    if (isPayingRemaining && (name === "client_id" || name === "plan_id")) {
      return;
    }

    // Máscara para teléfono de pago
    if (name === "phone_payment") {
      const cleanValue = value.replace(/\D/g, "").slice(0, 7);
      setFormData((prev) => ({
        ...prev,
        [name]: cleanValue,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePaymentModeChange = (mode) => {
    setPaymentMode(mode);
    setPartialValidationError("");

    if (mode === "partial" && formData.plan_id) {
      const amountToSuggest = currentPaymentInfo.remainingAmount;
      setFormData((prev) => ({
        ...prev,
        amount_usd: amountToSuggest > 0 ? amountToSuggest.toString() : "",
      }));
    }
  };

  // Enviar formulario (crear o editar)
  const handleSubmit = async () => {
    if (
      !formData.client_id ||
      !formData.plan_id ||
      !formData.amount_usd ||
      !formData.payment_type
    ) {
      toast.error(
        "Los campos de cliente, plan, monto y tipo de pago son obligatorios",
      );
      return;
    }

    // Validación adicional para pagos parciales
    if (paymentMode === "partial" && partialValidationError) {
      toast.error(partialValidationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentData = {
        ...formData,
        amount_usd: parseFloat(formData.amount_usd),
        amount_bs: parseFloat(formData.amount_bs),
        exchange_rate: parseFloat(formData.exchange_rate),
        phone_payment: formData.phone_payment
          ? formatPhone(formData.phone_operator, formData.phone_payment)
          : "",
      };
      // Remove phone_operator from payload as it's only for UI
      delete paymentData.phone_operator;

      let result;
      if (isEditing && selectedPayment) {
        result = await updatePayment(selectedPayment.id, paymentData);
      } else {
        result = await createPayment(paymentData);
      }

      if (result.success) {
        handleCloseDialog();

        // Mensaje de éxito personalizado si era pago restante
        if (isPayingRemaining && remainingPaymentData) {
          toast.success(
            `Pago restante de $${parseFloat(formData.amount_usd).toFixed(
              2,
            )} registrado exitosamente para ${remainingPaymentData.client_name}`,
          );
        } else {
          toast.success(
            isEditing
              ? "Pago actualizado exitosamente"
              : "Pago registrado exitosamente",
          );
        }
      } else {
        toast.error(
          `Error al ${isEditing ? "actualizar" : "registrar"} pago: ` +
            result.error,
        );
      }
    } catch (err) {
      console.error(
        `Error al ${isEditing ? "actualizar" : "registrar"} pago:`,
        err,
      );
      toast.error(
        `Error al ${isEditing ? "actualizar" : "registrar"} pago: ` +
          err.message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayRemaining = (payment) => {
    // Calcular el pago restante INCLUYENDO todos los pagos existentes
    const allClientPayments = payments.filter(
      (p) => p.client_id === payment.client_id && p.plan_id === payment.plan_id,
    );
    const totalPaid = allClientPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0,
    );
    const planPrice = getPlanPrice(payment.plan_id);
    const remainingAmount = Math.max(0, planPrice - totalPaid);

    const remainingStatus = {
      planPrice,
      totalPaid,
      remaining: remainingAmount,
      isFullyPaid: remainingAmount === 0,
      remainingFormatted: remainingAmount.toFixed(2),
    };

    setRemainingPaymentData({
      client_id: payment.client_id,
      client_name: `${payment.clients?.first_name} ${payment.clients?.last_name}`,
      plan_id: payment.plan_id,
      plan_name: payment.plans?.name,
      remaining_amount: remainingStatus.remaining,
      plan_price: remainingStatus.planPrice,
      total_paid: totalPaid, // Usar el cálculo correcto que incluye TODOS los pagos
    });

    // Abrir formulario de creación con los datos precargados
    const newFormData = {
      client_id: payment.client_id,
      plan_id: payment.plan_id,
      amount_usd: remainingStatus.remaining.toString(),
      amount_bs: (remainingStatus.remaining * (rate || 1)).toFixed(2),
      exchange_rate: (rate || 1).toString(),
      payment_date: new Date().toISOString().split("T")[0],
      reference: "",
      bank: "",
      payment_type: "pago_movil",
      phone_operator: "0414",
      phone_payment: "",
    };

    // Establecer modo "full" (pagar restante completo) por defecto
    setPaymentMode("full");
    setPartialValidationError("");
    setIsPayingRemaining(true);
    setIsDialogOpen(true);

    // Establecer el formData DESPUÉS de que el modo esté establecido
    setTimeout(() => {
      setFormData(newFormData);
    }, 50);

    toast.info(
      `Preparando pago restante de $${remainingStatus.remaining.toFixed(
        2,
      )} para ${payment.clients?.first_name} ${payment.clients?.last_name}`,
    );
  };

  const openDeleteDialog = (payment) => {
    setDeleteDialog({ open: true, payment });
  };

  const handleDeletePayment = async () => {
    if (!deleteDialog.payment) return;

    setDeletingId(deleteDialog.payment.id);
    try {
      const result = await deletePayment(deleteDialog.payment.id);
      if (result.success) {
        toast.success("Pago eliminado exitosamente");
        setDeleteDialog({ open: false, payment: null });
      } else {
        toast.error("Error al eliminar pago: " + result.error);
      }
    } catch (err) {
      console.error("Error deleting payment:", err);
      toast.error("Error al eliminar pago: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    // Parsear la fecha manualmente para evitar problemas de zona horaria
    const parts = dateString.split("-");
    const date = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    );
    return date.toLocaleDateString("es-ES");
  };

  const formatPaymentType = (type) => {
    const types = {
      pago_movil: "Pago Móvil",
      transferencia: "Transferencia",
      punto_de_venta: "Punto de Venta",
      efectivo_dolares: "Efectivo $",
    };
    return types[type] || type;
  };

  // Función para limpiar todos los filtros
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedPlan("");
    setSelectedPaymentType("");
    setSelectedBank("");
    setDateFrom("");
    setDateTo("");
    resetPage();
  };

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    resetPage();
  }, [
    searchTerm,
    selectedPlan,
    selectedPaymentType,
    selectedBank,
    dateFrom,
    dateTo,
    resetPage,
  ]);

  // Datos paginados
  const paginatedPayments = useMemo(() => {
    return paginateData(displayPayments);
  }, [displayPayments, paginateData]);

  const activeFiltersCount = [
    searchTerm,
    selectedPlan,
    selectedPaymentType,
    selectedBank,
    dateFrom,
    dateTo,
  ].filter((filter) => filter !== "").length;

  if (loading && displayPayments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
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
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
          <CreditCard
            className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
            aria-hidden="true"
          />
          <span>
            Pagos ({displayPayments.length}
            {activeFiltersCount > 0 ? ` de ${payments.length}` : ""})
          </span>
        </CardTitle>
        <div className="flex gap-2">
          <Button
            onClick={handleOpenCreateDialog}
            variant="default"
            size="sm"
            className="text-xs sm:text-sm"
          >
            <DollarSignIcon className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Nuevo Pago</span>
          </Button>
          <Button
            onClick={refetch}
            variant="outline"
            size="sm"
            disabled={loading}
            className="text-xs sm:text-sm"
            aria-label="Actualizar lista de pagos"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Actualizar</span>
              </>
            )}
          </Button>
          {/*           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Menu de mantenimiento">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mantenimiento</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => {
                toast.loading("Recalculando fechas de pago...");
                const res = await recalculateAllNextPaymentDates();
                toast.dismiss();
                if(res.success) {
                  toast.success(`Fechas recalculadas: ${res.updated} de ${res.total} clientes`);
                  // Refrescar la lista de pagos para ver los cambios reflejados
                  refetch();
                } else {
                  toast.error("Error al recalcular fechas: " + (res.errors?.[0] || "Error desconocido"));
                }
              }}>
                <CalendarClock className="mr-2 h-4 w-4" /> Recalcular Fechas de Pago
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> */}
        </div>
      </CardHeader>
      <CardContent>
        {/* Barra de búsqueda y filtros */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          {/* Barra de búsqueda */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por nombre o cédula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
              aria-label="Buscar por nombre del cliente o cédula"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              Filtros:
            </span>

            {/* Filtro por plan */}
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="px-2 sm:px-3 py-1 border rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filtrar por plan"
            >
              <option value="">Todos los planes</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>

            {/* Filtro por tipo de pago */}
            <Select
              value={selectedPaymentType || "all"}
              onValueChange={(value) =>
                setSelectedPaymentType(value === "all" ? "" : value)
              }
            >
              <SelectTrigger
                className="w-[130px] sm:w-[160px] text-xs sm:text-sm"
                aria-label="Filtrar por tipo de pago"
              >
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="pago_movil">Pago Móvil</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="punto_de_venta">Punto de Venta</SelectItem>
                <SelectItem value="efectivo_dolares">Efectivo $</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por banco (solo se muestra si se selecciona pago móvil o transferencia) */}
            {(selectedPaymentType === "pago_movil" ||
              selectedPaymentType === "transferencia" ||
              selectedPaymentType === "") && (
              <Select
                value={selectedBank || "all"}
                onValueChange={(value) =>
                  setSelectedBank(value === "all" ? "" : value)
                }
              >
                <SelectTrigger
                  className="w-[140px] sm:w-[200px] text-xs sm:text-sm"
                  aria-label="Filtrar por banco"
                >
                  <SelectValue placeholder="Todos los bancos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los bancos</SelectItem>
                  {VENEZUELAN_BANKS.map((bank) => (
                    <SelectItem
                      key={bank.code}
                      value={bank.name}
                      aria-label={`${bank.name} - Código ${bank.code}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          {bank.code}
                        </span>
                        <span>{bank.shortName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Filtros de fecha */}
            <div className="flex gap-2 items-center">
              <span className="text-xs sm:text-sm">Desde:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-1.5 sm:px-2 py-1 border rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Fecha desde"
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs sm:text-sm">Hasta:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-1.5 sm:px-2 py-1 border rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Fecha hasta"
              />
            </div>

            {/* Botón para limpiar filtros */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
              >
                <FilterXIcon className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">
                  Limpiar ({activeFiltersCount})
                </span>
                <span className="sm:hidden">({activeFiltersCount})</span>
              </Button>
            )}
          </div>

          {/* Indicador de resultados */}
          {activeFiltersCount > 0 && (
            <div className="text-sm text-muted-foreground">
              Mostrando {displayPayments.length} de {payments.length} pagos
            </div>
          )}
        </div>

        {/* Tabla de pagos */}
        {displayPayments.length === 0 && activeFiltersCount > 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No se encontraron pagos con los filtros aplicados
            </p>
            <Button onClick={clearFilters} variant="outline">
              Limpiar filtros
            </Button>
          </div>
        ) : displayPayments.length === 0 && payments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No hay pagos registrados
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <h4 className="font-semibold text-blue-900 mb-2">
                💰 Para empezar:
              </h4>
              <ol className="text-sm text-blue-800 text-left space-y-1">
                <li>Haz clic en + Nuevo Pago</li>
              </ol>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table aria-label="Lista de pagos del gimnasio">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Cédula
                    </TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>USD</TableHead>
                    <TableHead className="hidden md:table-cell">Bs</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Restante
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">Ref.</TableHead>
                    <TableHead className="hidden xl:table-cell">
                      Banco
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                    <TableHead className="hidden xl:table-cell">Tel.</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map((payment, index) => {
                    const paymentStatus = calculatePaymentStatus(payment);
                    const realIndex = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium text-center">
                          {realIndex}
                        </TableCell>
                        <TableCell>
                          <TruncatedCell
                            value={`${payment.clients?.first_name} ${payment.clients?.last_name}`}
                            maxWidth="120px"
                            className="font-medium"
                          />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell whitespace-nowrap">
                          {payment.clients?.cedula}
                        </TableCell>
                        <TableCell>
                          <TruncatedCell
                            value={payment.plans?.name || "N/A"}
                            maxWidth="100px"
                            className="font-medium"
                          />
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          ${(parseFloat(payment.amount_usd) || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {payment.payment_type === "efectivo_dolares" ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : rateLoading ? (
                            "..."
                          ) : (
                            <span className="text-green-600 whitespace-nowrap">
                              {formatCurrency(
                                parseFloat(payment.amount_bs) || 0,
                                "VES",
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span
                            className={`font-medium whitespace-nowrap ${
                              paymentStatus.isFullyPaid
                                ? "text-green-600"
                                : "text-orange-600"
                            }`}
                          >
                            ${paymentStatus.remainingFormatted}
                          </span>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell font-mono text-sm whitespace-nowrap">
                          {payment.reference || "N/A"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <TruncatedCell
                            value={payment.bank}
                            maxWidth="100px"
                            fallback="N/A"
                          />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                            {formatPaymentType(payment.payment_type)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell whitespace-nowrap">
                          {payment.phone_payment || "N/A"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(payment.payment_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handleOpenEditDialog(payment)}
                                  variant="outline"
                                  size="icon-sm"
                                >
                                  <EditIcon />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Editar pago</p>
                              </TooltipContent>
                            </Tooltip>

                            {/* Botón de pagar restante - solo si hay saldo pendiente */}
                            {!paymentStatus.isFullyPaid && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => handlePayRemaining(payment)}
                                    variant="default"
                                    size="icon-sm"
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <DollarSignIcon />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    Pagar restante ($
                                    {paymentStatus.remainingFormatted})
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => openDeleteDialog(payment)}
                                  variant="destructive"
                                  size="icon-sm"
                                  aria-label={`Eliminar pago de ${payment.clients?.first_name} ${payment.clients?.last_name}`}
                                >
                                  <TrashIcon />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Eliminar pago</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            <Pagination
              currentPage={currentPage}
              totalItems={displayPayments.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </CardContent>

      {/* Modal para crear/editar pago */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          aria-describedby="payment-form-description"
        >
          {/* Header fijo */}
          <DialogHeader className="flex-shrink-0 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />
              {isPayingRemaining
                ? "Completar Pago Pendiente"
                : isEditing
                  ? "Editar Pago"
                  : "Registrar Nuevo Pago"}
            </DialogTitle>
            <DialogDescription id="payment-form-description">
              {isPayingRemaining
                ? `Pagando el saldo restante de ${remainingPaymentData?.client_name}`
                : isEditing
                  ? "Modifica los datos del pago registrado."
                  : preselectedClient
                    ? `Registrando pago para ${preselectedClient.first_name} ${preselectedClient.last_name}`
                    : "Completa el formulario para registrar un nuevo pago."}
            </DialogDescription>
          </DialogHeader>

          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto py-4 px-1 -mx-1 scrollbar-thin">
            <div className="space-y-6">
              {/* Resumen de pago restante */}
              {isPayingRemaining && remainingPaymentData && (
                <div
                  className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg"
                  role="status"
                  aria-live="polite"
                >
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Resumen del Plan
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 bg-white dark:bg-blue-900/30 rounded">
                      <p className="text-xs text-blue-600 dark:text-blue-300">
                        Precio Plan
                      </p>
                      <p className="font-bold text-blue-900 dark:text-blue-100">
                        ${remainingPaymentData.plan_price?.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-blue-900/30 rounded">
                      <p className="text-xs text-green-600 dark:text-green-300">
                        Ya Pagado
                      </p>
                      <p className="font-bold text-green-700 dark:text-green-100">
                        ${remainingPaymentData.total_paid?.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-blue-900/30 rounded">
                      <p className="text-xs text-orange-600 dark:text-orange-300">
                        Restante
                      </p>
                      <p className="font-bold text-orange-700 dark:text-orange-100">
                        ${remainingPaymentData.remaining_amount?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sección: Información del Cliente */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    1
                  </span>
                  Información del Cliente
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cliente */}
                  <div className="space-y-2">
                    <Label htmlFor="client_id" className="text-sm font-medium">
                      Cliente{" "}
                      <span className="text-destructive" aria-hidden="true">
                        *
                      </span>
                      <span className="sr-only">(requerido)</span>
                    </Label>
                    {!!preselectedClient || isPayingRemaining || isEditing ? (
                      // Select deshabilitado para clientes preseleccionados
                      <Select value={formData.client_id} disabled={true}>
                        <SelectTrigger id="client_id" className="bg-muted">
                          <SelectValue placeholder="Seleccionar cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.first_name} {client.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      // SearchableSelect para búsqueda de clientes
                      <SearchableSelect
                        id="client_id"
                        options={clients.map((client) => ({
                          value: client.id,
                          label: `${client.first_name} ${client.last_name}`,
                          searchTerms: [
                            client.first_name,
                            client.last_name,
                            client.cedula,
                            `${client.first_name} ${client.last_name}`,
                          ],
                          cedula: client.cedula,
                        }))}
                        value={formData.client_id}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, client_id: value }))
                        }
                        placeholder="Buscar cliente..."
                        searchPlaceholder="Nombre o cédula..."
                        emptyMessage="No se encontró ningún cliente"
                        aria-required="true"
                        renderOption={(option) => (
                          <div className="flex flex-col">
                            <span className="font-medium">{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.cedula}
                            </span>
                          </div>
                        )}
                        renderValue={(option) => <span>{option.label}</span>}
                      />
                    )}
                  </div>

                  {/* Plan */}
                  <div className="space-y-2">
                    <Label htmlFor="plan_id" className="text-sm font-medium">
                      Plan{" "}
                      <span className="text-destructive" aria-hidden="true">
                        *
                      </span>
                      <span className="sr-only">(requerido)</span>
                    </Label>
                    <Select
                      value={formData.plan_id}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, plan_id: value }))
                      }
                      disabled={isPayingRemaining || isEditing}
                    >
                      <SelectTrigger
                        id="plan_id"
                        aria-required="true"
                        className={
                          isPayingRemaining || isEditing ? "bg-muted" : ""
                        }
                      >
                        <SelectValue placeholder="Seleccionar plan..." />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            <span className="font-medium">{plan.name}</span>
                            <span className="text-primary font-semibold ml-2">
                              ${plan.price}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </fieldset>

              {/* Sección: Detalles del Pago */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    2
                  </span>
                  Detalles del Pago
                </legend>

                {/* Modo de pago */}
                {formData.plan_id && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Modo de Pago</Label>
                    <div
                      className="flex gap-3"
                      role="radiogroup"
                      aria-label="Seleccionar modo de pago"
                    >
                      <label
                        className={`flex-1 flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                          paymentMode === "full"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-input hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment_mode"
                          value="full"
                          checked={paymentMode === "full"}
                          onChange={() => handlePaymentModeChange("full")}
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            paymentMode === "full"
                              ? "border-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {paymentMode === "full" && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">Pago Completo</p>
                          <p className="text-xs text-muted-foreground">
                            $
                            {currentPaymentInfo.remainingAmount > 0
                              ? currentPaymentInfo.remainingAmount.toFixed(2)
                              : "0.00"}
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex-1 flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                          paymentMode === "partial"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-input hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment_mode"
                          value="partial"
                          checked={paymentMode === "partial"}
                          onChange={() => handlePaymentModeChange("partial")}
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            paymentMode === "partial"
                              ? "border-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {paymentMode === "partial" && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">Pago Parcial</p>
                          <p className="text-xs text-muted-foreground">
                            Monto personalizado
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Campos de monto y fecha - layout adaptativo según tipo de pago */}
                {formData.payment_type === "efectivo_dolares" ? (
                  /* Layout para efectivo en dólares: 2 campos en una fila */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Monto USD */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="amount_usd"
                        className="text-sm font-medium"
                      >
                        Monto en USD{" "}
                        <span className="text-destructive" aria-hidden="true">
                          *
                        </span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                          $
                        </span>
                        <Input
                          id="amount_usd"
                          type="number"
                          step="0.01"
                          min="0"
                          name="amount_usd"
                          value={formData.amount_usd}
                          onChange={handleInputChange}
                          placeholder="0.00"
                          disabled={
                            paymentMode === "full" &&
                            formData.plan_id &&
                            !isEditing
                          }
                          className={`pl-7 ${partialValidationError ? "border-destructive focus-visible:ring-destructive/30" : ""} ${
                            paymentMode === "full" &&
                            formData.plan_id &&
                            !isEditing
                              ? "bg-muted"
                              : ""
                          }`}
                          aria-invalid={!!partialValidationError}
                          aria-describedby={
                            partialValidationError ? "amount-error" : undefined
                          }
                        />
                      </div>
                      {partialValidationError && (
                        <p
                          id="amount-error"
                          className="text-destructive text-xs flex items-center gap-1"
                          role="alert"
                        >
                          <span aria-hidden="true">!</span>{" "}
                          {partialValidationError}
                        </p>
                      )}
                    </div>

                    {/* Fecha de pago */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="payment_date"
                        className="text-sm font-medium"
                      >
                        Fecha de Pago{" "}
                        <span className="text-destructive" aria-hidden="true">
                          *
                        </span>
                      </Label>
                      <Input
                        id="payment_date"
                        type="date"
                        name="payment_date"
                        value={formData.payment_date}
                        onChange={handleInputChange}
                        aria-required="true"
                      />
                    </div>
                  </div>
                ) : (
                  /* Layout normal: 4 campos en 2 filas */
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Monto USD */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="amount_usd"
                          className="text-sm font-medium"
                        >
                          Monto en USD{" "}
                          <span className="text-destructive" aria-hidden="true">
                            *
                          </span>
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                            $
                          </span>
                          <Input
                            id="amount_usd"
                            type="number"
                            step="0.01"
                            min="0"
                            name="amount_usd"
                            value={formData.amount_usd}
                            onChange={handleInputChange}
                            placeholder="0.00"
                            disabled={
                              paymentMode === "full" &&
                              formData.plan_id &&
                              !isEditing
                            }
                            className={`pl-7 ${partialValidationError ? "border-destructive focus-visible:ring-destructive/30" : ""} ${
                              paymentMode === "full" &&
                              formData.plan_id &&
                              !isEditing
                                ? "bg-muted"
                                : ""
                            }`}
                            aria-invalid={!!partialValidationError}
                            aria-describedby={
                              partialValidationError
                                ? "amount-error"
                                : undefined
                            }
                          />
                        </div>
                        {partialValidationError && (
                          <p
                            id="amount-error"
                            className="text-destructive text-xs flex items-center gap-1"
                            role="alert"
                          >
                            <span aria-hidden="true">!</span>{" "}
                            {partialValidationError}
                          </p>
                        )}
                      </div>

                      {/* Monto Bs */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="amount_bs"
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Monto en Bs{" "}
                          <span className="text-xs">(calculado)</span>
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                            Bs
                          </span>
                          <Input
                            id="amount_bs"
                            type="text"
                            value={
                              formData.amount_bs
                                ? parseFloat(formData.amount_bs).toLocaleString(
                                    "es-VE",
                                  )
                                : ""
                            }
                            readOnly
                            disabled
                            className="pl-10 bg-muted"
                            aria-readonly="true"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Fecha de pago */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="payment_date"
                          className="text-sm font-medium"
                        >
                          Fecha de Pago{" "}
                          <span className="text-destructive" aria-hidden="true">
                            *
                          </span>
                        </Label>
                        <Input
                          id="payment_date"
                          type="date"
                          name="payment_date"
                          value={formData.payment_date}
                          onChange={handleInputChange}
                          aria-required="true"
                        />
                      </div>

                      {/* Tasa de cambio */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="exchange_rate"
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Tasa de Cambio <span className="text-xs">(Bs/$)</span>
                        </Label>
                        <Input
                          id="exchange_rate"
                          type="number"
                          step="0.0001"
                          name="exchange_rate"
                          value={formData.exchange_rate}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={!isEditing ? "bg-muted" : ""}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Restante después del pago */}
                {paymentMode === "partial" &&
                  formData.plan_id &&
                  formData.amount_usd &&
                  !partialValidationError && (
                    <div
                      className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg"
                      role="status"
                    >
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <span className="font-medium">
                          Restante después de este pago:
                        </span>{" "}
                        <span className="font-bold">
                          $
                          {
                            calculateRemainingAfterCurrentAmount(
                              formData.plan_id,
                              formData.amount_usd,
                            ).formattedAmount
                          }
                        </span>
                      </p>
                    </div>
                  )}
              </fieldset>

              {/* Sección: Método de Pago */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    3
                  </span>
                  Método de Pago
                </legend>

                {/* Tipo de pago */}
                <div className="space-y-2">
                  <Label htmlFor="payment_type" className="text-sm font-medium">
                    Tipo de Pago{" "}
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Select
                    value={formData.payment_type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, payment_type: value }))
                    }
                  >
                    <SelectTrigger id="payment_type" aria-required="true">
                      <SelectValue placeholder="Seleccionar tipo de pago..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago_movil">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" aria-hidden="true" />
                          <span>Pago Móvil</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="transferencia">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" aria-hidden="true" />
                          <span>Transferencia Bancaria</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="punto_de_venta">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" aria-hidden="true" />
                          <span>Punto de Venta</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="efectivo_dolares">
                        <div className="flex items-center gap-2">
                          <DollarSignIcon
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          <span>Efectivo en Dólares</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Campos adicionales según tipo de pago */}
                {(formData.payment_type === "pago_movil" ||
                  formData.payment_type === "transferencia") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Banco */}
                    <div className="space-y-2">
                      <Label htmlFor="bank" className="text-sm font-medium">
                        Banco Emisor
                      </Label>
                      <Select
                        value={formData.bank}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, bank: value }))
                        }
                      >
                        <SelectTrigger
                          id="bank"
                          aria-label="Seleccionar banco emisor del pago"
                        >
                          <SelectValue placeholder="Seleccionar banco..." />
                        </SelectTrigger>
                        <SelectContent>
                          {VENEZUELAN_BANKS.map((bank) => (
                            <SelectItem key={bank.code} value={bank.name}>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {bank.code}
                                </span>
                                <span>{bank.shortName}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Referencia */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="reference"
                        className="text-sm font-medium"
                      >
                        N° de Referencia
                      </Label>
                      <Input
                        id="reference"
                        type="text"
                        name="reference"
                        value={formData.reference}
                        onChange={handleInputChange}
                        placeholder="Ej: 123456789"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}

                {/* Teléfono - solo para pago móvil */}
                {formData.payment_type === "pago_movil" && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="phone_payment"
                      className="text-sm font-medium"
                    >
                      Teléfono del Pago Móvil
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.phone_operator}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            phone_operator: value,
                          }))
                        }
                      >
                        <SelectTrigger
                          className="w-24 flex-shrink-0"
                          aria-label="Código de operador telefónico"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PHONE_OPERATORS.map((op) => (
                            <SelectItem key={op.code} value={op.code}>
                              <span className="font-mono font-medium">
                                {op.code}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="phone_payment"
                        type="tel"
                        name="phone_payment"
                        value={formData.phone_payment}
                        onChange={handleInputChange}
                        placeholder="1234567"
                        maxLength={7}
                        className="flex-1 font-mono"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Número de teléfono asociado al pago móvil (7 dígitos)
                    </p>
                  </div>
                )}
              </fieldset>
            </div>
          </div>

          {/* Footer fijo */}
          <DialogFooter className="flex-shrink-0 pt-4 border-t gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                clientsLoading ||
                plansLoading ||
                !!partialValidationError
              }
              loading={isSubmitting}
            >
              {isEditing ? "Actualizar Pago" : "Registrar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, payment: open ? deleteDialog.payment : null })
        }
        title="Eliminar Pago"
        description={
          deleteDialog.payment
            ? `¿Estás seguro de que deseas eliminar el pago de "${deleteDialog.payment.clients?.first_name} ${deleteDialog.payment.clients?.last_name}" por $${parseFloat(deleteDialog.payment.amount_usd || 0).toFixed(2)}? Esta acción no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        loading={deletingId !== null}
        onConfirm={handleDeletePayment}
      />
    </Card>
  );
}
