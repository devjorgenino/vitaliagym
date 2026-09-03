/**
 * Utilidades para el cálculo de fechas de próximo pago
 *
 * LÓGICA DEL SISTEMA (Ciclo de Vida Cronológico con Ancla de Día):
 * - El DÍA de corte siempre se ancla al join_date (ej: día 29 si se unió el 29, día 31 si se unió el 31).
 * - Procesamiento cronológico de pagos:
 *   1. Si el pago se realiza dentro de la vigencia activa (payment_date <= currentDueDate),
 *      extiende la cobertura N ciclos a partir del vencimiento actual (renovación puntual/anticipada).
 *   2. Si el pago se realiza después de un período de inactividad (payment_date > currentDueDate),
 *      se reactiva la membresía cubriendo el mes corriente según su día ancla:
 *      - Si payDay <= anchorDay: vence el día ancla del mes de pago (ej: pagó 3 Sep con ancla 29 -> vence 29 Sep).
 *      - Si payDay > anchorDay: vence el día ancla del mes siguiente (ej: pagó 30 Sep con ancla 29 -> vence 29 Oct).
 * - Pagos parciales: acumula saldo hasta completar el costo del plan antes de extender ciclos.
 * - Primera inscripción / sin pagos: Próximo pago = join_date + 1 mes (anclado).
 */

import client from '../api/client';

/**
 * Obtiene la fecha YYYY-MM-DD para un año y mes específicos respetando el día ancla.
 * Si el mes destino tiene menos días que el ancla (ej: 31 en febrero o septiembre),
 * se ajusta al último día disponible de ese mes.
 *
 * @param {number} anchorDay - Día ancla original del cliente (1-31)
 * @param {number} year - Año destino
 * @param {number} month - Mes destino (1-12)
 * @returns {string} - Fecha en formato YYYY-MM-DD
 */
export function getAnchorDateForTargetMonth(anchorDay, year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(anchorDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Agrega N meses a una fecha base manteniendo intacto el día ancla original.
 *
 * Ejemplos:
 * - 2026-08-31 + 1 mes (ancla 31) = 2026-09-30
 * - 2026-08-31 + 2 meses (ancla 31) = 2026-10-31 (recupera el 31)
 * - 2026-01-31 + 1 mes (ancla 31) = 2026-02-28 (o 29 en bisiesto)
 *
 * @param {string} baseDateStr - Fecha base en formato YYYY-MM-DD
 * @param {number} monthsToAdd - Cantidad de meses a agregar
 * @param {number} [anchorDay] - Día ancla (opcional, si no se pasa se extrae de baseDateStr)
 * @returns {string|null} - Nueva fecha en formato YYYY-MM-DD
 */
export function addMonthsPreservingAnchor(baseDateStr, monthsToAdd, anchorDay) {
  if (!baseDateStr || monthsToAdd === null || monthsToAdd === undefined || monthsToAdd < 0) return null;

  const [y, m, d] = baseDateStr.split('-').map(Number);
  const anchor = anchorDay || d;

  let targetMonth = m + monthsToAdd;
  let targetYear = y;

  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }
  while (targetMonth < 1) {
    targetMonth += 12;
    targetYear -= 1;
  }

  return getAnchorDateForTargetMonth(anchor, targetYear, targetMonth);
}

/**
 * Función legacy / utilitaria para sumar meses a una fecha.
 *
 * @param {string|Date} baseDate - Fecha base (formato YYYY-MM-DD o Date)
 * @param {number} monthsToAdd - Cantidad de meses a agregar
 * @returns {string|null} - Nueva fecha en formato YYYY-MM-DD
 */
export function addMonthsToDate(baseDate, monthsToAdd) {
  if (!baseDate || monthsToAdd < 0) return null;

  let baseStr;
  if (typeof baseDate === 'string') {
    baseStr = baseDate;
  } else {
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const d = String(baseDate.getDate()).padStart(2, '0');
    baseStr = `${y}-${m}-${d}`;
  }

  const anchorDay = parseInt(baseStr.split('-')[2], 10);
  return addMonthsPreservingAnchor(baseStr, monthsToAdd, anchorDay);
}

/**
 * Calcula la next_payment_date correcta para un cliente según su historial cronológico de pagos.
 *
 * REGLAS DE NEGOCIO:
 * 1. Preservación del Día Ancla: El corte siempre corresponde al día del join_date (o fin de mes si el mes es más corto).
 * 2. Renovaciones continuas: Si un cliente activo paga antes o el día de su vencimiento, se extiende su cobertura.
 * 3. Reactivaciones tras inactividad: Si un cliente regresa tras meses sin pagar, su pago reactiva el servicio
 *    hasta su próximo día de corte ancla (no se arrastran cortes en el pasado).
 * 4. Pagos Parciales: El saldo se acumula hasta completar el precio de 1 ciclo antes de extender la fecha.
 * 5. Sin pagos: Proyecta el primer vencimiento a 1 mes desde join_date.
 *
 * @param {string} joinDate        - Fecha de ingreso del cliente (YYYY-MM-DD)
 * @param {Array}  clientPayments  - Pagos del plan actual del cliente
 * @param {number} planPrice       - Precio del plan mensual
 * @returns {string|null}          - Próxima fecha de pago calculada (YYYY-MM-DD)
 */
export function computeNextPaymentDate(joinDate, clientPayments, planPrice) {
  if (!joinDate || planPrice <= 0) return null;
  const anchorDay = parseInt(joinDate.split('-')[2], 10);

  if (!clientPayments || clientPayments.length === 0) {
    return addMonthsPreservingAnchor(joinDate, 1, anchorDay);
  }

  // Ordenar pagos cronológicamente
  const sortedPayments = [...clientPayments].sort(
    (a, b) => new Date(a.payment_date) - new Date(b.payment_date)
  );

  let currentDueDate = null;
  let accumulatedBalance = 0;

  for (const p of sortedPayments) {
    const amount = parseFloat(p.amount_usd) || 0;
    if (amount <= 0) continue;

    accumulatedBalance += amount;
    const cycles = Math.floor(accumulatedBalance / planPrice);
    if (cycles <= 0) continue;

    // Descontar los ciclos completos aplicados
    accumulatedBalance -= cycles * planPrice;

    const [payYear, payMonth, payDay] = p.payment_date.split('-').map(Number);

    if (!currentDueDate) {
      // Primer pago registrado
      const firstTarget = addMonthsPreservingAnchor(joinDate, cycles, anchorDay);
      if (p.payment_date > firstTarget) {
        // Pago inicial tardío tras la primera fecha esperada
        if (payDay <= anchorDay) {
          let target = getAnchorDateForTargetMonth(anchorDay, payYear, payMonth);
          if (cycles > 1) {
            target = addMonthsPreservingAnchor(target, cycles - 1, anchorDay);
          }
          currentDueDate = target;
        } else {
          currentDueDate = addMonthsPreservingAnchor(
            getAnchorDateForTargetMonth(anchorDay, payYear, payMonth),
            cycles,
            anchorDay
          );
        }
      } else {
        currentDueDate = firstTarget;
      }
    } else {
      // Pagos subsecuentes
      if (p.payment_date <= currentDueDate) {
        // Renovación dentro de vigencia activa: extiende desde el vencimiento actual
        currentDueDate = addMonthsPreservingAnchor(currentDueDate, cycles, anchorDay);
      } else {
        // Reactivación tras inactividad: reactiva el ciclo actual anclado al día del cliente
        if (payDay <= anchorDay) {
          let target = getAnchorDateForTargetMonth(anchorDay, payYear, payMonth);
          if (cycles > 1) {
            target = addMonthsPreservingAnchor(target, cycles - 1, anchorDay);
          }
          currentDueDate = target;
        } else {
          currentDueDate = addMonthsPreservingAnchor(
            getAnchorDateForTargetMonth(anchorDay, payYear, payMonth),
            cycles,
            anchorDay
          );
        }
      }
    }
  }

  return currentDueDate || addMonthsPreservingAnchor(joinDate, 1, anchorDay);
}

/**
 * Recalcula y persiste la next_payment_date de un cliente tras registrar/editar/borrar un pago.
 *
 * @param {Object} params
 * @param {string} params.clientId - ID del cliente
 * @param {string} params.planId   - ID del plan actual del cliente
 * @returns {Promise<{success: boolean, newDate?: string, cyclesExtended?: number, error?: any}>}
 */
export async function recalculateNextPaymentDate({ clientId, planId }) {
  try {
    // 1. Datos del cliente
    const { data: clientData, error: clientError } = await client
      .from('clients')
      .select(`
        id,
        join_date,
        next_payment_date,
        plan_id,
        plans (
          id,
          price
        )
      `)
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      console.error('Error fetching client for recalculation:', clientError);
      return { success: false, error: clientError };
    }

    const planPrice = clientData.plans ? parseFloat(clientData.plans.price) || 0 : 0;

    if (planPrice <= 0) {
      console.error('Plan price is invalid or zero');
      return { success: false, error: 'Plan price is invalid' };
    }

    // 2. Pagos del cliente para su plan actual, ordenados por fecha
    const { data: allPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, amount_usd, payment_date')
      .eq('client_id', clientId)
      .eq('plan_id', clientData.plan_id)
      .order('payment_date', { ascending: true });

    if (paymentsError) {
      console.error('Error fetching payments for recalculation:', paymentsError);
      return { success: false, error: paymentsError };
    }

    // 3. Calcular la fecha correcta con la regla de negocio
    const newNextPaymentDate = computeNextPaymentDate(
      clientData.join_date,
      allPayments || [],
      planPrice
    );

    if (!newNextPaymentDate) {
      return { success: false, error: 'No se pudo calcular la nueva fecha' };
    }

    // 4. Actualizar solo si la fecha cambió
    if (newNextPaymentDate !== clientData.next_payment_date) {
      const { error } = await client
        .from('clients')
        .update({ next_payment_date: newNextPaymentDate })
        .eq('id', clientId);

      if (error) {
        console.error('Error updating client next_payment_date:', error);
        return { success: false, error };
      }

      return {
        success: true,
        newDate: newNextPaymentDate,
        previousDate: clientData.next_payment_date,
      };
    }

    // Sin cambio
    return {
      success: true,
      newDate: clientData.next_payment_date,
      cyclesExtended: 0,
      isPartialPayment: true
    };

  } catch (err) {
    console.error('Error recalculating client next_payment_date:', err);
    return { success: false, error: err };
  }
}

/**
 * Recalcula las fechas de próximo pago para TODOS los clientes.
 * Útil para mantenimiento o migración de datos.
 * 
 * @returns {Promise<{success: boolean, updated: number, total: number, errors: string[]}>}
 */
export async function recalculateAllNextPaymentDates() {
  try {
    // 1. Obtener todos los clientes
    const { data: allClients, error: fetchError } = await client
      .from('clients')
      .select(`
        id, 
        join_date, 
        next_payment_date,
        plan_id,
        plans (
          id,
          price
        )
      `);

    if (fetchError) throw fetchError;
    if (!allClients || allClients.length === 0) {
      return { success: true, updated: 0, total: 0, errors: [] };
    }

    // 2. Obtener todos los pagos ordenados por fecha
    const { data: allPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, client_id, plan_id, amount_usd, payment_date')
      .order('payment_date', { ascending: true });

    if (paymentsError) throw paymentsError;

    const updates = [];
    const errors = [];

    // 3. Procesar cada cliente
    for (const clientData of allClients) {
      if (!clientData.join_date) {
        errors.push(`Cliente ${clientData.id}: sin fecha de ingreso`);
        continue;
      }
      
      try {
        const planPrice = clientData.plans ? parseFloat(clientData.plans.price) || 0 : 0;
        
        if (planPrice <= 0) {
          errors.push(`Cliente ${clientData.id}: precio de plan inválido`);
          continue;
        }

        // Pagos del cliente para su plan actual, ya ordenados por fecha
        const clientPayments = (allPayments || []).filter(
          p => p.client_id === clientData.id && p.plan_id === clientData.plan_id
        );

        // Calcular la fecha correcta con la regla de negocio
        const newNextPaymentDate = computeNextPaymentDate(
          clientData.join_date,
          clientPayments,
          planPrice
        );

        if (newNextPaymentDate && newNextPaymentDate !== clientData.next_payment_date) {
          updates.push({
            id: clientData.id,
            next_payment_date: newNextPaymentDate
          });
        }
      } catch (err) {
        errors.push(`Cliente ${clientData.id}: ${err.message}`);
      }
    }

    // 4. Aplicar actualizaciones en lotes de 50
    if (updates.length > 0) {
      const batchSize = 50;
      let updatedCount = 0;
      
      for (let i = 0; i < updates.length; i += batchSize) {
        const chunk = updates.slice(i, i + batchSize);
        await Promise.all(chunk.map(async (u) => {
          const { error } = await client
            .from('clients')
            .update({ next_payment_date: u.next_payment_date })
            .eq('id', u.id);
          
          if (error) {
            errors.push(`Error actualizando ${u.id}: ${error.message}`);
          } else {
            updatedCount++;
          }
        }));
      }
      
      return { 
        success: errors.length === 0, 
        updated: updatedCount, 
        total: allClients.length, 
        errors 
      };
    }

    return { success: true, updated: 0, total: allClients.length, errors: [] };

  } catch (err) {
    console.error('Error recalculating all payment dates:', err);
    return { success: false, updated: 0, total: 0, errors: [err.message] };
  }
}

/**
 * Audita las fechas de próximo pago de TODOS los clientes sin modificar nada.
 * Compara el valor almacenado contra el valor esperado según los pagos reales.
 *
 * @returns {Promise<{
 *   success: boolean,
 *   total: number,
 *   correct: number,
 *   discrepancies: Array<{
 *     id: string,
 *     name: string,
 *     join_date: string,
 *     stored: string,
 *     expected: string,
 *     totalPaid: number,
 *     cycles: number,
 *   }>,
 *   errors: string[]
 * }>}
 */
export async function auditNextPaymentDates() {
  try {
    const { data: allClients, error: fetchError } = await client
      .from('clients')
      .select(`
        id,
        first_name,
        last_name,
        join_date,
        next_payment_date,
        plan_id,
        plans ( id, price )
      `);

    if (fetchError) throw fetchError;
    if (!allClients || allClients.length === 0) {
      return { success: true, total: 0, correct: 0, discrepancies: [], errors: [] };
    }

    const { data: allPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, client_id, plan_id, amount_usd, payment_date')
      .order('payment_date', { ascending: true });

    if (paymentsError) throw paymentsError;

    const discrepancies = [];
    const errors = [];

    for (const c of allClients) {
      if (!c.join_date) {
        errors.push(`${c.first_name} ${c.last_name} (${c.id}): sin join_date`);
        continue;
      }

      const planPrice = c.plans ? parseFloat(c.plans.price) || 0 : 0;
      if (planPrice <= 0) {
        errors.push(`${c.first_name} ${c.last_name} (${c.id}): precio de plan inválido`);
        continue;
      }

      const clientPayments = (allPayments || []).filter(
        p => p.client_id === c.id && p.plan_id === c.plan_id
      );
      const totalPaid = clientPayments.reduce(
        (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
        0
      );
      const cycles   = Math.floor(totalPaid / planPrice);
      const expected = computeNextPaymentDate(c.join_date, clientPayments, planPrice);

      if (expected !== c.next_payment_date) {
        discrepancies.push({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`,
          join_date: c.join_date,
          stored: c.next_payment_date,
          expected,
          totalPaid,
          cycles,
        });
      }
    }

    return {
      success: true,
      total: allClients.length,
      correct: allClients.length - discrepancies.length - errors.length,
      discrepancies,
      errors,
    };
  } catch (err) {
    console.error('Error auditing payment dates:', err);
    return { success: false, total: 0, correct: 0, discrepancies: [], errors: [err.message] };
  }
}

/**
 * Corrige las fechas de próximo pago de los clientes con discrepancias.
 * Recibe el array `discrepancies` que devuelve auditNextPaymentDates().
 *
 * @param {Array<{id: string, expected: string}>} discrepancies
 * @returns {Promise<{success: boolean, updated: number, errors: string[]}>}
 */
export async function fixAuditDiscrepancies(discrepancies) {
  if (!discrepancies || discrepancies.length === 0) {
    return { success: true, updated: 0, errors: [] };
  }

  const errors = [];
  let updated = 0;

  await Promise.all(discrepancies.map(async (d) => {
    const { error } = await client
      .from('clients')
      .update({ next_payment_date: d.expected })
      .eq('id', d.id);

    if (error) {
      errors.push(`${d.name} (${d.id}): ${error.message}`);
    } else {
      updated++;
    }
  }));

  return { success: errors.length === 0, updated, errors };
}

/**
 * Calcula los días restantes hasta el próximo pago.
 * Retorna número negativo si está vencido.
 * 
 * @param {string} nextPaymentDate - Fecha del próximo pago (YYYY-MM-DD)
 * @returns {number} - Días restantes (negativo si vencido)
 */
export function calculateDaysUntilPayment(nextPaymentDate, joinDate) {
  if (!nextPaymentDate) return null;

  try {
    let targetYear, targetMonth, targetDay;
    if (typeof nextPaymentDate === 'string') {
      const nextParts = nextPaymentDate.split('-');
      targetYear = parseInt(nextParts[0], 10);
      targetMonth = parseInt(nextParts[1], 10) - 1;
      targetDay = parseInt(nextParts[2], 10);
    } else {
      targetYear = nextPaymentDate.getFullYear();
      targetMonth = nextPaymentDate.getMonth();
      targetDay = nextPaymentDate.getDate();
    }

    const nextPayment = new Date(targetYear, targetMonth, targetDay);
    nextPayment.setHours(0, 0, 0, 0);

    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    todayLocal.setHours(0, 0, 0, 0);

    const diffTime = nextPayment.getTime() - todayLocal.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch (error) {
    console.error('Error calculating days until payment:', error);
    return null;
  }
}

/**
 * Obtiene el color del estado de pago según días restantes.
 * 
 * @param {number} daysLeft - Días restantes
 * @returns {string} - Clase CSS de color
 */
export function getPaymentStatusColor(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return 'text-gray-500';
  if (daysLeft < 0) return 'text-red-500';      // Vencido
  if (daysLeft === 0) return 'text-yellow-500';  // Hoy (0 días)
  if (daysLeft <= 7) return 'text-orange-500';  // Vence pronto (≤7 días)
  if (daysLeft <= 15) return 'text-yellow-500'; // Vence (≤15 días)
  return 'text-green-500';                      // Activo (>15 días)
}

/**
 * Calcula y actualiza el status del cliente basándose en sus pagos.
 * Lógica:
 * - Si tiene pagos suficientes para al menos 1 ciclo Y próximo pago no vencido → "activo"
 * - Si próximo pago vencido (días negativos) → "inactivo"
 * - Si no tiene pagos suficientes → "pendiente" (o "inactivo" si prefers)
 *
 * @param {string} clientId - ID del cliente
 * @param {string} planId - ID del plan actual del cliente
 * @returns {Promise<{success: boolean, status?: string, previousStatus?: string, error?: any}>}
 */
export async function updateClientStatus(clientId, planId) {
  try {
    const { data: clientData, error: clientError } = await client
      .from('clients')
      .select(`
        id,
        status,
        next_payment_date,
        join_date,
        plan_id,
        plans (
          id,
          price
        )
      `)
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      console.error('Error fetching client for status update:', clientError);
      return { success: false, error: clientError };
    }

    const planPrice = clientData.plans ? parseFloat(clientData.plans.price) || 0 : 0;

    if (planPrice <= 0) {
      return { success: false, error: 'Plan price is invalid or zero' };
    }

    const { data: payments, error: paymentsError } = await client
      .from('payments')
      .select('id, amount_usd, payment_date')
      .eq('client_id', clientId)
      .eq('plan_id', planId);

    if (paymentsError) {
      console.error('Error fetching payments for status update:', paymentsError);
      return { success: false, error: paymentsError };
    }

    const totalPaid = (payments || []).reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0
    );

    const cycles = Math.floor(totalPaid / planPrice);
    const daysUntilPayment = calculateDaysUntilPayment(
      clientData.next_payment_date,
      clientData.join_date
    );

    let newStatus;
    if (cycles >= 1 && daysUntilPayment !== null && daysUntilPayment >= 0) {
      newStatus = 'activo';
    } else if (daysUntilPayment !== null && daysUntilPayment < 0) {
      newStatus = 'inactivo';
    } else {
      newStatus = 'inactivo';
    }

    if (newStatus !== clientData.status) {
      const { error } = await client
        .from('clients')
        .update({ status: newStatus })
        .eq('id', clientId);

      if (error) {
        console.error('Error updating client status:', error);
        return { success: false, error };
      }

      return {
        success: true,
        status: newStatus,
        previousStatus: clientData.status,
      };
    }

    return {
      success: true,
      status: clientData.status,
      previousStatus: clientData.status,
      unchanged: true,
    };
  } catch (err) {
    console.error('Error updating client status:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Corrige el status de TODOS los clientes basándose en sus pagos.
 * Útil para arreglar clientes existentes con status incorrecto.
 * 
 * @returns {Promise<{success: boolean, updated: number, total: number, errors: string[]}>}
 */
export async function fixAllClientStatuses() {
  try {
    const { data: allClients, error: fetchError } = await client
      .from('clients')
      .select(`
        id,
        status,
        next_payment_date,
        join_date,
        plan_id,
        plans (
          id,
          price
        )
      `);

    if (fetchError) throw fetchError;
    if (!allClients || allClients.length === 0) {
      return { success: true, updated: 0, total: 0, errors: [] };
    }

    const { data: allPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, client_id, plan_id, amount_usd');

    if (paymentsError) throw paymentsError;

    const updates = [];
    const errors = [];

    for (const clientData of allClients) {
      try {
        const planPrice = clientData.plans ? parseFloat(clientData.plans.price) || 0 : 0;
        
        if (planPrice <= 0) continue;

        const clientPayments = (allPayments || []).filter(
          p => p.client_id === clientData.id && p.plan_id === clientData.plan_id
        );

        const totalPaid = clientPayments.reduce(
          (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
          0
        );

        const cycles = Math.floor(totalPaid / planPrice);
        const daysUntilPayment = calculateDaysUntilPayment(
          clientData.next_payment_date,
          clientData.join_date
        );

        let newStatus;
        if (cycles >= 1 && daysUntilPayment !== null && daysUntilPayment >= 0) {
          newStatus = 'activo';
        } else if (daysUntilPayment !== null && daysUntilPayment < 0) {
          newStatus = 'inactivo';
        } else {
          newStatus = 'inactivo';
        }

        if (newStatus !== clientData.status) {
          updates.push({
            id: clientData.id,
            name: `${clientData.first_name} ${clientData.last_name}`,
            oldStatus: clientData.status,
            newStatus
          });
        }
      } catch (err) {
        errors.push(`Cliente ${clientData.id}: ${err.message}`);
      }
    }

    if (updates.length > 0) {
      let updatedCount = 0;
      
      for (const u of updates) {
        const { error } = await client
          .from('clients')
          .update({ status: u.newStatus })
          .eq('id', u.id);

        if (error) {
          errors.push(`${u.name}: ${error.message}`);
        } else {
          updatedCount++;
        }
      }
      
      return { 
        success: errors.length === 0, 
        updated: updatedCount, 
        total: allClients.length, 
        errors 
      };
    }

    return { success: true, updated: 0, total: allClients.length, errors: [] };

  } catch (err) {
    console.error('Error fixing all client statuses:', err);
    return { success: false, updated: 0, total: 0, errors: [err.message] };
  }
}
