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
import { Loader2, Building2, Phone } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

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
  } = usePayments();

  const { clients, loading: clientsLoading } = useClients();
  const { plans, loading: plansLoading } = usePlans();
  const {
    rate,
    formatMultiCurrency,
    formatCurrency,
    loading: rateLoading,
  } = useExchangeRate();

  const [showCreateForm, setShowCreateForm] = useState(
    preselectedClient ? true : false,
  );
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
  const [isCreating, setIsCreating] = useState(false);
  const [partialValidationError, setPartialValidationError] = useState("");

  // Estados para modo de pago restante
  const [isPayingRemaining, setIsPayingRemaining] = useState(false);
  const [remainingPaymentData, setRemainingPaymentData] = useState(null);

  const [editingPayment, setEditingPayment] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editPaymentMode, setEditPaymentMode] = useState("full");
  const [editFormData, setEditFormData] = useState({
    client_id: "",
    plan_id: "",
    amount_usd: "",
    amount_bs: "",
    exchange_rate: "",
    payment_date: "",
    reference: "",
    bank: "",
    payment_type: "",
    phone_operator: "0414",
    phone_payment: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [editPartialValidationError, setEditPartialValidationError] =
    useState("");
  const [deletingId, setDeletingId] = useState(null);

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedPaymentType, setSelectedPaymentType] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [displayPayments, setDisplayPayments] = useState([]);
  const [isFiltering, setIsFiltering] = useState(false);

  // Efecto para manejar pagos restantes desde props
  useEffect(() => {
    if (payRemaining && preselectedClient && remainingAmount && paymentId) {
      // Buscar el plan del cliente
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
      }
    }
  }, [
    payRemaining,
    preselectedClient,
    remainingAmount,
    paymentId,
    plans,
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
    if (showCreateForm && formData.plan_id) {
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
    showCreateForm,
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

  // Similar para el formulario de edición
  useEffect(() => {
    if (editFormData.amount_usd && editFormData.exchange_rate) {
      setEditFormData((prev) => ({
        ...prev,
        amount_bs: (
          parseFloat(editFormData.amount_usd) *
          parseFloat(editFormData.exchange_rate)
        ).toFixed(2),
      }));
    }
  }, [editFormData.amount_usd, editFormData.exchange_rate]);

  // Efecto unificado para auto-cargar el monto al cambiar cliente, plan o modo de pago
  useEffect(() => {
    if (showCreateForm && formData.plan_id && paymentMode === "full") {
      const amountToPay = currentPaymentInfo.remainingAmount;
      setFormData((prev) => ({
        ...prev,
        amount_usd: amountToPay > 0 ? amountToPay.toString() : "0",
        amount_bs:
          amountToPay > 0 ? (amountToPay * (rate || 1)).toFixed(2) : "0.00",
      }));
    }
  }, [
    showCreateForm,
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

  // Validar monto parcial en edición
  useEffect(() => {
    if (
      editPaymentMode === "partial" &&
      editFormData.plan_id &&
      editFormData.amount_usd
    ) {
      const planPrice = getPlanPrice(editFormData.plan_id);
      const amount = parseFloat(editFormData.amount_usd);

      if (amount > planPrice) {
        setEditPartialValidationError(
          `El monto no puede ser mayor al precio del plan ($${planPrice.toFixed(
            2,
          )})`,
        );
      } else if (amount <= 0) {
        setEditPartialValidationError("El monto debe ser mayor a 0");
      } else {
        setEditPartialValidationError("");
      }
    } else {
      setEditPartialValidationError("");
    }
  }, [editFormData.amount_usd, editFormData.plan_id, editPaymentMode]);

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
    if (showCreateForm && formData.client_id && formData.plan_id) {
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
      const selectedPlan = plans.find((p) => p.id === formData.plan_id);

      setRemainingPaymentData({
        client_id: formData.client_id,
        client_name: selectedClient
          ? `${selectedClient.first_name} ${selectedClient.last_name}`
          : "",
        plan_id: formData.plan_id,
        plan_name: selectedPlan ? selectedPlan.name : "",
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
    } else {
      setRemainingPaymentData(null);
    }
  }, [
    showCreateForm,
    formData.client_id,
    formData.plan_id,
    paymentMode,
    payments,
    rate,
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Si estamos pagando restante, no permitir cambiar cliente o plan
    if (isPayingRemaining && (name === "client_id" || name === "plan_id")) {
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

  const handleCreatePayment = async () => {
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

    setIsCreating(true);
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

      const result = await createPayment(paymentData);

      if (result.success) {
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

        // Resetear estados
        setPaymentMode("full");
        setPartialValidationError("");
        setShowCreateForm(false);
        setIsPayingRemaining(false);
        setRemainingPaymentData(null);

        // Mensaje de éxito personalizado si era pago restante
        if (isPayingRemaining && remainingPaymentData) {
          toast.success(
            `Pago restante de $${parseFloat(formData.amount_usd).toFixed(
              2,
            )} registrado exitosamente para ${remainingPaymentData.client_name}`,
          );
        } else {
          toast.success("Pago registrado exitosamente");
        }
      } else {
        toast.error("Error al registrar pago: " + result.error);
      }
    } catch (err) {
      console.error("Error al registrar pago:", err);
      toast.error("Error al registrar pago: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditPayment = (payment) => {
    setEditingPayment(payment);
    const isFullPayment =
      payment.amount_usd === parseFloat(payment.plans?.price || 0);
    setEditPaymentMode(isFullPayment ? "full" : "partial");
    // Parse phone to separate operator and number
    const { operator, number } = parsePhone(payment.phone_payment || "");
    setEditFormData({
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
    setShowEditForm(true);
    setShowCreateForm(false);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditPaymentModeChange = (mode) => {
    setEditPaymentMode(mode);
    setEditPartialValidationError("");
    if (mode === "full" && editFormData.plan_id) {
      const planPrice = getPlanPrice(editFormData.plan_id);
      if (planPrice > 0) {
        setEditFormData((prev) => ({
          ...prev,
          amount_usd: planPrice.toString(),
          amount_bs: (planPrice * parseFloat(prev.exchange_rate || 1)).toFixed(
            2,
          ),
        }));
      }
    } else if (mode === "partial") {
      // En modo parcial, calcular el restante actual
      if (editFormData.plan_id) {
        // Obtener todos los pagos del cliente para este plan
        const allClientPayments = payments.filter(
          (p) =>
            p.client_id === editFormData.client_id &&
            p.plan_id === editFormData.plan_id &&
            p.id !== editingPayment.id, // Excluir el pago que se está editando
        );

        // Calcular total pagado hasta ahora (excluyendo el pago actual)
        const totalPaid = allClientPayments.reduce(
          (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
          0,
        );
        const planPrice = getPlanPrice(editFormData.plan_id);
        const remainingAmount = Math.max(0, planPrice - totalPaid);

        // Cargar el monto restante como sugerencia pero permitir edición
        setEditFormData((prev) => ({
          ...prev,
          amount_usd: remainingAmount.toString(),
          amount_bs: (
            remainingAmount * parseFloat(prev.exchange_rate || 1)
          ).toFixed(2),
        }));
      } else {
        // Si no hay plan, limpiar montos
        setEditFormData((prev) => ({
          ...prev,
          amount_usd: "",
          amount_bs: "",
        }));
      }
    }
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;

    // Validación adicional para pagos parciales
    if (editPaymentMode === "partial" && editPartialValidationError) {
      toast.error(editPartialValidationError);
      return;
    }

    setIsUpdating(true);
    try {
      const paymentData = {
        ...editFormData,
        amount_usd: parseFloat(editFormData.amount_usd),
        amount_bs: parseFloat(editFormData.amount_bs),
        exchange_rate: parseFloat(editFormData.exchange_rate),
        phone_payment: editFormData.phone_payment
          ? formatPhone(editFormData.phone_operator, editFormData.phone_payment)
          : "",
      };
      // Remove phone_operator from payload as it's only for UI
      delete paymentData.phone_operator;

      const result = await updatePayment(editingPayment.id, paymentData);

      if (result.success) {
        setEditingPayment(null);
        setShowEditForm(false);
        setEditFormData({
          client_id: "",
          plan_id: "",
          amount_usd: "",
          amount_bs: "",
          exchange_rate: "",
          payment_date: "",
          reference: "",
          bank: "",
          payment_type: "pago_movil",
          phone_operator: "0414",
          phone_payment: "",
        });
        setEditPaymentMode("full");
        setEditPartialValidationError("");
        toast.success("Pago actualizado exitosamente");
      } else {
        toast.error("Error al actualizar pago: " + result.error);
      }
    } catch (err) {
      console.error("Error al actualizar pago:", err);
      toast.error("Error al actualizar pago: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const cancelEdit = () => {
    setEditingPayment(null);
    setShowEditForm(false);
    setEditFormData({
      client_id: "",
      plan_id: "",
      amount_usd: "",
      amount_bs: "",
      exchange_rate: "",
      payment_date: "",
      reference: "",
      bank: "",
      payment_type: "",
      phone_operator: "0414",
      phone_payment: "",
    });
    setEditPaymentMode("full");
    setEditPartialValidationError("");
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
    setShowCreateForm(true);
    setShowEditForm(false);
    setIsPayingRemaining(true);

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

  const handleDeletePayment = async (paymentId) => {
    setDeletingId(paymentId);
    try {
      const result = await deletePayment(paymentId);
      if (result.success) {
        toast.success("Pago eliminado exitosamente");
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
  };

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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>
          Pagos ({displayPayments.length}
          {activeFiltersCount > 0 ? ` de ${payments.length}` : ""})
        </CardTitle>
        <div className="flex space-x-2">
          <Button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setShowEditForm(false);
            }}
            variant="default"
            size="sm"
          >
            {showCreateForm ? "Cancelar" : "+ Nuevo Pago"}
          </Button>
          <Button
            onClick={refetch}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Actualizar"
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Barra de búsqueda y filtros */}
        <div className="mb-6 space-y-4">
          {/* Barra de búsqueda */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por nombre del cliente o cédula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground">
              Filtros:
            </span>

            {/* Filtro por plan */}
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-[160px]"
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
                  className="w-[200px]"
                  aria-label="Filtrar por banco"
                >
                  <SelectValue placeholder="Todos los bancos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los bancos</SelectItem>
                  {VENEZUELAN_BANKS.map((bank) => (
                    <SelectItem key={bank.code} value={bank.name}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {bank.shortName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Filtros de fecha */}
            <div className="flex gap-2 items-center">
              <span className="text-sm">Desde:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-sm">Hasta:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Botón para limpiar filtros */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <FilterXIcon className="h-4 w-4 mr-1" />
                Limpiar ({activeFiltersCount})
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

        {/* Formulario de creación */}
        {showCreateForm && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4">
              {isPayingRemaining
                ? `Pagar Restante - ${remainingPaymentData?.client_name}`
                : preselectedClient
                  ? `Nuevo Pago - ${preselectedClient.first_name} ${preselectedClient.last_name}`
                  : "Registrar Nuevo Pago"}
            </h3>
            {isPayingRemaining && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Resumen de Pagos:</strong>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Plan: {remainingPaymentData?.plan_name} - $
                  {remainingPaymentData?.plan_price?.toFixed(2)}
                </p>
                <p className="text-xs text-blue-700">
                  Ya pagado: ${remainingPaymentData?.total_paid?.toFixed(2)}
                </p>
                <p className="text-xs text-blue-700">
                  Restante: $
                  {remainingPaymentData?.remaining_amount?.toFixed(2)}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Cliente
                  {isPayingRemaining && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Bloqueado en modo pago restante)
                    </span>
                  )}
                </label>
                <select
                  name="client_id"
                  value={formData.client_id}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isPayingRemaining ? "bg-gray-100 text-gray-600" : ""
                  }`}
                  disabled={!!preselectedClient || isPayingRemaining}
                  required
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.first_name} {client.last_name} - {client.cedula}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Plan
                  {isPayingRemaining && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Bloqueado en modo pago restante)
                    </span>
                  )}
                </label>
                <select
                  name="plan_id"
                  value={formData.plan_id}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isPayingRemaining ? "bg-gray-100 text-gray-600" : ""
                  }`}
                  disabled={isPayingRemaining}
                  required
                >
                  <option value="">Seleccionar plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.price}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de modo de pago */}
              {formData.plan_id && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Modo de Pago
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="payment_mode"
                        value="full"
                        checked={paymentMode === "full"}
                        onChange={() => handlePaymentModeChange("full")}
                        disabled={false}
                        className="mr-2"
                      />
                      Pagar Completo ($
                      {currentPaymentInfo.remainingAmount > 0
                        ? currentPaymentInfo.remainingAmount.toFixed(2)
                        : "0.00"}
                      )
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="payment_mode"
                        value="partial"
                        checked={paymentMode === "partial"}
                        onChange={() => handlePaymentModeChange("partial")}
                        className="mr-2"
                      />
                      Pago Parcial (restante: $
                      {currentPaymentInfo.remainingAmount > 0
                        ? currentPaymentInfo.remainingAmount.toFixed(2)
                        : "0.00"}
                      )
                    </label>
                  </div>
                </div>
              )}

              {/* Campos de monto USD y Bs */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Monto en USD
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amount_usd"
                  value={formData.amount_usd}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    partialValidationError ? "border-red-500" : ""
                  }`}
                  placeholder="10.00"
                  disabled={paymentMode === "full" && formData.plan_id}
                  required
                />
                {partialValidationError && (
                  <p className="text-red-500 text-xs mt-1">
                    {partialValidationError}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Monto en Bs
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amount_bs"
                  value={formData.amount_bs}
                  readOnly
                  className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-600"
                  placeholder="Calculado automáticamente"
                />
              </div>

              {/* Pago restante para pagos parciales */}
              {paymentMode === "partial" &&
                formData.plan_id &&
                formData.amount_usd &&
                !partialValidationError && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Pago Restante
                    </label>
                    <div className="w-full px-3 py-2 border rounded-md bg-yellow-50 text-yellow-800 font-medium">
                      $
                      {
                        calculateRemainingAfterCurrentAmount(
                          formData.plan_id,
                          formData.amount_usd,
                        ).formattedAmount
                      }
                    </div>
                  </div>
                )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Tasa de Cambio
                </label>
                <input
                  type="number"
                  step="0.0001"
                  name="exchange_rate"
                  value={formData.exchange_rate}
                  readOnly
                  className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tipo de Pago
                </label>
                <select
                  name="payment_type"
                  value={formData.payment_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="punto_de_venta">Punto de Venta</option>
                  <option value="efectivo_dolares">Efectivo $</option>
                </select>
              </div>

              {/* Campos de referencia y banco - solo para pago móvil y transferencia */}
              {(formData.payment_type === "pago_movil" ||
                formData.payment_type === "transferencia") && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Referencia
                    </label>
                    <input
                      type="text"
                      name="reference"
                      value={formData.reference}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Número de referencia"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-bank">Banco</Label>
                    <Select
                      value={formData.bank}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, bank: value }))
                      }
                    >
                      <SelectTrigger id="create-bank" className="w-full">
                        <SelectValue placeholder="Seleccionar banco" />
                      </SelectTrigger>
                      <SelectContent>
                        {VENEZUELAN_BANKS.map((bank) => (
                          <SelectItem key={bank.code} value={bank.name}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span>{bank.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Campo de teléfono - solo para pago móvil */}
              {formData.payment_type === "pago_movil" && (
                <div>
                  <Label
                    htmlFor="phone_payment"
                    className="block text-sm font-medium mb-2"
                  >
                    Teléfono Pago Móvil
                  </Label>
                  <div className="flex gap-1">
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
                        className="w-[90px] flex-shrink-0"
                        aria-label="Operador telefónico"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_OPERATORS.map((op) => (
                          <SelectItem key={op.code} value={op.code}>
                            <span className="font-medium">{op.code}</span>
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
                      className="flex-1"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Fecha de Pago
                </label>
                <input
                  type="date"
                  name="payment_date"
                  value={formData.payment_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <Button
                onClick={handleCreatePayment}
                disabled={
                  isCreating ||
                  clientsLoading ||
                  plansLoading ||
                  partialValidationError
                }
                variant="default"
                size="sm"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Registrar Pago"
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowCreateForm(false);
                  setPaymentMode("full");
                  setPartialValidationError("");
                  setIsPayingRemaining(false);
                  setRemainingPaymentData(null);
                }}
                variant="outline"
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Formulario de edición */}
        {showEditForm && (
          <div className="mb-6 p-4 border rounded-lg bg-blue-50">
            <h3 className="text-lg font-semibold mb-4">Editar Pago</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Cliente
                </label>
                <select
                  name="client_id"
                  value={editFormData.client_id}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.first_name} {client.last_name} - {client.cedula}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Plan</label>
                <select
                  name="plan_id"
                  value={editFormData.plan_id}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.price}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de modo de pago en edición */}
              {editFormData.plan_id && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Modo de Pago
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="edit_payment_mode"
                        value="full"
                        checked={editPaymentMode === "full"}
                        onChange={() => handleEditPaymentModeChange("full")}
                        className="mr-2"
                      />
                      Pago Completo ($
                      {getPlanPrice(editFormData.plan_id).toFixed(2)})
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="edit_payment_mode"
                        value="partial"
                        checked={editPaymentMode === "partial"}
                        onChange={() => handleEditPaymentModeChange("partial")}
                        className="mr-2"
                      />
                      Pago Parcial
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Monto en USD
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amount_usd"
                  value={editFormData.amount_usd}
                  onChange={handleEditInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    editPartialValidationError ? "border-red-500" : ""
                  }`}
                  disabled={editPaymentMode === "full" && editFormData.plan_id}
                  required
                />
                {editPartialValidationError && (
                  <p className="text-red-500 text-xs mt-1">
                    {editPartialValidationError}
                  </p>
                )}
              </div>

              {/* Pago restante para pagos parciales en edición */}
              {editPaymentMode === "partial" &&
                editFormData.plan_id &&
                editFormData.amount_usd &&
                !editPartialValidationError && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Pago Restante
                    </label>
                    <div className="w-full px-3 py-2 border rounded-md bg-yellow-50 text-yellow-800 font-medium">
                      $
                      {
                        calculateRemainingAmount(
                          editFormData.plan_id,
                          editFormData.amount_usd,
                        ).formattedAmount
                      }
                    </div>
                  </div>
                )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Monto en Bs
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amount_bs"
                  value={editFormData.amount_bs}
                  readOnly
                  className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tasa de Cambio
                </label>
                <input
                  type="number"
                  step="0.0001"
                  name="exchange_rate"
                  value={editFormData.exchange_rate}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tipo de Pago
                </label>
                <select
                  name="payment_type"
                  value={editFormData.payment_type}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="punto_de_venta">Punto de Venta</option>
                  <option value="efectivo_dolares">Efectivo $</option>
                </select>
              </div>

              {/* Campos de referencia y banco - solo para pago móvil y transferencia */}
              {(editFormData.payment_type === "pago_movil" ||
                editFormData.payment_type === "transferencia") && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Referencia
                    </label>
                    <input
                      type="text"
                      name="reference"
                      value={editFormData.reference}
                      onChange={handleEditInputChange}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Número de referencia"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-bank">Banco</Label>
                    <Select
                      value={editFormData.bank}
                      onValueChange={(value) =>
                        setEditFormData((prev) => ({ ...prev, bank: value }))
                      }
                    >
                      <SelectTrigger id="edit-bank" className="w-full">
                        <SelectValue placeholder="Seleccionar banco" />
                      </SelectTrigger>
                      <SelectContent>
                        {VENEZUELAN_BANKS.map((bank) => (
                          <SelectItem key={bank.code} value={bank.name}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span>{bank.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Campo de teléfono - solo para pago móvil */}
              {editFormData.payment_type === "pago_movil" && (
                <div>
                  <Label
                    htmlFor="edit_phone_payment"
                    className="block text-sm font-medium mb-2"
                  >
                    Teléfono Pago Móvil
                  </Label>
                  <div className="flex gap-1">
                    <Select
                      value={editFormData.phone_operator}
                      onValueChange={(value) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          phone_operator: value,
                        }))
                      }
                    >
                      <SelectTrigger
                        className="w-[90px] flex-shrink-0"
                        aria-label="Operador telefónico"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_OPERATORS.map((op) => (
                          <SelectItem key={op.code} value={op.code}>
                            <span className="font-medium">{op.code}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="edit_phone_payment"
                      type="tel"
                      name="phone_payment"
                      value={editFormData.phone_payment}
                      onChange={handleEditInputChange}
                      placeholder="1234567"
                      maxLength={7}
                      className="flex-1"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Fecha de Pago
                </label>
                <input
                  type="date"
                  name="payment_date"
                  value={editFormData.payment_date}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <Button
                onClick={handleUpdatePayment}
                disabled={isUpdating || editPartialValidationError}
                variant="default"
                size="sm"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Actualizar Pago"
                )}
              </Button>
              <Button onClick={cancelEdit} variant="outline" size="sm">
                Cancelar
              </Button>
            </div>
          </div>
        )}

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
                <li>Haz clic en "+ Nuevo Pago"</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Lista de pagos del gimnasio">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Cédula</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>USD</TableHead>
                  <TableHead className="hidden md:table-cell">Bs</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Restante
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">Ref.</TableHead>
                  <TableHead className="hidden xl:table-cell">Banco</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead className="hidden xl:table-cell">Tel.</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayPayments.map((payment, index) => {
                  const paymentStatus = calculatePaymentStatus(payment);
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium text-center">
                        {index + 1}
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
                        {rateLoading ? (
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
                                onClick={() => handleEditPayment(payment)}
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
                                onClick={() => handleDeletePayment(payment.id)}
                                variant="destructive"
                                size="icon-sm"
                                disabled={deletingId === payment.id}
                              >
                                {deletingId === payment.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <TrashIcon />
                                )}
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
        )}
      </CardContent>
    </Card>
  );
}
