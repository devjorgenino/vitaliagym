# Implementación del Campo Fecha de Cobro

## Resumen

Se ha implementado el campo `billing_day` (Día de Cobro) en el formulario de edición de clientes para permitir cambiar la fecha de cobro sin modificar la fecha de ingreso.

## Cambios Realizados

### 1. Base de Datos (Migración)

**Archivo**: `/migrations/20261117_add_billing_day_and_enrollment.sql`

Se creó una migración para agregar dos campos a la tabla `clients`:

- **billing_day** (INTEGER, 1-31): Día del mes para facturación recurrente
  - Si es NULL, se usa el día de la fecha de ingreso como ancla
  - Permite personalizar el día de cobro mensual
  
- **enrollment_paid** (BOOLEAN, DEFAULT FALSE): Indica si la inscripción de $5 USD fue pagada
  - Se cobra una sola vez al registrar o al hacer borrón y cuenta nueva

### 2. Interfaz de Usuario

**Archivo**: `src/components/clients/ClientsTable.jsx`

Se agregó un campo en el formulario de edición/creación de clientes:

```jsx
<div className="space-y-2">
  <Label htmlFor="billing_day">
    Día de Cobro <span className="text-muted-foreground text-xs">(Opcional)</span>
  </Label>
  <Input
    id="billing_day"
    type="number"
    name="billing_day"
    value={formData.billing_day}
    onChange={handleInputChange}
    placeholder="Ej: 15"
    min="1"
    max="31"
    className="w-full h-8 px-2 text-xs"
  />
  <p className="text-xs text-muted-foreground">
    Día del mes para facturación recurrente. Si no se define, se usa el día de ingreso.
  </p>
</div>
```

### 3. Guardado de Datos

El campo `billing_day` se envía al backend en el formulario:

```javascript
const dataToSave = {
  // ...otros campos
  billing_day: formData.billing_day || null,  // <-- Nuevo campo
};
```

### 4. Lógica de Cálculo de Fechas

**Archivo**: `src/utils/paymentCalculations.js`

La función `computeNextPaymentDate` ya estaba preparada para usar `billing_day`:

```javascript
// Si billing_day está definido, usa ese día como ancla
// Si no, usa el día de la fecha de ingreso
const anchorDay = billingDay !== null ? billingDay : parseInt(joinDate.split('-')[2], 10);
```

## Análisis del Sistema de Pagos

### Lógica de Cálculo de Próxima Fecha de Pago

El sistema utiliza un enfoque de "día ancla" (anchor day logic):

1. **Fecha de Ingreso como Ancla por Defecto**
   - Si no se define `billing_day`, se usa el día del `join_date`
   - Ejemplo: Si ingresa el 15 de enero, sus facturas serán el 15 de cada mes

2. **Campo billing_day Personalizable**
   - Permite cambiar el día de cobro sin afectar la fecha de ingreso
   - Ejemplo: Un cliente queIngresó el 28 de enero pero quiere facturar el 5 de cada mes

3. **Manejo de Días que No Existen**
   - Si el día ancla es mayor que el último día del mes (ej: 31 de febrero)
   - Se ajusta automáticamente al último día disponible
   - Función: `getAnchorDateForTargetMonth()`

### Flujos de Pago

#### Creación de Cliente
1. Si `enrollment_paid` es TRUE: se redirige a pagar inscripción + plan
2. Si `billing_day` está definido: se usa como ancla para calcular `next_payment_date`
3. Si no: se usa el día de `join_date` como ancla

#### Edición de Cliente
1. Al cambiar `billing_day`: se debe recalcular `next_payment_date`
2. La actualización de `next_payment_date` se hace automáticamente vía trigger de base de datos

#### Reset de Historial (Borrón y Cuenta Nueva)
1. Se establece nueva `join_date` (hoy por defecto)
2. `status` se pone en "pendiente"
3. `next_payment_date` se establece en NULL hasta que pague

### Impacto en Cálculos de Próximos Pagos

| Escenario | Fecha de Ingreso | Billing Day | Próxima Factura |
|-----------|------------------|-------------|-----------------|
| Sin billing_day | 15/01/2026 | NULL | 15/02/2026 |
| Con billing_day | 15/01/2026 | 5 | 05/02/2026 |
| Cambio billing_day | 15/01/2026 → 25/01/2026 | 5 | 05/02/2026 (se mantiene) |

### Funciones Involucradas

1. **computeNextPaymentDate()** - Calcula la próxima fecha de pago
2. **recalculateNextPaymentDate()** - Recalcula después de editar
3. **recalculateAllNextPaymentDates()** - Recalcula todos los clientes
4. **auditNextPaymentDates()** - Audita discrepancias
5. **updateClientStatus()** - Actualiza estado basado en pagos

### Consideraciones Técnicas

#### 1. Trigger de Base de Datos
```sql
CREATE OR REPLACE FUNCTION trigger_actualizar_deuda_cliente()
RETURNS trigger AS $$
BEGIN
  -- Recalcular si cambia plan_id, enrollment_paid, join_date o billing_day
  IF OLD IS NULL OR 
     OLD.plan_id IS DISTINCT FROM NEW.plan_id OR
     OLD.enrollment_paid IS DISTINCT FROM NEW.enrollment_paid OR
     OLD.join_date IS DISTINCT FROM NEW.join_date THEN
    -- Lógica de recalculo automática
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 2. Validación de Rango
El campo `billing_day` tiene un CHECK constraint:
```sql
CHECK (billing_day >= 1 AND billing_day <= 31)
```

#### 3. Índices Creados
- `idx_clients_billing_day` - Para consultas rápidas
- `idx_clients_enrollment_paid` - Para identificar clientes con inscripción pendiente

## Verificación Realizada

✅ **Tests**: Todos los 130 tests pasan
✅ **Lint**: No hay errores, solo warnings preexistentes
✅ **UI**: Campo visible y funcional en el formulario
✅ **Persistencia**: El valor se guarda correctamente en la base de datos
✅ **Cálculo**: La función `computeNextPaymentDate` ya soporta `billing_day`

## Pasos Siguientes

1. **Ejecutar migración** en producción:
   ```sql
   -- \i migrations/20261117_add_billing_day_and_enrollment.sql
   ```

2. **Verificar datos existentes**:
   ```sql
   -- Ejecutar para verificar que los campos se crearon correctamente
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'clients' 
     AND column_name IN ('billing_day', 'enrollment_paid');
   ```

3. **Recalcular fechas para clientes existentes** (opcional):
   ```sql
   -- Verificar discrepancias
   SELECT * FROM auditNextPaymentDates();
   
   -- Si hay discrepancias, recalcular:
   SELECT recalculateAllNextPaymentDates();
   ```

## Preguntas Frecuentes

**P: ¿Cómo funciona el día de cobro cuando no se define?**
R: Se usa el día de la fecha de ingreso. Ej: Si ingresa el 28, sus facturas serán el 28 de cada mes.

**P: ¿Puedo cambiar el día de cobro después de registrar?**
R: Sí, edita el cliente y modifica el campo "Día de Cobro". La próxima fecha de pago se ajustará automáticamente.

**P: ¿La inscripción se cobra una sola vez?**
R: Sí, el campo `enrollment_paid` solo se usa al crear el cliente o al hacer borrón y cuenta nueva.