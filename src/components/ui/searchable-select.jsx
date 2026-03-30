"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SearchableSelect - Un componente select con búsqueda integrada
 * 
 * @param {Object} props
 * @param {Array} props.options - Array de opciones { value, label, searchTerms? }
 * @param {string} props.value - Valor seleccionado
 * @param {function} props.onValueChange - Callback cuando cambia el valor
 * @param {string} props.placeholder - Placeholder del trigger
 * @param {string} props.searchPlaceholder - Placeholder del input de búsqueda
 * @param {boolean} props.disabled - Si está deshabilitado
 * @param {string} props.className - Clases adicionales
 * @param {string} props.id - ID del componente
 * @param {function} props.renderOption - Función para renderizar opciones personalizadas
 * @param {function} props.renderValue - Función para renderizar el valor seleccionado
 * @param {string} props.emptyMessage - Mensaje cuando no hay resultados
 */
export function SearchableSelect({
  options = [],
  value,
  onValueChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  disabled = false,
  className,
  id,
  renderOption,
  renderValue,
  emptyMessage = "No se encontraron resultados",
  "aria-label": ariaLabel,
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  
  const containerRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);

  // Encontrar la opción seleccionada
  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filtrar opciones basado en búsqueda
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) return options;
    
    const search = searchTerm.toLowerCase().trim();
    return options.filter((opt) => {
      // Buscar en label
      if (opt.label.toLowerCase().includes(search)) return true;
      // Buscar en searchTerms adicionales si existen
      if (opt.searchTerms) {
        return opt.searchTerms.some((term) =>
          term.toLowerCase().includes(search)
        );
      }
      return false;
    });
  }, [options, searchTerm]);

  // Reset highlighted index cuando cambian las opciones filtradas
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions.length]);

  // Cerrar al hacer click fuera
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Focus en input al abrir
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll al item highlighted
  React.useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedElement = listRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      );
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (event) => {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;

      case "ArrowUp":
        event.preventDefault();
        if (isOpen) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        }
        break;

      case "Enter":
        event.preventDefault();
        if (isOpen && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;

      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        setSearchTerm("");
        break;

      case "Tab":
        setIsOpen(false);
        setSearchTerm("");
        break;

      default:
        break;
    }
  };

  const handleSelect = (selectedValue) => {
    onValueChange?.(selectedValue);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (event) => {
    event.stopPropagation();
    onValueChange?.("");
    setSearchTerm("");
  };

  const handleTriggerClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm("");
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        onClick={handleTriggerClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border bg-transparent",
          "px-3 py-2 text-sm",
          "h-9",
          "border-input",
          "shadow-xs",
          "transition-colors duration-100",
          "outline-none",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          disabled && "bg-muted",
          isOpen && "border-ring ring-2 ring-ring/30"
        )}
      >
        <span
          className={cn(
            "flex-1 text-left truncate",
            !selectedOption && "text-muted-foreground"
          )}
        >
          {selectedOption
            ? renderValue
              ? renderValue(selectedOption)
              : selectedOption.label
            : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 hover:bg-accent rounded transition-colors"
              aria-label="Limpiar selección"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-100",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 w-full mt-1",
            "bg-popover text-popover-foreground",
            "rounded-md border shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          {/* Search Input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  "w-full pl-8 pr-3 py-2 text-sm",
                  "bg-transparent",
                  "border rounded-md border-input",
                  "outline-none",
                  "focus:border-ring focus:ring-2 focus:ring-ring/30",
                  "placeholder:text-muted-foreground"
                )}
                aria-label="Buscar opciones"
                autoComplete="off"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-accent rounded"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <ul
            ref={listRef}
            role="listbox"
            aria-label="Opciones disponibles"
            className="max-h-[200px] overflow-y-auto p-1 scrollbar-thin"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-6 text-sm text-muted-foreground text-center">
                {emptyMessage}
              </li>
            ) : (
              filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  data-index={index}
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "relative flex items-center gap-2 rounded-sm",
                    "px-3 py-2 text-sm",
                    "cursor-pointer select-none",
                    "transition-colors duration-75",
                    index === highlightedIndex && "bg-accent",
                    option.value === value && "font-medium"
                  )}
                >
                  {/* Checkmark for selected */}
                  <span className="w-4 flex-shrink-0">
                    {option.value === value && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </span>
                  
                  {/* Option content */}
                  <span className="flex-1 truncate">
                    {renderOption ? renderOption(option) : option.label}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
