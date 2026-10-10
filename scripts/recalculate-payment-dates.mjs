/**
 * Script de auditoría y corrección de next_payment_date.
 *
 * Lee las credenciales desde .env.local (nunca las expone en código).
 * Requiere: npm install dotenv @supabase/supabase-js
 *
 * REGLA DE NEGOCIO:
 *   Utiliza la misma lógica que la aplicación para calcular next_payment_date
 *   incluyendo descuentos, pagos de mantenimiento y ajuste de día ancla.
 *
 * Uso:
 *   node scripts/recalculate-payment-dates.mjs          → audita y corrige automáticamente en local
 *   node scripts/recalculate-payment-dates.mjs --dry-run → solo muestra qué cambiaría, sin tocar la BD
 *   node scripts/recalculate-payment-dates.mjs --prod    → ejecuta en producción
 */

import { createClient } from '@supabase/supabase-js';
import { config }       from 'dotenv';
import { resolve }      from 'path';
import { fileURLToPath } from 'url';
import { dirname }      from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar .env.local desde la raíz del proyecto
config({ path: resolve(__dirname, '../.env.local') });

const isProd = process.argv.includes('--prod');
const SUPABASE_URL = isProd
  ? (process.env.SUPABASE_PROD_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
  : process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY = isProd
  ? (process.env.SUPABASE_PROD_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan variables de entorno. Verifica tu .env.local:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_PROD_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PROD_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log(`📡 Conectado a: ${isProd ? 'PRODUCCIÓN (' + SUPABASE_URL + ')' : 'LOCAL (' + SUPABASE_URL + ')'}`);

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

// --- Copiado de las funciones necesarias de paymentCalculations.js y planUtils.js ---

const INSCRIPTION_PRICE = 5;
const MAX_EFFECTIVE_AMOUNT_USD = 10000;
const MAX_EFFECTIVE_AMOUNT_BS = 1000000;
const FALLBACK_EXCHANGE_RATE = 310;

function getPlanFrequency(plan) {
  if (!plan) return 'monthly';
  return (plan.frequency || 'monthly').toLowerCase();
}

function getEffectiveAmount(payment, plan, fallbackRate = FALLBACK_EXCHANGE_RATE) {
  if (!payment) return 0;

  // Determinar el campo de amount a usar basado en payment_type y moneda del plan
  let field = 'amount_usd';
  if (payment?.payment_type === 'efectivo_bolivares') {
    field = 'amount_bs';
  } else if (plan && (plan.currency || 'USD').toUpperCase() === 'BS') {
    field = 'amount_bs';
  }

  let amount = parseFloat(payment[field]) || 0;
  const isBSPlan = (plan?.currency || 'USD').toUpperCase() === 'BS';

  // Para USD pagados en bolivares, convertir a USD
  if (payment.payment_type === 'efectivo_bolivares' && !isBSPlan) {
    const rate = payment.exchange_rate || fallbackRate;
    amount = amount / rate;
  }

  // Validar razonabilidad del monto base
  const maxAmount = isBSPlan ? MAX_EFFECTIVE_AMOUNT_BS : MAX_EFFECTIVE_AMOUNT_USD;
  if (amount > maxAmount) {
    console.warn(
      `⚠️ Monto anómalo detectado: ${amount} en pago ${payment.id || 'unknown'} (${isBSPlan ? 'Bs' : 'USD'}), limitando a ${maxAmount}`
    );
    amount = maxAmount;
  }

  if (payment.discount_type === 'percentage' && payment.discount_value) {
    const disc = parseFloat(payment.discount_value) || 0;
    if (disc > 0 && disc < 100) {
      // Protección contra descuentos cercanos al 100% que inflan el monto efectivo
      const maxDiscount = 95; // Máximo 95% de descuento
      const safeDisc = Math.min(disc, maxDiscount);
      if (disc !== safeDisc) {
        console.warn(`⚠️ Descuento excesivo ${disc}% en pago ${payment.id || 'unknown'}, limitando a ${maxDiscount}%`);
      }
      amount = amount / (1 - safeDisc / 100);
    } else if (disc >= 100) {
      // 100% de descuento significa cobertura completa - tratar como 0 para propósitos de ciclo
      return 0;
    }
  } else if (payment.discount_type === 'fixed' && payment.discount_value) {
    const fixedDisc = parseFloat(payment.discount_value) || 0;
    // Validar razonabilidad del descuento fijo
    if (fixedDisc > MAX_EFFECTIVE_AMOUNT_USD) {
      console.warn(`⚠️ Descuento fijo anómalo: ${fixedDisc}, limitando`);
      amount += MAX_EFFECTIVE_AMOUNT_USD;
    } else {
      amount += fixedDisc;
    }
  }

  // Límite final del monto efectivo
  if (amount > maxAmount) {
    amount = maxAmount;
  }

  return Math.round(amount * 100) / 100;
}

function isMaintenancePayment(payment) {
  if (!payment) return false;
  const ref = (payment.reference || '').toLowerCase();
  return ref.includes('maintenance') || ref.includes('maintenance fee') || ref.includes('mantenimiento');
}

function getAnchorDateForTargetMonth(anchorDay, year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(anchorDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addMonthsPreservingAnchor(baseDateStr, monthsToAdd, anchorDay) {
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
 * Calcula la next_payment_date correcta para un cliente según su historial cronológico de pagos.
 * Versión idéntica a la usada en la aplicación.
 *
 * @param {string} joinDate       - Fecha de ingreso (YYYY-MM-DD)
 * @param {Array}  clientPayments - Pagos del cliente para su plan
 * @param {Object} plan           - Plan del cliente
 * @param {number} planPrice      - Precio del plan por período
 * @param {number} enrollmentFee  - Pago de inscripción (si aplica)
 * @returns {string|null} - Calculated next payment date (YYYY-MM-DD) for monthly plans, null for daily/weekly
 */
function computeNextPaymentDate(joinDate, clientPayments, plan, planPrice, enrollmentFee = 0) {
  if (!joinDate || planPrice <= 0) return null;

  const frequency = getPlanFrequency(plan);

  // Para planes diarios y semanales, no hay concepto de fecha de próximo pago
  // El acceso se otorga por período pagado
  if (frequency === 'daily' || frequency === 'weekly') {
    return null;
  }

  // Para planes mensuales, usar la lógica existente
  // El precio total del ciclo incluye la tarifa de inscripción (solo una vez)
  const cyclePrice = planPrice + enrollmentFee;

  const anchorDay = parseInt(joinDate.split('-')[2], 10);

  // Si no hay pagos, la próxima fecha de pago es join_date + 1 mes
  if (!clientPayments || clientPayments.length === 0) {
    return addMonthsPreservingAnchor(joinDate, 1, anchorDay);
  }

  // Ordenar pagos cronológicamente
  const sortedPayments = [...clientPayments].sort(
    (a, b) => new Date(a.payment_date) - new Date(b.payment_date)
  );

  let currentDueDate = null;
  let totalEffectiveSoFar = 0;
  let maintenanceBonusSoFar = 0;
  let previousAccumulatedMonths = 0;

  for (const p of sortedPayments) {
    // Skip payments made BEFORE the client joined
    if (p.payment_date < joinDate) {
      continue;
    }

    const [payYear, payMonth, payDay] = p.payment_date.split('-').map(Number);

    const effective = getEffectiveAmount(p, plan);
    const isMaint = isMaintenancePayment(p);
    const isMaintBonus = isMaint && effective > 0 && effective < planPrice;

    // Actualizar totales acumulados
    totalEffectiveSoFar += effective;
    if (isMaintBonus) {
      maintenanceBonusSoFar++;
    }

    // CORRECT CYCLE CALCULATION: enrollmentFee is ONE-TIME only, not per cycle
    // Cycle 1 price = planPrice + enrollmentFee, subsequent cycles = planPrice only
    let baseCycles = 0;
    if (totalEffectiveSoFar >= cyclePrice) {
      baseCycles = 1 + Math.floor((totalEffectiveSoFar - cyclePrice) / planPrice);
    } else {
      baseCycles = Math.floor(totalEffectiveSoFar / cyclePrice);
    }
    const accumulatedMonths = baseCycles + maintenanceBonusSoFar;

    if (accumulatedMonths <= 0) {
      previousAccumulatedMonths = accumulatedMonths;
      continue;
    }
    
    const deltaAccumulated = accumulatedMonths - previousAccumulatedMonths;

    if (!currentDueDate) {
      // Primera vez que tenemos suficiente para al menos un ciclo
      const baseTarget = addMonthsPreservingAnchor(joinDate, accumulatedMonths, anchorDay);
      if (p.payment_date > baseTarget) {
        // Pago inicial tardío
        if (payDay < anchorDay) {
          let target = getAnchorDateForTargetMonth(anchorDay, payYear, payMonth);
          if (accumulatedMonths > 1) {
            target = addMonthsPreservingAnchor(target, accumulatedMonths - 1, anchorDay);
          }
          currentDueDate = target;
        } else {
          currentDueDate = addMonthsPreservingAnchor(
            getAnchorDateForTargetMonth(anchorDay, payYear, payMonth),
            accumulatedMonths,
            anchorDay
          );
        }
      } else {
        currentDueDate = baseTarget;
      }
    } else {
      if (p.payment_date <= currentDueDate) {
        // Pago a tiempo o temprano: extender por deltaAccumulated
        currentDueDate = addMonthsPreservingAnchor(currentDueDate, deltaAccumulated, anchorDay);
      } else {
        // Reactivation after inactivity: reactiva el ciclo actual anclado al día del cliente.
        // Siempre avanzar al menos al siguiente día ancla cuando se paga después del vencimiento.
        if (payDay < anchorDay) {
          currentDueDate = getAnchorDateForTargetMonth(anchorDay, payYear, payMonth);
          if (deltaAccumulated > 1) {
            currentDueDate = addMonthsPreservingAnchor(currentDueDate, deltaAccumulated - 1, anchorDay);
          }
        } else {
          currentDueDate = addMonthsPreservingAnchor(
            getAnchorDateForTargetMonth(anchorDay, payYear, payMonth),
            Math.max(deltaAccumulated, 1),
            anchorDay
          );
        }
      }
    }

    previousAccumulatedMonths = accumulatedMonths;
  }

  // Si después de procesar todos los pagos no tenemos una fecha de vencimiento,
  // proyectamos el primer vencimiento a partir de join_date (un mes adelante).
  return currentDueDate || addMonthsPreservingAnchor(joinDate, 1, anchorDay);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d); target.setHours(0, 0, 0, 0);
  const today  = new Date();             today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function statusLabel(days) {
  if (days === null) return '?';
  return days >= 0 ? 'ACTIVO' : 'INACTIVO';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`\n📅 Fecha: ${todayStr}${DRY_RUN ? '  [DRY RUN — no se modificará nada]' : ''}\n`);

  // 1. Clientes con plan
  const { data: clients, error: cErr } = await db
    .from('clients')
    .select('id, first_name, last_name, cedula, plan_id, join_date, next_payment_date, enrollment_paid, plans(id, name, price, currency, frequency)')
    .not('plan_id', 'is', null)
    .order('last_name', { ascending: true });

  if (cErr) { console.error('Error al obtener clientes:', cErr.message); process.exit(1); }

  // 2. Todos los pagos ordenados por fecha
  const { data: payments, error: pErr } = await db
    .from('payments')
    .select('id, client_id, plan_id, amount_usd, amount_bs, payment_type, discount_type, discount_value, exchange_rate, payment_date, reference')
    .order('payment_date', { ascending: true });

  if (pErr) { console.error('Error al obtener pagos:', pErr.message); process.exit(1); }

  console.log(`Clientes con plan: ${clients.length}  |  Total pagos: ${payments.length}\n`);

  // 3. Calcular correcciones necesarias
  const toFix = [];
  const correct = [];

  for (const c of clients) {
    if (!c.plans) continue;
    const planPrice = parseFloat(c.plans.price) || 0;
    if (planPrice <= 0) continue;

    const cp = payments.filter(p => p.client_id === c.id && p.plan_id === c.plan_id);
    const enrollmentFee = c.enrollment_paid ? INSCRIPTION_PRICE : 0;
    const expected = computeNextPaymentDate(c.join_date, cp, c.plans, planPrice, enrollmentFee);

    if (!expected) continue;

    if (expected !== c.next_payment_date) {
      const daysBefore = daysUntil(c.next_payment_date);
      const daysAfter  = daysUntil(expected);
      toFix.push({
        id:           c.id,
        name:         `${c.first_name} ${c.last_name}`,
        cedula:       c.cedula,
        joinDate:     c.join_date,
        planName:     c.plans.name,
        lastPay:      cp.length ? cp[cp.length - 1].payment_date : null,
        payments:     cp.length,
        old:          c.next_payment_date,
        new:          expected,
        statusBefore: statusLabel(daysBefore),
        statusAfter:  statusLabel(daysAfter),
      });
    } else {
      correct.push(c.id);
    }
  }

  // 4. Mostrar resultado de auditoría
  if (toFix.length === 0) {
    console.log(`✅ Todos los clientes tienen next_payment_date correcta. (${correct.length} verificados)\n`);
    return;
  }

  console.log(`🔍 Clientes con fecha incorrecta: ${toFix.length}\n`);

  for (const fix of toFix) {
    const changed = fix.statusBefore !== fix.statusAfter;
    const icon    = changed ? (fix.statusAfter === 'ACTIVO' ? '🟢' : '🔴') : '🟡';
    console.log(`  ${icon} ${fix.name.padEnd(35)} (${fix.cedula})`);
    console.log(`     Plan: ${fix.planName}  |  join: ${fix.joinDate}  |  último pago: ${fix.lastPay ?? 'ninguno'}`);
    console.log(`     ${fix.old ?? 'NULL'} → ${fix.new}  [${fix.statusBefore} → ${fix.statusAfter}]`);
  }

  if (DRY_RUN) {
    console.log('\n⚠️  Modo dry-run: no se realizaron cambios. Ejecuta sin --dry-run para aplicar.\n');
    return;
  }

  // 5. Aplicar correcciones
  console.log('\n🔧 Aplicando correcciones...\n');
  let updated = 0;
  const errors = [];

  for (const fix of toFix) {
    const { error } = await db
      .from('clients')
      .update({ next_payment_date: fix.new })
      .eq('id', fix.id);

    if (error) {
      errors.push(`${fix.name}: ${error.message}`);
    } else {
      updated++;
    }
  }

  // 6. Resumen final
  const activados   = toFix.filter(f => f.statusBefore === 'INACTIVO' && f.statusAfter === 'ACTIVO').length;
  const inactivados = toFix.filter(f => f.statusBefore === 'ACTIVO'   && f.statusAfter === 'INACTIVO').length;
  const soloFecha   = toFix.filter(f => f.statusBefore === f.statusAfter).length;

  console.log('─'.repeat(60));
  console.log(`  ✅ Corregidos:                        ${updated}`);
  console.log(`  ❌ Errores:                           ${errors.length}`);
  console.log(`  🟢 Pasan a ACTIVO:                   ${activados}`);
  console.log(`  🔴 Pasan a INACTIVO:                 ${inactivados}`);
  console.log(`  🟡 Solo fecha ajustada (mismo status): ${soloFecha}`);
  console.log('─'.repeat(60) + '\n');
  if (errors.length) errors.forEach(e => console.log(`  ❌ ${e}`));
}

main().catch(err => { console.error(err); process.exit(1); });
