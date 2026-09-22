import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useClients } from "../../hooks/useClients";
import { usePlans } from "../../hooks/usePlans";
import { usePayments } from "../../hooks/usePayments";
import { useExchangeRate } from "../../hooks/useExchangeRate";
import { formatDate, matchesSearch } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import supabase from "../../api/client";

const INSCRIPTION_PRICE = 5;
import {
  DOCUMENT_TYPES,
  PHONE_OPERATORS,
  formatCedula,
  parseCedula,
  formatPhone,
  parsePhone,
} from "../../lib/venezuelanData";
import {
  auditNextPaymentDates,
  recalculateNextPaymentDate,
  getEffectiveAmount,
} from "../../utils/paymentCalculations";
import { toast } from "sonner";
import {
  Loader2,
  IdCard,
  Phone,
  Users,
  RotateCcw,
  RefreshCw,
  Copy,
  Mail,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { TruncatedCell } from "../ui/truncated-cell";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { getInitials } from "@/lib/getInitials";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  EmptyState,
  SearchEmptyState,
  GettingStartedState,
} from "../ui/empty-state";
import {
  EditIcon,
  TrashIcon,
  SearchIcon,
  FilterXIcon,
  DollarSignIcon,

} from "../ui/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Pagination, usePagination } from "../ui/pagination";

export function ClientsTable() {
  const router = useRouter();
  const {
    clients,
    loading,
    error,
    isUpdating,
    refetch,
    createClient,
    updateClient,
    deleteClient,
    resetClientHistory,
    recalculateAllNextPaymentDates,
    fixAllPhones,
  } = useClients();

  const { plans, loading: plansLoading } = usePlans();
  const { payments, loading: paymentsLoading } = usePayments();
  const { formatMultiCurrency, loading: rateLoading } = useExchangeRate();

  // Estados del modal unificado para crear/editar
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    cedula_type: "V",
    cedula: "",
    birth_date: "",
    email: "",
    phone_operator: "0414",
    phone: "",
    address: "",
    observations: "",
    plan_id: "",
    join_date: new Date().toISOString().split("T")[0],
    enrollment_paid: false,
      avatar_url: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  // Estado para eliminación
  const [deletingId, setDeletingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [clientToReset, setClientToReset] = useState(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetDate, setResetDate] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateSort, setDateSort] = useState("");

  // Refrescar clientes al volver a la pestaña (p. ej. después de registrar un pago en /pagos)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetch();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refetch]);

  // Estados para paginación
  const {
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    resetPage,
    paginateData,
  } = usePagination(10);

  const getPlanPrice = (planId) => {
    const plan = plans.find((p) => p.id === planId);
    return plan ? parseFloat(plan.price) || 0 : 0;
  };

  // Calcular el status del cliente basado en sus pagos
  // Activo: tiene días restantes positivos o ha pagado su membresía completa
  // Pendiente: tiene pagos parciales (pago fraccionado) pero no completó el ciclo
  // Inactivo: tiene días vencidos (negativos) o no tiene pagos
  const getClientStatus = (client) => {
    if (!client || !client.plan_id) {
      return { status: "inactivo", label: "Inactivo" };
    }

    // Usar el status de la base de datos si está disponible
    if (client.status === "pendiente") {
      return { status: "pendiente", label: "Pendiente" };
    }

    // REGLA PRINCIPAL: Si tiene días hasta el próximo pago negativos, está vencido (inactivo)
    if (client.daysUntilPayment !== null && client.daysUntilPayment < 0) {
      return { status: "inactivo", label: "Inactivo" };
    }

    // REGLA PRINCIPAL: Si tiene días hasta el próximo pago >= 0, está activo (tiene tiempo)
    if (client.daysUntilPayment !== null && client.daysUntilPayment >= 0) {
      return { status: "activo", label: "Activo" };
    }

    // Si no tiene next_payment_date calculado, verificar si ha pagado
    const planPrice = getPlanPrice(client.plan_id);
    if (planPrice <= 0) {
      return { status: "activo", label: "Activo" };
    }

    const allClientPayments = payments.filter(
      (p) => p.client_id === client.id && p.plan_id === client.plan_id,
    );

    // Si no tiene pagos y no tiene daysUntilPayment, está inactivo
    if (allClientPayments.length === 0) {
      return { status: "inactivo", label: "Inactivo" };
    }

    const totalPaidSoFar = allClientPayments.reduce(
      (sum, p) => sum + getEffectiveAmount(p),
      0,
    );

    // Calcular el ciclo actual de pago (considerar inscripción si está pagada)
    const hasEnrollmentPaid = client.enrollment_paid === true;
    const totalPrice = hasEnrollmentPaid ? planPrice + INSCRIPTION_PRICE : planPrice;

    let paidForCurrentCycle = totalPaidSoFar % totalPrice;

    if (paidForCurrentCycle < 0.001 && totalPaidSoFar > 0) {
      paidForCurrentCycle = totalPrice;
    }

    const currentRemaining = totalPrice - paidForCurrentCycle;
    const isFullyPaid = currentRemaining < 0.001;

    // Si pagó completo el ciclo actual, está activo
    if (isFullyPaid) {
      return { status: "activo", label: "Activo" };
    }

    // Si tiene pagos parciales (pago fraccionado), está pendiente
    if (totalPaidSoFar > 0 && currentRemaining > 0) {
      return { status: "pendiente", label: "Pendiente" };
    }

    // Por defecto, si no tiene pagos, está inactivo
    return { status: "inactivo", label: "Inactivo" };
  };

  const calculatePaymentStatus = (client) => {
    if (!client || !client.plan_id) {
      return { isFullyPaid: true, remainingFormatted: "0.00" };
    }

    const planPrice = getPlanPrice(client.plan_id);
    if (planPrice <= 0) {
      return { isFullyPaid: true, remainingFormatted: "0.00" };
    }

    const allClientPayments = payments.filter(
      (p) => p.client_id === client.id && p.plan_id === client.plan_id,
    );

    const totalPaidSoFar = allClientPayments.reduce(
      (sum, p) => sum + getEffectiveAmount(p),
      0,
    );

    // El precio total incluye la inscripción si está marcada
    const hasEnrollmentPaid = client.enrollment_paid === true;
    const totalPrice = hasEnrollmentPaid
      ? planPrice + INSCRIPTION_PRICE
      : planPrice;

    // Calcular cuánto se ha pagado en el ciclo actual
    let currentCyclePaid = totalPaidSoFar % totalPrice;
    if (currentCyclePaid < 0.001 && totalPaidSoFar > 0) {
      currentCyclePaid = totalPrice;
    }
    const currentRemaining = totalPrice - currentCyclePaid;
    const isFullyPaid = currentRemaining < 0.001;

    // Si ya se completó el ciclo actual, no hay restante que mostrar
    if (isFullyPaid) {
      return { isFullyPaid: true, remainingFormatted: "0.00" };
    }

    return {
      isFullyPaid: false,
      remainingFormatted: currentRemaining.toFixed(2),
    };
  };

  const getPaymentWithRemaining = (client) => {
    if (!client || !client.plan_id) {
      return null;
    }

    const allClientPayments = payments.filter(
      (p) => p.client_id === client.id && p.plan_id === client.plan_id,
    );

    if (allClientPayments.length === 0) {
      return null;
    }

    const planPrice = getPlanPrice(client.plan_id);
    const totalPaid = allClientPayments.reduce(
      (sum, p) => sum + getEffectiveAmount(p),
      0,
    );

    // El precio total incluye la inscripción si está marcada
    const hasEnrollmentPaid = client.enrollment_paid === true;
    const totalPrice = hasEnrollmentPaid
      ? planPrice + INSCRIPTION_PRICE
      : planPrice;

    // Calcular cuánto se ha pagado en el ciclo actual
    let currentCyclePaid = totalPaid % totalPrice;
    if (currentCyclePaid < 0.001 && totalPaid > 0) {
      currentCyclePaid = totalPrice;
    }
    const remainingAmount = totalPrice - currentCyclePaid;

    // Si ya completó el ciclo actual, no hay restante
    if (remainingAmount < 0.001) {
      return null;
    }

    if (remainingAmount > 0) {
      // Encontrar el último pago para asociarlo con el saldo restante
      const lastPayment = allClientPayments.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      )[0];

      return {
        ...lastPayment,
        remainingAmount,
        remainingFormatted: remainingAmount.toFixed(2),
      };
    }

    return null;
  };

  const handlePayRemainingForClient = (client) => {
    const paymentWithRemaining = getPaymentWithRemaining(client);

    if (paymentWithRemaining) {
      // Redirigir a la página de pagos con parámetros específicos para el pago restante
      router.push(
        `/pagos/${client.id}?paymentId=${paymentWithRemaining.id}&remaining=${paymentWithRemaining.remainingAmount}&payRemaining=true`,
      );
    } else {
      // Si no hay pago específico con saldo, redirigir a la página normal
      router.push(`/pagos/${client.id}`);
    }
  };

  // Resetear formulario
  const resetForm = useCallback(() => {
    setFormData({
      first_name: "",
      last_name: "",
      cedula_type: "V",
      cedula: "",
      birth_date: "",
      email: "",
      phone_operator: "0414",
      phone: "",
      address: "",
      observations: "",
      plan_id: "",
      join_date: new Date().toISOString().split("T")[0],
      enrollment_paid: false,
      avatar_url: "",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedClient(null);
    setIsEditing(false);
  }, []);

  // Abrir modal para crear
  const handleOpenCreateDialog = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  // Abrir modal para editar
  const handleOpenEditDialog = useCallback((client) => {
    setSelectedClient(client);
    // Parse cedula to separate type and number
    const { type, number } = parseCedula(client.cedula || "");
    // Parse phone to separate operator and number
    const { operator, number: phoneNumber } = parsePhone(client.phone || "");
    setFormData({
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      cedula_type: type,
      cedula: number,
      birth_date: client.birth_date || "",
      email: client.email || "",
      phone_operator: operator,
      phone: phoneNumber,
      address: client.address || "",
      observations: client.observations || "",
      plan_id: client.plan_id || "",
      join_date: client.join_date || "",
      enrollment_paid: client.enrollment_paid || false,
      avatar_url: client.avatar_url || "",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

    // Máscara para teléfono: solo números, max 7 dígitos
    if (name === "phone") {
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

  const handleEnrollmentPaidChange = (checked) => {
    setFormData((prev) => ({
      ...prev,
      enrollment_paid: checked,
    }));
  };


  // Manejar selección de archivo de foto
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen válida");
      return;
    }
    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar los 5MB");
      return;
    }

    setPhotoFile(file);
    // Generar preview
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Subir foto a Supabase Storage y devolver la URL pública
  const uploadPhotoToStorage = async (file) => {
    if (!file) return null;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const filePath = `clients/${fileName}`;

      const { error } = await supabase.storage
        .from("client-avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("client-avatars")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error("Error uploading photo:", err);
      toast.error("Error al subir la foto: " + err.message);
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Eliminar foto seleccionada (no la guardada en DB)
  const clearPhotoSelection = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Enviar formulario (crear o editar)
  const handleSubmit = async () => {
    if (
      !formData.first_name.trim() ||
      !formData.last_name.trim() ||
      !formData.cedula.trim() ||
      !formData.birth_date
    ) {
      toast.error(
        "Los campos de nombre, apellido, cédula y fecha de nacimiento son obligatorios",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedCedula = formatCedula(
        formData.cedula_type,
        formData.cedula,
      );

      if (!isEditing) {
        const existingClient = clients.find(
          (c) => c.cedula === formattedCedula,
        );
        if (existingClient) {
          toast.error(
            `La cédula ${formattedCedula} ya está registrada en el sistema para el cliente ${existingClient.first_name} ${existingClient.last_name}. Intenta con una cédula diferente.`,
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Format cedula with type prefix before saving
      // Format phone with operator prefix before saving
      let planPrice = getPlanPrice(formData.plan_id);
      if (!isEditing && formData.enrollment_paid) {
        planPrice = planPrice + INSCRIPTION_PRICE;
      }

      // Subir foto si se seleccionó una nueva
      let finalAvatarUrl = formData.avatar_url || null;
      if (photoFile) {
        const uploadedUrl = await uploadPhotoToStorage(photoFile);
        if (uploadedUrl) {
          finalAvatarUrl = uploadedUrl;
        } else if (!isEditing) {
          // En modo crear, si falla el upload, abortar
          setIsSubmitting(false);
          return;
        }
      }

      const dataToSave = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        cedula: formattedCedula,
        birth_date: formData.birth_date,
        email: formData.email,
        phone: formData.phone
          ? formatPhone(formData.phone_operator, formData.phone)
          : "",
        address: formData.address,
        observations: formData.observations,
        avatar_url: finalAvatarUrl,
        plan_id: formData.plan_id,
        join_date: formData.join_date,
        enrollment_paid: formData.enrollment_paid,
        status: isEditing ? undefined : "pendiente",
      };

      let result;
      if (isEditing && selectedClient) {
        result = await updateClient(selectedClient.id, dataToSave);
      } else {
        result = await createClient(dataToSave);
      }

      if (result.success) {
        handleCloseDialog();

        if (!isEditing) {
          // New client created with pending status
          const newClient = result.data;
          toast.success("Cliente creado. Complete el pago para activar.");

          // Redirect to payments page
          if (formData.enrollment_paid) {
            // Include inscription + plan price
            router.push(
              `/pagos/${newClient.id}?amount=${planPrice}&enrollment=${INSCRIPTION_PRICE}&register=true`,
            );
          } else {
            router.push(`/pagos/${newClient.id}?register=true`);
          }
        } else {
          // Edit mode - check if enrollment was just added
          const previouslyPaid = selectedClient?.enrollment_paid;
          if (formData.enrollment_paid && !previouslyPaid) {
            toast.success("Cliente actualizado. ¿Desea pagar la inscripción?");
          } else {
            toast.success("Cliente actualizado exitosamente");
          }
        }
      } else {
        toast.error(
          `Error al ${isEditing ? "actualizar" : "crear"} cliente: ` +
            result.error,
        );
      }
    } catch (err) {
      console.error(
        `Error al ${isEditing ? "actualizar" : "crear"} cliente:`,
        err,
      );
      toast.error(
        `Error al ${isEditing ? "actualizar" : "crear"} cliente: ` +
          err.message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleResetHistory = async () => {
    if (!clientToReset) return;
    setResettingId(clientToReset.id);
    try {
      const result = await resetClientHistory(clientToReset.id, { newJoinDate: resetDate || new Date().toISOString().split("T")[0] });
      if (result.success) {
        toast.success("Historial reiniciado exitosamente. Redirigiendo al pago de reactivación...");
        setIsResetDialogOpen(false);
        
        const planPrice = getPlanPrice(clientToReset.plan_id);
        
        if (planPrice > 0) {
          router.push(`/pagos/${clientToReset.id}?amount=${planPrice}&enrollment=${INSCRIPTION_PRICE}&register=true`);
        } else {
          router.push(`/pagos/${clientToReset.id}?register=true`);
        }
        
        setClientToReset(null);
      } else {
        toast.error("Error al reiniciar historial: " + result.error);
      }
    } catch (err) {
      console.error("Error resetting client history:", err);
      toast.error("Error al reiniciar historial: " + err.message);
    } finally {
      setResettingId(null);
    }
  };

  const openResetDialog = (client) => {
    setClientToReset(client);
    setResetDate(new Date().toISOString().split("T")[0]);
    setIsResetDialogOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    setDeletingId(clientToDelete.id);
    try {
      const result = await deleteClient(clientToDelete.id);
      if (result.success) {
        toast.success("Cliente eliminado exitosamente");
        setDeleteDialogOpen(false);
        setClientToDelete(null);
      } else {
        toast.error("Error al eliminar cliente: " + result.error);
      }
    } catch (err) {
      console.error("Error deleting client:", err);
      toast.error("Error al eliminar cliente: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Lógica de filtrado
  const filteredClients = clients.filter((client) => {
    // Filtrar por término de búsqueda (nombre, apellido, cédula, email, teléfono)
    const matchesSearchTerm = matchesSearch(
      searchTerm,
      client.first_name,
      client.last_name,
      client.cedula,
      client.email,
      client.phone
    );

    // Filtrar por plan
    const matchesPlan = selectedPlan === "" || client.plan_id === selectedPlan;

    // Filtrar por próximos pagos
    let matchesPayment = true;
    if (paymentFilter === "5days") {
      matchesPayment =
        client.daysUntilPayment !== null &&
        client.daysUntilPayment <= 5 &&
        client.daysUntilPayment >= 0;
    } else if (paymentFilter === "10days") {
      matchesPayment =
        client.daysUntilPayment !== null &&
        client.daysUntilPayment <= 10 &&
        client.daysUntilPayment >= 0;
    } else if (paymentFilter === "overdue") {
      matchesPayment =
        client.daysUntilPayment !== null && client.daysUntilPayment < 0;
    }

    // Filtrar por status
    let matchesStatus = true;
    if (statusFilter !== "") {
      const clientStatus = getClientStatus(client);
      matchesStatus = clientStatus.status === statusFilter;
    }

    return matchesSearchTerm && matchesPlan && matchesPayment && matchesStatus;
  });

  // Filtrar por mes
  const sortedClients = useMemo(() => {
    if (!dateSort) return filteredClients;

    const sorted = [...filteredClients];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (dateSort === "this_month") {
      return sorted.filter((client) => {
        if (!client.next_payment_date) return false;
        const paymentDate = new Date(client.next_payment_date);
        return (
          paymentDate.getFullYear() === currentYear &&
          paymentDate.getMonth() === currentMonth
        );
      });
    } else if (dateSort.includes("-")) {
      // Formato YYYY-MM para mes específico
      const [year, month] = dateSort.split("-").map(Number);
      return sorted.filter((client) => {
        if (!client.next_payment_date) return false;
        const paymentDate = new Date(client.next_payment_date);
        return (
          paymentDate.getFullYear() === year &&
          paymentDate.getMonth() === month - 1 // Los meses en JS son 0-indexados
        );
      });
    }

    return sorted;
  }, [filteredClients, dateSort]);

  // Función para limpiar todos los filtros
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedPlan("");
    setPaymentFilter("");
    setStatusFilter("");
    setDateSort("");
    resetPage();
  };

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    resetPage();
  }, [
    searchTerm,
    selectedPlan,
    paymentFilter,
    statusFilter,
    dateSort,
    resetPage,
  ]);

  // Datos paginados
  const paginatedClients = useMemo(() => {
    return paginateData(sortedClients);
  }, [sortedClients, paginateData]);

  // Contar filtros activos
  const activeFiltersCount = [
    searchTerm,
    selectedPlan,
    paymentFilter,
    statusFilter,
    dateSort,
  ].filter((filter) => filter !== "").length;

  // Detectar clientes duplicados por cédula
  const duplicateCedulas = useMemo(() => {
    const cedulaCount = {};
    clients.forEach((client) => {
      if (client.cedula) {
        cedulaCount[client.cedula] = (cedulaCount[client.cedula] || 0) + 1;
      }
    });
    return Object.entries(cedulaCount)
      .filter(([, count]) => count > 1)
      .map(([cedula]) => cedula);
  }, [clients]);

  const hasDuplicates = duplicateCedulas.length > 0;

  if (loading || paymentsLoading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold flex items-center gap-2">
            <Users
              className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
              aria-hidden="true"
            />
            <span>Clientes</span>
          </h2>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="p-2 sm:p-3 pt-0">
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold flex items-center gap-2">
            <Users
              className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
              aria-hidden="true"
            />
            <span>Clientes</span>
          </h2>
        </div>
        <div className="p-2 sm:p-3 pt-0">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Error: {error}</p>
            <Button onClick={refetch}>Reintentar</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold flex items-center gap-2">
          <Users
            className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
            aria-hidden="true"
          />
          <span>
            Clientes ({sortedClients.length}
            {sortedClients.length !== clients.length
              ? ` de ${clients.length}`
              : ""}
            )
          </span>
          {hasDuplicates && (
            <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {duplicateCedulas.length} duplicado
              {duplicateCedulas.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleOpenCreateDialog}
            variant="default"
            size="sm"
            className="text-xs sm:text-sm"
          >
            + Nuevo Cliente
          </Button>
          <Button
            onClick={refetch}
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
            aria-label="Actualizar lista de clientes"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" aria-hidden="true" />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </div>
      <div className="p-3 sm:p-4 pb-0 -mt-6">
        {/* Barra de busqueda y filtros */}
        <div className="mb-3 sm:mb-4 space-y-3 sm:space-y-4">
          {/* Barra de busqueda */}
          <div className="relative">
            <SearchIcon
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"
              aria-hidden="true"
            />
            <Input
              type="text"
              placeholder="Buscar por nombre o cedula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
              aria-label="Buscar clientes"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              Filtros:
            </span>

            {/* Filtro por plan */}
            <Select
              value={selectedPlan}
              onValueChange={(value) =>
                setSelectedPlan(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[130px] sm:w-[160px] h-8 text-xs sm:text-sm">
                <SelectValue placeholder="Todos los planes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los planes</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtros de pago */}
            <Button
              variant={paymentFilter === "5days" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 px-2"
              onClick={() =>
                setPaymentFilter(paymentFilter === "5days" ? "" : "5days")
              }
            >
              5d
            </Button>
            <Button
              variant={paymentFilter === "10days" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 px-2"
              onClick={() =>
                setPaymentFilter(paymentFilter === "10days" ? "" : "10days")
              }
            >
              10d
            </Button>
            <Button
              variant={paymentFilter === "overdue" ? "destructive" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() =>
                setPaymentFilter(paymentFilter === "overdue" ? "" : "overdue")
              }
            >
              Vencidos
            </Button>

            {/* Filtro por status */}
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) =>
                setStatusFilter(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[100px] sm:w-[120px] h-8 text-xs sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por mes específico */}
            <Select
              value={dateSort || "all"}
              onValueChange={(value) =>
                setDateSort(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[100px] sm:w-[120px] h-8 text-xs">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="this_month">Este mes</SelectItem>
                <SelectItem value="2026-01">Ene 2026</SelectItem>
                <SelectItem value="2026-02">Feb 2026</SelectItem>
                <SelectItem value="2026-03">Mar 2026</SelectItem>
              </SelectContent>
            </Select>

            {/* Boton para limpiar filtros */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                <FilterXIcon className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                <span className="hidden sm:inline">Limpiar</span>
              </Button>
            )}
          </div>

          {/* Indicador de resultados */}
          {sortedClients.length !== clients.length && (
            <div className="text-xs sm:text-sm text-muted-foreground">
              Mostrando {sortedClients.length} de {clients.length} clientes
            </div>
          )}
        </div>

        <div className="mt-4 sm:mt-5">
          {clients.length === 0 ? (
          <GettingStartedState
            title="No hay clientes registrados"
            steps={[
              'Haz clic en "+ Nuevo Cliente"',
              "Completa el formulario con los datos del cliente",
              "Selecciona un plan para el cliente",
            ]}
            action={{
              label: "Nuevo Cliente",
              onClick: handleOpenCreateDialog,
            }}
          />
        ) : sortedClients.length === 0 ? (
          <SearchEmptyState
            searchTerm={searchTerm}
            entityName="clientes"
            onClear={clearFilters}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table aria-label="Lista de clientes del gimnasio">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Cédula
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Email
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Teléfono
                    </TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Status
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Ingreso
                    </TableHead>
                    <TableHead>Próx. Pago</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClients.map((client, index) => {
                    const paymentStatus = calculatePaymentStatus(client);
                    const paymentWithRemaining =
                      getPaymentWithRemaining(client);

                    // Calcular días hasta el próximo pago
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const daysUntilPayment = client.daysUntilPayment;

                    const isOverdue =
                      daysUntilPayment !== null && daysUntilPayment < 0;

                    // Condición para clientes con más de 2 meses (60 días) de inactividad
                    const isLongTimeInactive =
                      daysUntilPayment !== null && daysUntilPayment <= -60;

                    // Verificar si hay pago este mes
                    const currentYear = today.getFullYear();
                    const currentMonth = today.getMonth();
                    const clientPaymentsThisMonth = payments.filter((p) => {
                      if (
                        p.client_id !== client.id ||
                        p.plan_id !== client.plan_id
                      )
                        return false;
                      const paymentDate = new Date(p.payment_date);
                      return (
                        paymentDate.getFullYear() === currentYear &&
                        paymentDate.getMonth() === currentMonth
                      );
                    });
                    const hasPaymentThisMonth =
                      clientPaymentsThisMonth.length > 0;

                    // Opción C: Status + Vencimiento + Pago del mes
                    // Habilitar botón cuando:
                    // - Cliente inactivo (siempre)
                    // - Cliente pendiente (siempre)
                    // - Cliente activo + vencido
                    // - Cliente activo + sin pagar este mes
                    // Deshabilitar cuando:
                    // - Cliente activo + NO vencido + YA pagó este mes
                    // Calcular el status del cliente
                    const clientStatus = getClientStatus(client);

                    const shouldDisableButton =
                      clientStatus.status === "activo" &&
                      !isOverdue &&
                      hasPaymentThisMonth;

                    // Calcular el índice real considerando la paginación
                    const realIndex = (currentPage - 1) * pageSize + index + 1;

                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium text-center">
                          {realIndex}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 flex-shrink-0">
                              {client.avatar_url ? (
                                <AvatarImage
                                  src={client.avatar_url}
                                  alt={`${client.first_name} ${client.last_name}`}
                                />
                              ) : null}
                              <AvatarFallback className="text-xs">
                                {getInitials(
                                  `${client.first_name} ${client.last_name}`,
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <TruncatedCell
                                value={`${client.first_name} ${client.last_name}`}
                                maxWidth="150px"
                                className="font-medium"
                              />
                              {isLongTimeInactive && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="relative inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tracking-wide bg-red-600 text-white cursor-help shrink-0 shadow-sm">
                                      <span className="absolute flex h-2 w-2 -top-1 -right-1">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border border-white"></span>
                                      </span>
                                      <AlertTriangle className="h-3.5 w-3.5 stroke-[2.5]" />
                                      &gt;2 meses
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Cliente con más de 60 días vencido.</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <IdCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span>{client.cedula}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {client.email ? (
                            <div className="flex items-center">
                              <TruncatedCell
                                value={client.email}
                                maxWidth="140px"
                                className="mr-1"
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-5 w-5 p-0 hover:bg-transparent flex-shrink-0"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        client.email,
                                      );
                                      toast.success("Email copiado");
                                    }}
                                    aria-label="Copiar email"
                                  >
                                    <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Copiar</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {client.phone ? (
                            <div className="flex items-center">
                              <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0 mr-1" />
                              <span className="mr-1">{client.phone}</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-5 w-5 p-0 hover:bg-transparent flex-shrink-0"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        client.phone,
                                      );
                                      toast.success("Teléfono copiado");
                                    }}
                                    aria-label="Copiar teléfono"
                                  >
                                    <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Copiar</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <TruncatedCell
                            value={client.plans?.name || "Sin plan"}
                            maxWidth="120px"
                            className="font-medium"
                          />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              clientStatus.status === "activo"
                                ? "bg-green-100 text-green-800"
                                : clientStatus.status === "pendiente"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {clientStatus.label}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell whitespace-nowrap">
                          {formatDate(client.join_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {client.next_payment_date ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {formatDate(client.next_payment_date)}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${client.paymentStatusColor}`}
                              >
                                {client.daysUntilPayment < 0
                                  ? `${Math.abs(client.daysUntilPayment)}d vencido`
                                  : `${client.daysUntilPayment}d`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Tooltip>
                              <TooltipContent>
                                <p>
                                  {shouldDisableButton
                                    ? "Pago al día"
                                    : paymentWithRemaining
                                      ? `Pagar restante ($${paymentWithRemaining.remainingFormatted})`
                                      : "Registrar pago"}
                                </p>
                              </TooltipContent>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    onClick={() =>
                                      handlePayRemainingForClient(client)
                                    }
                                    variant="default"
                                    size="icon-sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={shouldDisableButton}
                                    aria-label={`Registrar pago de ${client.first_name} ${client.last_name}`}
                                  >
                                    <DollarSignIcon />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handleOpenEditDialog(client)}
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={`Editar cliente ${client.first_name} ${client.last_name}`}
                                >
                                  <EditIcon />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Editar cliente</p>
                              </TooltipContent>
                            </Tooltip>
                            {isLongTimeInactive && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => openResetDialog(client)}
                                    variant="outline"
                                    size="icon-sm"
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                                    disabled={resettingId === client.id}
                                    aria-label={`Reiniciar historial de ${client.first_name} ${client.last_name}`}
                                  >
                                    {resettingId === client.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Reinicio de historial (Borrón y cuenta nueva)</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handleDeleteClick(client)}
                                  variant="destructive"
                                  size="icon-sm"
                                  disabled={deletingId === client.id}
                                  aria-label={`Eliminar cliente ${client.first_name} ${client.last_name}`}
                                >
                                  {deletingId === client.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <TrashIcon />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Eliminar cliente</p>
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
              totalItems={sortedClients.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
        </div>
      </div>

      {/* Dialog de confirmación de eliminación */}
      {/* Modal para reiniciar historial */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" aria-hidden="true" />
              Reiniciar Historial
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas reiniciar el historial de pagos para <span className="font-semibold text-foreground">{clientToReset?.first_name} {clientToReset?.last_name}</span>?
              Esto actualizará su fecha de ingreso y recalculará los pagos desde cero sin borrar el perfil.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reset_date" className="text-sm font-medium">
              Nueva Fecha de Inicio de Ciclo
            </Label>
            <Input
              id="reset_date"
              type="date"
              value={resetDate}
              onChange={(e) => setResetDate(e.target.value)}
              className="mt-2 text-sm"
              disabled={resettingId === clientToReset?.id}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsResetDialogOpen(false)}
              disabled={resettingId === clientToReset?.id}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleResetHistory}
              className="bg-amber-600 hover:bg-amber-700"
              disabled={resettingId === clientToReset?.id || !resetDate}
            >
              {resettingId === clientToReset?.id ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reiniciando...</>
              ) : (
                <><RotateCcw className="h-4 w-4 mr-2" /> Reiniciar Historial</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar cliente"
        description={
          clientToDelete
            ? `¿Estás seguro de que deseas eliminar a ${clientToDelete.first_name} ${clientToDelete.last_name}? Esta acción eliminará también todos sus pagos y registros de asistencia.`
            : "¿Estás seguro de que deseas eliminar este cliente?"
        }
        confirmText="Eliminar"
        variant="destructive"
        loading={deletingId !== null}
        onConfirm={handleDeleteClient}
        onCancel={() => setClientToDelete(null)}
      />

      {/* Modal para crear/editar cliente */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="tall-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" aria-hidden="true" />
              {isEditing ? "Editar Cliente" : "Nuevo Cliente"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modifica los datos del cliente."
                : "Completa el formulario para registrar un nuevo cliente."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="first_name"
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                placeholder="Juan"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">
                Apellido <span className="text-destructive">*</span>
              </Label>
              <Input
                id="last_name"
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                placeholder="Pérez"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cedula">
                Cédula <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-1">
                <Select
                  value={formData.cedula_type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, cedula_type: value }))
                  }
                >
                  <SelectTrigger
                    className="w-[70px] flex-shrink-0"
                    aria-label="Tipo de documento"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="font-medium">{type.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="cedula"
                  type="text"
                  name="cedula"
                  value={formData.cedula}
                  onChange={handleInputChange}
                  placeholder="12345678"
                  required
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                V: Venezolano, E: Extranjero, J: Jurídico, P: Pasaporte
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth_date">
                Fecha de Nacimiento <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                value={formData.birth_date}
                onChange={(value) =>
                  handleInputChange({ target: { name: "birth_date", value } })
                }
                placeholder="Seleccionar fecha"
                size="sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="cliente@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
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
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="1234567"
                  maxLength={7}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Digitel: 0412/0422, Movistar: 0414/0424, Movilnet: 0416/0426
              </p>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Calle Principal #123"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="observations">Observaciones</Label>
              <Textarea
                id="observations"
                name="observations"
                value={formData.observations}
                onChange={handleInputChange}
                rows={3}
                placeholder="Notas adicionales, alergias, condiciones médicas, preferencias, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar">Foto de Perfil</Label>
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  {photoPreview || formData.avatar_url ? (
                    <img
                      src={photoPreview || formData.avatar_url}
                      alt="Vista previa"
                      className="w-20 h-20 rounded-full object-cover border-2 border-muted"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-muted flex items-center justify-center">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    ref={fileInputRef}
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    disabled={uploadingPhoto}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sube una imagen para la foto de perfil del cliente (JPG, PNG, WEBP. Max 5MB)
                  </p>
                  {uploadingPhoto && (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Subiendo foto...
                    </p>
                  )}
                </div>
                {(photoPreview || formData.avatar_url) && !uploadingPhoto && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      clearPhotoSelection();
                      setFormData((prev) => ({ ...prev, avatar_url: "" }));
                    }}
                    className="h-8 w-8 p-0 text-destructive"
                    aria-label="Quitar foto"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan_id">Plan</Label>
              <Select
                value={formData.plan_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, plan_id: value }))
                }
                disabled={plansLoading}
              >
                <SelectTrigger id="plan_id">
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="join_date">
                Fecha de Ingreso <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                value={formData.join_date}
                onChange={(value) =>
                  handleInputChange({ target: { name: "join_date", value } })
                }
                placeholder="Seleccionar fecha"
                size="sm"
              />
            </div>
            <div className="flex items-center space-x-2 pt-4">
              <Switch
                id="enrollment_paid"
                checked={formData.enrollment_paid}
                onCheckedChange={handleEnrollmentPaidChange}
                disabled={isEditing && formData.enrollment_paid}
              />
              <Label htmlFor="enrollment_paid" className="text-sm font-normal">
                {isEditing
                  ? "Inscripción pagada"
                  : `Incluir inscripción ($${INSCRIPTION_PRICE})`}
              </Label>
            </div>
          </div>

          <DialogFooter>
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
              disabled={isSubmitting || plansLoading}
              loading={isSubmitting}
            >
              {isEditing ? "Actualizar Cliente" : "Guardar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
