/**
 * Utilidades para el cálculo de fechas de próximo pago
 * 
 * LÓGICA DEL SISTEMA:
 * - Pago anticipado: Mantiene el día de pago original (no pierde días)
 * - Pago atrasado: No se penaliza, mantiene su día original
 * - Pagos múltiples: Solo extiende 1 mes por cada ciclo completo pagado
 * - Pagos parciales: No extiende hasta completar el precio del plan
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
 * Calcula la nueva fecha de próximo pago después de registrar un pago.
 * 
 * REGLAS:
 * 1. Si es cliente nuevo (sin next_payment_date): join_date + 1 mes
 * 2. Si el pago completa ciclos: next_payment_date actual + ciclos completados
 * 3. Si es pago parcial: no modifica la fecha
 * 
 * @param {Object} params
 * @param {string} params.clientId - ID del cliente
 * @param {string} params.planId - ID del plan actual del cliente
 * @returns {Promise<{success: boolean, newDate?: string, cyclesExtended?: number, error?: any}>}
 */
export async function recalculateNextPaymentDate({ clientId, planId }) {
  try {
    // 1. Obtener datos del cliente
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

    // 2. Caso: Cliente nuevo sin next_payment_date
    if (!clientData.next_payment_date) {
      const newNextPaymentDate = addMonthsToDate(clientData.join_date, 1);
      
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
        cyclesExtended: 1,
        isNewClient: true 
      };
    }

    // 3. Obtener todos los pagos del cliente para su plan actual
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

    // 4. Calcular total pagado
    const totalPaid = (allPayments || []).reduce(
      (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
      0
    );

    // 5. Calcular cuántos ciclos completos se han pagado
    const totalCyclesCompleted = Math.floor(totalPaid / planPrice);

    // 6. Calcular nueva fecha: join_date + (ciclos + 1) meses
    // El "+1" es porque next_payment_date siempre apunta al PRÓXIMO pago
    const newNextPaymentDate = addMonthsToDate(
      clientData.join_date, 
      totalCyclesCompleted + 1
    );

    // 7. Solo actualizar si la fecha cambió
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
        cyclesExtended: totalCyclesCompleted,
        previousDate: clientData.next_payment_date
      };
    }

    // No hubo cambio (pago parcial)
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

    // 2. Obtener todos los pagos
    const { data: allPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, client_id, plan_id, amount_usd');

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

        // Filtrar pagos de este cliente para su plan actual
        const clientPayments = (allPayments || []).filter(
          p => p.client_id === clientData.id && p.plan_id === clientData.plan_id
        );
        
        // Calcular total pagado
        const totalPaid = clientPayments.reduce(
          (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
          0
        );
        
        // Calcular ciclos completos
        const cyclesPaid = Math.floor(totalPaid / planPrice);
        
        // Calcular nueva fecha: join_date + (ciclos + 1) meses
        const newNextPaymentDate = addMonthsToDate(clientData.join_date, cyclesPaid + 1);

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
 * Calcula los días restantes hasta el próximo pago.
 * Retorna número negativo si está vencido.
 * 
 * @param {string} nextPaymentDate - Fecha del próximo pago (YYYY-MM-DD)
 * @returns {number} - Días restantes (negativo si vencido)
 */
export function calculateDaysUntilPayment(nextPaymentDate) {
  if (!nextPaymentDate) return null;

  try {
    const parts = nextPaymentDate.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const nextPayment = new Date(year, month, day);
    nextPayment.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = nextPayment - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
  if (daysLeft <= 7) return 'text-orange-500';  // Vence pronto (≤7 días)
  if (daysLeft <= 15) return 'text-yellow-500'; // Vence (≤15 días)
  return 'text-green-500';                      // Activo (>15 días)
}
