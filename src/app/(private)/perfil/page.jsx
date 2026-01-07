"use client";

import { useState, useEffect } from "react";
import useAuth from "../../../hooks/useAuth";
import { Button } from "../../../components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";

const Perfil = () => {
  const { user, updateUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    role: ""
  });
  const [loading, setLoading] = useState(false);

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