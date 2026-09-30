import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function normalizeText(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function matchesSearch(searchTerm, ...fields) {
  if (!searchTerm || !searchTerm.trim()) return true;

  const searchTokens = normalizeText(searchTerm).trim().split(/\s+/);
  const combinedText = fields
    .filter(Boolean)
    .map((field) => normalizeText(field))
    .join(" ");

  return searchTokens.every((token) => combinedText.includes(token));
}

/**
 * Devuelve la fecha local actual en formato YYYY-MM-DD.
 * Evita el problema de `toISOString()` que devuelve UTC y puede causar
 * un desfase de un día en zonas horarias con offset negativo (ej: Venezuela UTC-4).
 */
export function formatDateToLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(dateString) {
  if (!dateString) return "N/A";
  let date;
  if (typeof dateString === "string" && dateString.length === 10 && dateString.includes("-")) {
    const parts = dateString.split("-");
    date = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    );
  } else {
    date = new Date(dateString);
  }
  return date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
