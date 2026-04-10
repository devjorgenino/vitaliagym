"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useCoaches } from "@/hooks/useCoaches";
import { isUserAdmin } from "@/lib/user-utils";
import { formatDate } from "@/lib/utils";
import { Dumbbell, Clock, Users, FilterXIcon, RefreshCw, SearchIcon, EditIcon, ChevronRight, ChevronDown, UserCog, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  SearchEmptyState,
} from "@/components/ui/empty-state";

const Trainings = () => {
  const { workouts, loading, error, refetch } = useWorkouts();
  const { coaches } = useCoaches();
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [groupByCoach, setGroupByCoach] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    ejercicios: "",
    duracion: "",
    nivel: "",
    entrenadore: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const admin = await isUserAdmin();
      setIsAdmin(admin);
    };
    checkAdmin();
  }, []);

  const toggleGroup = (coachId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [coachId]: !prev[coachId],
    }));
  };

  const handleOpenCreateDialog = () => {
    setFormData({
      nombre: "",
      descripcion: "",
      ejercicios: "",
      duracion: "",
      nivel: "",
      entrenadore: "",
    });
    setSelectedWorkout(null);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (workout) => {
    setFormData({
      nombre: workout.properties.nombre || "",
      descripcion: workout.properties.descripcion || "",
      ejercicios: workout.properties.ejercicios || "",
      duracion: workout.properties.duracion?.toString() || "",
      nivel: workout.properties.nivel || "",
      entrenadore: workout.properties.entrenadore?.[0]?.name || "",
    });
    setSelectedWorkout(workout);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedWorkout(null);
    setIsEditing(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEditing && selectedWorkout
        ? `/api/notion/workouts?id=${selectedWorkout.id}`
        : "/api/notion/workouts";
      
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al guardar");
      }

      handleCloseDialog();
      refetch();
    } catch (err) {
      console.error("Error saving workout:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredWorkouts = useMemo(() => {
    return workouts.filter((workout) => {
      const matchesSearch =
        searchTerm === "" ||
        workout.properties.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workout.properties.descripcion.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesLevel =
        levelFilter === "" || workout.properties.nivel === levelFilter;

      return matchesSearch && matchesLevel;
    });
  }, [workouts, searchTerm, levelFilter]);

  const clearFilters = () => {
    setSearchTerm("");
    setLevelFilter("");
  };

  const activeFiltersCount = [levelFilter].filter(
    (f) => f !== ""
  ).length;

  const workoutsByCoach = useMemo(() => {
    const grouped = {};
    filteredWorkouts.forEach((workout) => {
      const coachName = workout.properties.entrenadore;
      if (typeof coachName === "string" && coachName.trim()) {
        const name = coachName.trim();
        if (!grouped[name]) {
          grouped[name] = {
            coach: { id: name, name: name },
            workouts: [],
          };
        }
        grouped[name].workouts.push(workout);
      } else {
        if (!grouped["sin_entrenador"]) {
          grouped["sin_entrenador"] = {
            coach: { id: "sin_entrenador", name: "Sin Entrenador" },
            workouts: [],
          };
        }
        grouped["sin_entrenador"].workouts.push(workout);
      }
    });
    return grouped;
  }, [filteredWorkouts]);

  const uniqueLevels = useMemo(() => {
    const levels = new Set();
    workouts.forEach((w) => {
      if (w.properties.nivel) levels.add(w.properties.nivel);
    });
    return Array.from(levels).sort();
  }, [workouts]);

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold flex items-center gap-2">
            <Dumbbell className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span>Entrenamientos</span>
          </h2>
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
            <Dumbbell className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span>Entrenamientos</span>
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
          <Dumbbell className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <span>
            Entrenamientos ({filteredWorkouts.length}
            {filteredWorkouts.length !== workouts.length
              ? ` de ${workouts.length}`
              : ""})
          </span>
        </h2>
        <div className="flex gap-2">
          <Button
            onClick={refetch}
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
            aria-label="Actualizar lista de entrenamientos"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" aria-hidden="true" />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button
            onClick={handleOpenCreateDialog}
            variant="default"
            size="sm"
            className="text-xs sm:text-sm"
            aria-label="Crear nuevo entrenamiento"
          >
            <Plus className="h-3.5 w-3.5 sm:mr-1.5" aria-hidden="true" />
            <span className="hidden sm:inline">Nuevo</span>
          </Button>
        </div>
      </div>

      <div className="p-3 sm:p-4 pt-0">
        <div className="mb-3 sm:mb-4 space-y-3 sm:space-y-4">
          <div className="relative">
            <SearchIcon
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"
              aria-hidden="true"
            />
            <Input
              type="text"
              placeholder="Buscar por nombre o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
              aria-label="Buscar entrenamientos"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              Filtros:
            </span>

            {isAdmin && (
              <Button
                variant={groupByCoach ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setGroupByCoach(!groupByCoach)}
              >
                <UserCog className="h-3.5 w-3.5 mr-1" />
                Por Entrenador
              </Button>
            )}

            <Select
              value={levelFilter}
              onValueChange={(value) =>
                setLevelFilter(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[120px] sm:w-[150px] h-8 text-xs sm:text-sm">
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los niveles</SelectItem>
                {uniqueLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
        </div>

        {workouts.length === 0 ? (
          <EmptyState
            title="No hay entrenamientos disponibles"
            description="Los entrenamientos se cargan desde Notion. Configure la integración para comenzar."
            icon={Dumbbell}
          />
        ) : filteredWorkouts.length === 0 ? (
          <SearchEmptyState
            searchTerm={searchTerm}
            entityName="entrenamientos"
            onClear={clearFilters}
          />
        ) : (
          <>
            {groupByCoach && Object.keys(workoutsByCoach).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(workoutsByCoach).map(([coachId, groupData]) => (
                  <div key={coachId} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleGroup(coachId)}
                      className="w-full flex items-center gap-2 p-3 bg-muted hover:bg-muted/80 transition-colors text-left"
                    >
                      {expandedGroups[coachId] ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      )}
                      <UserCog className="h-4 w-4" />
                      <span className="font-medium">{groupData.coach.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {groupData.workouts.length} entrenamiento
                        {groupData.workouts.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                    {expandedGroups[coachId] && (
                      <div className="p-3 border-t bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Nombre</TableHead>
                              <TableHead className="hidden sm:table-cell">Nivel</TableHead>
                              <TableHead className="hidden lg:table-cell">Duración</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupData.workouts.map((workout, idx) => (
                              <TableRow key={workout.id}>
                                <TableCell className="font-medium text-center">
                                  {idx + 1}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {workout.properties.nombre}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  {workout.properties.nivel || "-"}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {workout.properties.duracion
                                    ? `${workout.properties.duracion} min`
                                    : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table aria-label="Lista de entrenamientos">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Descripción
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Nivel
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Duración
                    </TableHead>
                    <TableHead className="w-20">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkouts.map((workout, index) => (
                    <TableRow key={workout.id}>
                      <TableCell className="font-medium text-center">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {workout.properties.nombre}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px]">
                        <div className="truncate" title={workout.properties.descripcion}>
                          {workout.properties.descripcion || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {workout.properties.nivel ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                            {workout.properties.nivel}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {workout.properties.duracion ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{workout.properties.duracion} min</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditDialog(workout)}
                          className="h-8 w-8 p-0"
                        >
                          <EditIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}
          </>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" aria-hidden="true" />
              {isEditing ? "Editar Entrenamiento" : "Nuevo Entrenamiento"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modifica los datos del entrenamiento."
                : "Completa el formulario para crear un nuevo entrenamiento."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleInputChange}
                placeholder="Nombre del entrenamiento"
                required
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                name="descripcion"
                value={formData.descripcion}
                onChange={handleInputChange}
                placeholder="Descripción del entrenamiento"
                rows={2}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="ejercicios">Ejercicios</Label>
              <Textarea
                id="ejercicios"
                name="ejercicios"
                value={formData.ejercicios}
                onChange={handleInputChange}
                placeholder="Lista de ejercicios..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duracion">Duración (minutos)</Label>
              <Input
                id="duracion"
                name="duracion"
                type="number"
                value={formData.duracion}
                onChange={handleInputChange}
                placeholder="30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nivel">Nivel</Label>
              <Select
                value={formData.nivel}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, nivel: value }))
                }
              >
                <SelectTrigger id="nivel">
                  <SelectValue placeholder="Seleccionar nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Principiante">Principiante</SelectItem>
                  <SelectItem value="Intermedio">Intermedio</SelectItem>
                  <SelectItem value="Avanzado">Avanzado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="entrenadore">Entrenador</Label>
              <Select
                value={formData.entrenadore}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, entrenadore: value }))
                }
              >
                <SelectTrigger id="entrenadore">
                  <SelectValue placeholder="Seleccionar entrenador" />
                </SelectTrigger>
                <SelectContent>
                  {coaches?.map((coach) => (
                    <SelectItem key={coach.id} value={coach.full_name || coach.email}>
                      {coach.full_name || coach.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={isSubmitting || !formData.nombre.trim()}
              loading={isSubmitting}
            >
              {isEditing ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default Trainings;