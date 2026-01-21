import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

/**
 * Componente de paginación reutilizable con soporte para:
 * - Navegación por páginas
 * - Selección de elementos por página
 * - Información de rango mostrado
 * - Accesibilidad completa
 */

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 50];

function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
  showPageSizeSelector = true,
  showInfo = true,
  siblingCount = 1,
}) {
  const totalPages = Math.ceil(totalItems / pageSize);

  // Calcular rango de items mostrados
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generar array de páginas a mostrar
  const generatePages = () => {
    const pages = [];

    // Siempre mostrar primera página
    pages.push(1);

    // Calcular rango de páginas alrededor de la actual
    const leftSibling = Math.max(currentPage - siblingCount, 2);
    const rightSibling = Math.min(currentPage + siblingCount, totalPages - 1);

    // Agregar ellipsis después de la primera página si es necesario
    if (leftSibling > 2) {
      pages.push("...");
    }

    // Agregar páginas del rango
    for (let i = leftSibling; i <= rightSibling; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    // Agregar ellipsis antes de la última página si es necesario
    if (rightSibling < totalPages - 1) {
      pages.push("...");
    }

    // Agregar última página si hay más de una
    if (totalPages > 1 && !pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = generatePages();

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const handlePageSizeChange = (value) => {
    const newSize = parseInt(value, 10);
    onPageSizeChange(newSize);
    // Resetear a página 1 cuando cambia el tamaño
    onPageChange(1);
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <nav
      role="navigation"
      aria-label="Paginación"
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 py-4",
        className,
      )}
    >
      {/* Información de rango */}
      {showInfo && (
        <div className="text-sm text-muted-foreground order-2 sm:order-1">
          Mostrando{" "}
          <span className="font-medium text-foreground">{startItem}</span> -{" "}
          <span className="font-medium text-foreground">{endItem}</span> de{" "}
          <span className="font-medium text-foreground">{totalItems}</span>{" "}
          resultados
        </div>
      )}

      {/* Controles de paginación */}
      <div className="flex items-center gap-2 order-1 sm:order-2">
        {/* Selector de tamaño de página */}
        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="page-size"
              className="text-sm text-muted-foreground hidden sm:inline"
            >
              Por página:
            </label>
            <Select
              value={pageSize.toString()}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger
                id="page-size"
                className="w-[70px] h-8"
                aria-label="Elementos por página"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Botones de navegación */}
        <div className="flex items-center gap-1">
          {/* Ir a primera página */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            aria-label="Ir a la primera página"
            title="Primera página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          {/* Página anterior */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Ir a la página anterior"
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Números de página */}
          <div className="hidden sm:flex items-center gap-1">
            {pages.map((page, index) =>
              page === "..." ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-muted-foreground"
                  aria-hidden="true"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="icon-sm"
                  onClick={() => goToPage(page)}
                  aria-label={`Ir a la página ${page}`}
                  aria-current={currentPage === page ? "page" : undefined}
                >
                  {page}
                </Button>
              ),
            )}
          </div>

          {/* Indicador de página actual en móvil */}
          <span className="sm:hidden px-2 text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>

          {/* Página siguiente */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Ir a la página siguiente"
            title="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Ir a última página */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Ir a la última página"
            title="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

/**
 * Hook para manejar el estado de paginación
 * @param {number} initialPageSize - Tamaño inicial de página
 * @returns {Object} - Estado y funciones de paginación
 */
function usePagination(initialPageSize = 10) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const resetPage = React.useCallback(() => {
    setCurrentPage(1);
  }, []);

  const paginateData = React.useCallback(
    (data) => {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      return data.slice(startIndex, endIndex);
    },
    [currentPage, pageSize],
  );

  return {
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    resetPage,
    paginateData,
  };
}

export { Pagination, usePagination, PAGE_SIZE_OPTIONS };
