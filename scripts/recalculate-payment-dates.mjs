/**
 * Script de auditoría y corrección de next_payment_date.
 *
 * Lee las credenciales desde .env.local (nunca las expone en código).
 * Requiere: npm install dotenv @supabase/supabase-js
 *
 * REGLA DE NEGOCIO:
 *   next_payment_date = día(join_date) en el mes siguiente al último pago registrado
 *   Sin pagos completos → join_date + 1 mes
 *
 * Uso:
 *   node scripts/fix-clients.mjs          → audita y corrige automáticamente
 *   node scripts/fix-clients.mjs --dry-run → solo muestra qué cambiaría, sin tocar la BD
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

// ─── Lógica de negocio ────────────────────────────────────────────────────────

/**
 * Obtiene la fecha YYYY-MM-DD para un año y mes específicos respetando el día ancla.
 */
function getAnchorDateForTargetMonth(anchorDay, year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(anchorDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Agrega N meses a una fecha base manteniendo intacto el día ancla original.
 */
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
    targetYear += 1;
  }

  return getAnchorDateForTargetMonth(anchor, targetYear, targetMonth);
}

/**
 * Calcula la next_payment_date correcta para un cliente según su historial cronológico de pagos.
 *
 * Reglas:
 * - El corte siempre corresponde al día del join_date (o fin de mes si el mes es más corto).
 * - Renovaciones continuas: Si un cliente activo paga antes o el día de su vencimiento, se extiende su cobertura.
 * - Reactivaciones tras inactividad: Si un cliente regresa tras meses sin pagar, su pago reactiva el servicio
 *   hasta su próximo día de corte ancla (no se arrastran cortes en el pasado).
 * - Pagos Parciales: El saldo se acumula hasta completar el precio de 1 ciclo antes de extender la fecha.
 * - Sin pagos: Proyecta el primer vencimiento a 1 mes desde join_date.
 *
 * @param {string} joinDate       - Fecha de ingreso (YYYY-MM-DD)
 * @param {Array}  payments       - Pagos del cliente para su plan
 * @param {number} planPrice      - Precio del plan
 * @returns {string|null}
 */
function computeNextPaymentDate(joinDate, payments, planPrice) {
  if (!joinDate || planPrice <= 0) return null;
  const anchorDay = parseInt(joinDate.split('-')[2], 10);

  if (!payments || payments.length === 0) {
    return addMonthsPreservingAnchor(joinDate, 1, anchorDay);
  }

  const sortedPayments = [...payments].sort(
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

    accumulatedBalance -= cycles * planPrice;
    const [payYear, payMonth, payDay] = p.payment_date.split('-').map(Number);

    if (!currentDueDate) {
      const firstTarget = addMonthsPreservingAnchor(joinDate, cycles, anchorDay);
      if (p.payment_date > firstTarget) {
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
      if (p.payment_date <= currentDueDate) {
        currentDueDate = addMonthsPreservingAnchor(currentDueDate, cycles, anchorDay);
      } else {
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
    .select('id, first_name, last_name, cedula, plan_id, join_date, next_payment_date, plans(id, name, price)')
    .not('plan_id', 'is', null)
    .order('last_name', { ascending: true });

  if (cErr) { console.error('Error al obtener clientes:', cErr.message); process.exit(1); }

  // 2. Todos los pagos ordenados por fecha
  const { data: payments, error: pErr } = await db
    .from('payments')
    .select('id, client_id, plan_id, amount_usd, payment_date')
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

    const cp       = payments.filter(p => p.client_id === c.id && p.plan_id === c.plan_id);
    const expected = computeNextPaymentDate(c.join_date, cp, planPrice);

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
