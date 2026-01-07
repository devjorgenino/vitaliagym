"use client";

import { useState, useEffect, useRef } from "react";
import useAuth from "../../../hooks/useAuth";
import { Button } from "../../../components/ui/button";
import { toast } from "sonner";
import { Loader2, Camera, Upload } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { getInitials } from "../../../lib/getInitials";

const Perfil = () => {
  const { user, updateUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    role: ""
  });
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Cargar datos del usuario cuando el componente se monta
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user?.user_metadata?.full_name || "",
        phone: user?.user_metadata?.phone || "",
        role: user?.user_metadata?.role || "user"
      });
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
        phone: formData.phone,
        role: formData.role
      };

      await updateUserProfile(updateData);
      toast.success("Perfil actualizado correctamente");
      setIsEditing(false);
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      toast.error(error.message || "Error al actualizar el perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Restaurar valores originales
    if (user) {
      setFormData({
        full_name: user?.user_metadata?.full_name || "",
        phone: user?.user_metadata?.phone || "",
        role: user?.user_metadata?.role || "user"
      });
    }
    setIsEditing(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar el archivo
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor selecciona una imagen válida');
        return;
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB
        toast.error('La imagen no debe superar los 5MB');
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
          avatar_url: base64Url
        });

        if (result.success) {
          toast.success('Avatar actualizado correctamente');
          setAvatarPreview(null);
        } else {
          toast.error(result.error || 'Error al actualizar el avatar');
        }
        setAvatarLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error subiendo avatar:', error);
      toast.error('Error al actualizar el avatar');
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

  if (!user) {
    return (
      <div className="container mx-auto py-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Mi Perfil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
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
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Mi Perfil</CardTitle>
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
              >
                Editar Perfil
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button onClick={handleCancel} variant="outline" size="sm">
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  variant="default"
                  size="sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar"
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
                      src={avatarPreview || user?.user_metadata?.avatar_url || "/avatar.jpg"}
                      alt="Avatar"
                    />
                    <AvatarFallback className="text-lg">
                      {getInitials(user?.user_metadata?.full_name || "Usuario")}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <button
                      onClick={handleAvatarClick}
                      className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition-colors"
                      disabled={avatarLoading}
                    >
                      {avatarLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                {isEditing && avatarPreview && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={saveAvatar}
                      disabled={avatarLoading}
                      size="sm"
                    >
                      {avatarLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar Avatar"
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

              {/* Información básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Email
                  </label>
                  <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-900">
                    {user?.email || "N/A"}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    ID de Usuario
                  </label>
                  <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-900 font-mono text-sm">
                    {user?.id?.slice(0, 8) || "N/A"}...
                  </div>
                </div>
              </div>
              
              {/* Información editable */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Nombre Completo
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                      {formData.full_name || "No especificado"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Teléfono
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                      {formData.phone || "No especificado"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Rol
                  </label>
                  {isEditing ? (
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        formData.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {formData.role === 'admin' ? 'Administrador' : 'Usuario'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Información de sesión */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Información de Sesión</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Último Ingreso
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border-gray-200 rounded-md text-gray-900">
                      {user?.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : "Primer ingreso"
                      }
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Email Confirmado
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border-gray-200 rounded-md text-gray-900">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          user?.email_confirmed_at
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {user?.email_confirmed_at ? "Sí" : "No"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Fecha de creación */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Miembro desde
                </label>
                <div className="px-3 py-2 bg-gray-50 border-gray-200 rounded-md text-gray-900">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : "N/A"}
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