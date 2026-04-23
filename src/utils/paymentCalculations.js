/**
 * Utilidades para el cálculo de fechas de próximo pago
 *
 * LÓGICA DEL SISTEMA:
 * - El DÍA de pago siempre es el mismo día del join_date (ej: día 13 si se unió el 13)
 * - next_payment_date = día(join_date) en el mes siguiente al último pago registrado
 * - Pago puntual: día 13 del mes siguiente al mes de pago
 * - Pago atrasado: igual, día 13 del mes siguiente al mes en que pagó (no se penaliza con más)
 * - Pagos parciales: no modifica la fecha hasta completar el precio del plan
 * - Primera inscripción: Próximo pago = join_date + 1 mes
 */

import client from '../api/client';

/**
 * Calcula una fecha agregando N meses, manejando casos especiales de días.
 * Ejemplos:
 * - 31 enero + 1 mes = 28/29 febrero
 * - 31 agosto + 1 mes = 30 septiembre
 * 
 * @param {string|Date} baseDate - Fecha base (formato YYYY-MM-DD o Date)
 * @param {number} monthsToAdd - Cantidad de meses a agregar
 * @returns {string} - Nueva fecha en formato YYYY-MM-DD
 */
export function addMonthsToDate(baseDate, monthsToAdd) {
  if (!baseDate || monthsToAdd < 0) return null;

  // Parsear la fecha correctamente evitando problemas de zona horaria
  let year, month, day;
  
  if (typeof baseDate === 'string') {
    const parts = baseDate.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // Los meses en JS son 0-indexados
    day = parseInt(parts[2], 10);
  } else {
    year = baseDate.getFullYear();
    month = baseDate.getMonth();
    day = baseDate.getDate();
  }

  const originalDay = day;

  // Calcular el mes y año destino
  let targetMonth = month + monthsToAdd;
  let targetYear = year;

  while (targetMonth > 11) {
    targetMonth -= 12;
    targetYear += 1;
  }

  // Obtener el último día del mes destino
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  // Usar el día original o el último día del mes si el original no existe
  const finalDay = Math.min(originalDay, lastDayOfTargetMonth);

  // Formatear la fecha como YYYY-MM-DD
  const formattedYear = targetYear;
  const formattedMonth = String(targetMonth + 1).padStart(2, '0');
  const formattedDay = String(finalDay).padStart(2, '0');

  return `${formattedYear}-${formattedMonth}-${formattedDay}`;
}

/**
 * Calcula la next_payment_date correcta para un cliente.
 *
 * REGLA DE NEGOCIO:
 * - El DÍA siempre es el mismo que el join_date (ej: si se unió el 13, siempre paga el 13)
 * - El MES es el mes siguiente al mes del último pago registrado
 *
 * Ejemplo: join_date=2025-11-13, último pago=2026-02-25 → next=2026-03-13
 * Ejemplo: join_date=2026-01-17, último pago=2026-02-25 → next=2026-03-17
 * Ejemplo: join_date=2026-01-05, pagos=[ene, feb]      → next=2026-03-05
 *
 * @param {string} joinDate        - Fecha de ingreso del cliente (YYYY-MM-DD)
 * @param {Array}  clientPayments  - Pagos del plan actual, ordenados por payment_date asc
 * @param {number} planPrice       - Precio del plan
 * @returns {string|null}          - Fecha calculada en formato YYYY-MM-DD
 */
export function computeNextPaymentDate(joinDate, clientPayments, planPrice) {
  if (!joinDate || planPrice <= 0) return null;

  const joinParts = joinDate.split('-');
  const joinDay   = parseInt(joinParts[2], 10); // el día ancla (ej: 13)

  const totalPaid   = (clientPayments || []).reduce((s, p) => s + (parseFloat(p.amount_usd) || 0), 0);
  const totalCycles = Math.floor(totalPaid / planPrice);

  // Sin ciclos completos → primer vencimiento = join_date + 1 mes
  if (totalCycles === 0) {
    return addMonthsToDate(joinDate, 1);
  }

  // Con ciclos completos:
  // - Tomar el último pago registrado
  // - El mes siguiente a ese pago, en el día del join_date
  const lastPayment = clientPayments[clientPayments.length - 1];
  const lastPayParts = lastPayment.payment_date.split('-');
  let targetYear  = parseInt(lastPayParts[0], 10);
  let targetMonth = parseInt(lastPayParts[1], 10); // ya es 1-indexado, y queremos MES SIGUIENTE

  // Avanzar 1 mes
  targetMonth += 1;
  if (targetMonth > 12) { targetMonth = 1; targetYear += 1; }

  // Ajustar el día si el mes destino tiene menos días (ej: 31 en febrero)
  const lastDayOfTarget = new Date(targetYear, targetMonth, 0).getDate();
  const finalDay = Math.min(joinDay, lastDayOfTarget);

  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
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
    const nextParts = nextPaymentDate.split('-');
    const nextYear = parseInt(nextParts[0], 10);
    const nextMonth = parseInt(nextParts[1], 10) - 1;
    const nextDay = parseInt(nextParts[2], 10);
    const nextPayment = new Date(nextYear, nextMonth, nextDay);
    
    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Si próximo pago = hoy, mostrar 0 días
    if (nextPayment.getTime() === todayLocal.getTime()) {
      return 0;
    }
    
    // Si próximo pago < hoy (vencido), días negativos desde hoy
    if (nextPayment < todayLocal) {
      const diffTime = nextPayment - todayLocal;
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // Próximo pago > hoy, calcular desde mañana
    const diffTime = nextPayment - tomorrow;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
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
