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
  LogIn,
  Fingerprint,
} from "lucide-react";
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
      if (!file.type.startsWith("image/")) {
        toast.error("Por favor selecciona una imagen válida");
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast.error("La imagen no debe superar los 2MB");
        return;
      }

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
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Url = e.target.result;

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
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Mi Perfil
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestiona tu información personal y preferencias de cuenta
          </p>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-card border rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <User className="h-5 w-5 text-primary" />
              Información Personal
            </div>

            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative flex-shrink-0">
                <Avatar className="w-24 h-24 sm:w-28 sm:h-28 ring-2 ring-border ring-offset-2 ring-offset-background">
                  <AvatarImage
                    src={
                      avatarPreview ||
                      user?.user_metadata?.avatar_url ||
                      "/avatar.jpg"
                    }
                    alt={`Foto de perfil de ${formData.full_name || "Usuario"}`}
                  />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {getInitials(user?.user_metadata?.full_name || "Usuario")}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <Button
                    variant="default"
                    size="icon"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-lg"
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

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="sr-only"
                  id="avatar-upload"
                  aria-label="Subir foto de perfil"
                />
              </div>

              <div className="flex-1 space-y-4 w-full">
                {isEditing && avatarPreview && (
                  <div className="flex gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Nueva imagen seleccionada</p>
                      <p className="text-xs text-muted-foreground">Preview disponible</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={saveAvatar}
                        disabled={avatarLoading}
                        size="sm"
                        className="gap-1"
                      >
                        {avatarLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                        Guardar
                      </Button>
                      <Button
                        onClick={() => setAvatarPreview(null)}
                        variant="outline"
                        size="sm"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-sm font-medium">
                      Nombre Completo
                      {isEditing && <span className="text-destructive ml-1">*</span>}
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
                        className="bg-background"
                      />
                    ) : (
                      <div className="px-3 py-2 text-sm">
                        {formData.full_name || (
                          <span className="text-muted-foreground italic">No especificado</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Email</Label>
                    <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{user?.email}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Teléfono
                </Label>
                {isEditing ? (
                  <div className="flex gap-2">
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
                      <SelectTrigger className="w-[90px] bg-background" aria-label="Operador telefónico">
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
                      className="flex-1 bg-background"
                    />
                  </div>
                ) : (
                  <div className="px-3 py-2 text-sm">
                    {formData.phone ? (
                      <span>{formData.phone_operator}-{formData.phone}</span>
                    ) : (
                      <span className="text-muted-foreground italic">No especificado</span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Rol
                </Label>
                {isEditing ? (
                  <Select
                    value={formData.role}
                    onValueChange={handleRoleChange}
                    disabled={loading}
                  >
                    <SelectTrigger id="role" className="w-full bg-background">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuario</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    variant={formData.role === "admin" ? "default" : "secondary"}
                    className="w-fit gap-1"
                  >
                    {formData.role === "admin" ? (
                      <>
                        <Shield className="h-3 w-3" />
                        Administrador
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3" />
                        Usuario
                      </>
                    )}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label className="text-sm font-medium text-muted-foreground">ID de Usuario</Label>
              <div className="px-3 py-2 font-mono text-xs text-muted-foreground bg-muted/50 rounded-lg">
                {user?.id}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-card border rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-primary" />
              Información de Sesión
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <LogIn className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Último Ingreso</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(user?.last_sign_in_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Fingerprint className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Estado del Email</p>
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
                        Pendiente de verificación
                      </>
                    )}
                  </Badge>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Miembro desde</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(user?.created_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-secondary/30 border rounded-xl p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                ¿Necesitas ayuda con tu cuenta?
              </p>
              <p className="text-xs text-muted-foreground">
                Contacta al administrador del sistema si tienes problemas con tu perfil o necesitas cambiar permisos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Perfil;
