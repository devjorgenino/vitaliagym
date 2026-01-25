"use client";

import { useState, useEffect, useRef } from "react";
import useAuth from "../../../hooks/useAuth";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Camera,
  Upload,
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  X,
  Save,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../../components/ui/avatar";
import { getInitials } from "../../../lib/getInitials";
import {
  PHONE_OPERATORS,
  formatPhone,
  parsePhone,
} from "../../../lib/venezuelanData";

const Perfil = () => {
  const { user, updateUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone_operator: "0414",
    phone: "",
    role: "",
  });
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Cargar datos del usuario cuando el componente se monta
  useEffect(() => {
    if (user) {
      const phoneValue = user?.user_metadata?.phone || "";
      const { operator, number } = parsePhone(phoneValue);
      setFormData({
        full_name: user?.user_metadata?.full_name || "",
        phone_operator: operator,
        phone: number,
        role: user?.user_metadata?.role || "user",
      });
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRoleChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      role: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        full_name: formData.full_name,
        phone: formData.phone
          ? formatPhone(formData.phone_operator, formData.phone)
          : "",
        role: formData.role,
      };

      await updateUserProfile(updateData);
      toast.success("Perfil actualizado correctamente");
      setIsEditing(false);
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      toast.error(error.message || "Error al actualizar el perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Restaurar valores originales
    if (user) {
      const phoneValue = user?.user_metadata?.phone || "";
      const { operator, number } = parsePhone(phoneValue);
      setFormData({
        full_name: user?.user_metadata?.full_name || "",
        phone_operator: operator,
        phone: number,
        role: user?.user_metadata?.role || "user",
      });
    }
    setAvatarPreview(null);
    setIsEditing(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar el archivo
      if (!file.type.startsWith("image/")) {
        toast.error("Por favor selecciona una imagen válida");
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        // 2MB
        toast.error("La imagen no debe superar los 2MB");
        return;
      }

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (file) => {
    setAvatarLoading(true);
    try {
      // Para simplificar, convertiremos la imagen a base64 y la guardaremos en metadata
      // En producción, deberías usar un servicio de almacenamiento como S3, Cloudinary, etc.
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Url = e.target.result;

        // Actualizar el perfil con la URL base64 del avatar
        const result = await updateUserProfile({
          avatar_url: base64Url,
        });

        if (result.success) {
          toast.success("Avatar actualizado correctamente");
          setAvatarPreview(null);
        } else {
          toast.error(result.error || "Error al actualizar el avatar");
        }
        setAvatarLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error subiendo avatar:", error);
      toast.error("Error al actualizar el avatar");
      setAvatarLoading(false);
    }
  };

  const saveAvatar = async () => {
    if (!avatarPreview) return;

    const fileInput = fileInputRef.current;
    if (fileInput && fileInput.files[0]) {
      await uploadAvatar(fileInput.files[0]);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    // Si es solo fecha (YYYY-MM-DD), parsear manualmente para evitar desfase de zona horaria
    // Si incluye hora (ISO timestamp), usar new Date() normalmente
    let date;
    if (dateString.length === 10 && dateString.includes("-")) {
      const parts = dateString.split("-");
      date = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
      );
    } else {
      date = new Date(dateString);
    }
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "Primer ingreso";
    return new Date(dateString).toLocaleString("es-ES", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) {
    return (
      <div className="container mx-auto py-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Mi Perfil</CardTitle>
              <CardDescription>
                Cargando información del usuario...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="space-y-4"
                role="status"
                aria-label="Cargando perfil"
              >
                <div className="flex justify-center">
                  <Skeleton className="h-24 w-24 rounded-full" />
                </div>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Mi Perfil</h1>
          <p className="text-muted-foreground">
            Gestiona tu información personal y preferencias de cuenta
          </p>
        </div>

        {/* Card principal */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" aria-hidden="true" />
                Información Personal
              </CardTitle>
              <CardDescription>
                {isEditing
                  ? "Modifica tus datos y guarda los cambios"
                  : "Haz clic en Editar para modificar tu información"}
              </CardDescription>
            </div>
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="gap-2 w-fit"
              >
                <Edit3 className="h-4 w-4" />
                Editar Perfil
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  size="sm"
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Guardar
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage
                      src={
                        avatarPreview ||
                        user?.user_metadata?.avatar_url ||
                        "/avatar.jpg"
                      }
                      alt={`Foto de perfil de ${formData.full_name || "Usuario"}`}
                      loading="lazy"
                    />
                    <AvatarFallback className="text-lg bg-primary/10 text-primary">
                      {getInitials(user?.user_metadata?.full_name || "Usuario")}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <Button
                      variant="default"
                      size="icon"
                      className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                      onClick={handleAvatarClick}
                      disabled={avatarLoading}
                      aria-label="Cambiar foto de perfil"
                    >
                      {avatarLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>

                {/* Input de archivo accesible */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="sr-only"
                  id="avatar-upload"
                  aria-label="Subir foto de perfil"
                />

                {isEditing && !avatarPreview && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Haz clic en el icono de cámara para cambiar tu foto
                  </p>
                )}

                {isEditing && avatarPreview && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={saveAvatar}
                      disabled={avatarLoading}
                      size="sm"
                      className="gap-2"
                    >
                      {avatarLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Guardar Avatar
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setAvatarPreview(null)}
                      variant="outline"
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>

              {/* Información de solo lectura */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Email
                  </Label>
                  <div className="px-3 py-2 bg-muted/50 border rounded-md text-sm">
                    {user?.email || "N/A"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">ID de Usuario</Label>
                  <div className="px-3 py-2 bg-muted/50 border rounded-md font-mono text-xs">
                    {user?.id?.slice(0, 8) || "N/A"}...
                  </div>
                </div>
              </div>

              {/* Información editable */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="full_name"
                    className="flex items-center gap-2"
                  >
                    <User className="h-4 w-4" aria-hidden="true" />
                    Nombre Completo
                    {isEditing && <span className="text-destructive">*</span>}
                  </Label>
                  {isEditing ? (
                    <Input
                      id="full_name"
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      placeholder="Ingresa tu nombre completo"
                      disabled={loading}
                      aria-required="true"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-muted/30 border rounded-md">
                      {formData.full_name || (
                        <span className="text-muted-foreground italic">
                          No especificado
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Teléfono
                  </Label>
                  {isEditing ? (
                    <div className="flex gap-1">
                      <Select
                        value={formData.phone_operator}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            phone_operator: value,
                          }))
                        }
                        disabled={loading}
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
                        disabled={loading}
                        className="flex-1"
                      />
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-muted/30 border rounded-md">
                      {formData.phone ? (
                        <span>
                          {formData.phone_operator}-{formData.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          No especificado
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" aria-hidden="true" />
                    Rol
                  </Label>
                  {isEditing ? (
                    <Select
                      value={formData.role}
                      onValueChange={handleRoleChange}
                      disabled={loading}
                    >
                      <SelectTrigger id="role" className="w-full">
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuario</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="px-3 py-2 bg-muted/30 border rounded-md">
                      <Badge
                        variant={
                          formData.role === "admin" ? "default" : "secondary"
                        }
                      >
                        {formData.role === "admin"
                          ? "Administrador"
                          : "Usuario"}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información de sesión */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" aria-hidden="true" />
              Información de Sesión
            </CardTitle>
            <CardDescription>
              Detalles sobre tu cuenta y actividad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Último Ingreso</Label>
                <div className="px-3 py-2 bg-muted/30 border rounded-md text-sm">
                  {formatDateTime(user?.last_sign_in_at)}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Email Verificado
                </Label>
                <div className="px-3 py-2 bg-muted/30 border rounded-md">
                  <Badge
                    variant={user?.email_confirmed_at ? "default" : "secondary"}
                    className="gap-1"
                  >
                    {user?.email_confirmed_at ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Verificado
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        Pendiente
                      </>
                    )}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  Miembro desde
                </Label>
                <div className="px-3 py-2 bg-muted/30 border rounded-md text-sm">
                  {formatDate(user?.created_at)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Perfil;
