import React, { useState } from "react";
import { useExchangeRate } from "../../hooks/useExchangeRate";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { BCVIcon } from "../ui/icons";
import { toast } from "sonner";
import { Edit2Icon, CheckIcon, X, AlertCircleIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

import { useEffect } from "react";

export function ExchangeRateCard({ compact = false }) {
  const {
    rate,
    loading,
    error,
    isManualRate,
    setManualRate,
    resetToAutomatic,
  } = useExchangeRate();
  const [isEditing, setIsEditing] = useState(false);
  const [tempRate, setTempRate] = useState("");

  // Activar automáticamente el modo edición si hay error y no está en modo manual
  useEffect(() => {
    if (error && !isManualRate && !isEditing) {
      requestAnimationFrame(() => {
        setTempRate(rate ? rate.toString() : "");
        setIsEditing(true);
      });
      toast.error(
        "Error al obtener tasa BCV. Por favor, ingrese una tasa manual."
      );
    }
  }, [error, isManualRate, isEditing, rate]);

  const handleEdit = () => {
    setTempRate(rate ? rate.toString() : "");
    setIsEditing(true);
  };

  const handleSave = () => {
    const newRate = parseFloat(tempRate);
    if (isNaN(newRate) || newRate <= 0) {
      toast.error("Por favor ingrese una tasa válida mayor a 0");
      return;
    }
    setManualRate(newRate);
    setIsEditing(false);
    toast.success("Tasa BCV actualizada exitosamente");
  };

  const handleCancel = () => {
    setTempRate("");
    setIsEditing(false);
  };

  const handleReset = () => {
    resetToAutomatic();
    setIsEditing(false);
    toast.success("Tasa BCV reiniciada a automática");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (compact) {
    // Versión compacta para el header
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg ${
          error ? "bg-secondary" : "bg-background"
        }`}
      >
        <div className="flex items-center gap-1">
          <BCVIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
            Tasa del Día:
          </span>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={tempRate}
              onChange={(e) => setTempRate(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Tasa..."
              className="w-24 h-8 text-sm focus:bg-white"
              min="0"
              step="0.01"
            />
            <Button onClick={handleSave} size="sm" className="h-8 px-2">
              <CheckIcon className="h-3 w-3" />
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
              className="h-8 px-2"
            >
              <X className="h-3 w-3" />
            </Button>
            {isManualRate && (
              <Button
                onClick={handleReset}
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-blue-600 hover:text-blue-700"
                title="Restablecer automático"
              >
                🔄
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary text-sm">
              {loading
                ? "Cargando..."
                : rate
                ? `Bs. ${rate.toFixed(2)}`
                : "N/A"}
            </span>
            {error ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 cursor-help">
                    Error <AlertCircleIcon className="h-3 w-3 inline ml-1" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Error al conectar con APIs</p>
                  <p className="text-xs text-muted-foreground">
                    Ingrese tasa manualmente
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  isManualRate
                    ? "bg-blue-100 text-blue-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {isManualRate ? "Manual" : "Auto"}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="h-8 w-8 p-0"
              title="Editar tasa"
            >
              <Edit2Icon className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BCVIcon className="h-5 w-5" />
            Tasa del Día BCV
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Cargando...</div>
          <p className="text-xs text-muted-foreground mt-1">
            Obteniendo tasa actual
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BCVIcon className="h-5 w-5" />
          Tasa del Día BCV
        </CardTitle>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="h-8 w-8 p-0"
          >
            <Edit2Icon className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={tempRate}
                onChange={(e) => setTempRate(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ingrese tasa..."
                className="flex-1 focus:bg-white"
                min="0"
                step="0.01"
              />
              <Button onClick={handleSave} size="sm" className="h-8 px-2">
                <CheckIcon className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
                className="h-8 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {isManualRate && (
              <Button
                onClick={handleReset}
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2 text-blue-600 hover:text-blue-700"
              >
                Restablecer automático
              </Button>
            )}
          </div>
        ) : (
          <div>
            <div className="text-2xl font-bold text-primary">
              {rate ? `Bs. ${rate.toFixed(2)}` : "No disponible"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isManualRate
                ? "📝 Tasa manual"
                : error
                ? `⚠️ ${error}`
                : "🔄 Tasa automática"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
