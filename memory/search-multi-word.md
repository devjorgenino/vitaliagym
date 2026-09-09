---
name: search-multi-word
description: Mejorar búsquedas para soportar múltiples palabras y acentos
metadata:
  type: project
---

Se requiere implementar una función de búsqueda robusta que soporte:
1. Multi-palabra: Dividir la búsqueda por espacios y verificar que todas las palabras coincidan (`AND` lógico).
2. Normalización: Eliminar acentos y convertir todo a minúsculas para comparaciones insensibles.

**Why:** Las búsquedas actuales no permiten buscar "Nombre Apellido", solo campos individuales.
**How to apply:** Crear `src/lib/searchUtils.js` con `matchSearch(dataField, searchTerm)` y reemplazar en todos los `includes(searchTerm)` de los componentes.
Related: [[search-multi-word]]
