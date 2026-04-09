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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan variables de entorno. Verifica tu .env.local:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Lógica de negocio ────────────────────────────────────────────────────────

/**
 * Calcula la next_payment_date correcta para un cliente.
 *
 * Reglas:
 * - El DÍA siempre es el mismo que el join_date (ej: día 13 si se unió el 13)
 * - El MES es el mes siguiente al mes del ÚLTIMO pago registrado con ciclo completo
 * - Sin ciclos completos: join_date + 1 mes (primer vencimiento)
 *
 * @param {string} joinDate       - Fecha de ingreso (YYYY-MM-DD)
 * @param {Array}  payments       - Pagos del cliente para su plan, ordenados por payment_date asc
 * @param {number} planPrice      - Precio del plan
 * @returns {string|null}
 */
function computeNextPaymentDate(joinDate, payments, planPrice) {
  if (!joinDate || planPrice <= 0) return null;

  const joinDay   = parseInt(joinDate.split('-')[2], 10);
  const totalPaid = (payments || []).reduce((s, p) => s + (parseFloat(p.amount_usd) || 0), 0);
  const cycles    = Math.floor(totalPaid / planPrice);

  if (cycles === 0) {
    // Sin ciclos completos → join_date + 1 mes
    const [y, m, d] = joinDate.split('-').map(Number);
    let ty = y, tm = m; // tm es 1-indexed
    tm += 1;
    if (tm > 12) { tm = 1; ty++; }
    const lastDay = new Date(ty, tm, 0).getDate();
    return `${ty}-${String(tm).padStart(2,'0')}-${String(Math.min(d, lastDay)).padStart(2,'0')}`;
  }

  // Con ciclos: día(join_date) en el mes siguiente al último pago
  const lastPay = payments[payments.length - 1];
  const [ly, lm] = lastPay.payment_date.split('-').map(Number);
  let ty = ly, tm = lm + 1;
  if (tm > 12) { tm = 1; ty++; }
  const lastDay = new Date(ty, tm, 0).getDate();
  return `${ty}-${String(tm).padStart(2,'0')}-${String(Math.min(joinDay, lastDay)).padStart(2,'0')}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d); target.setHours(0, 0, 0, 0);
  const today  = new Date();             today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
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
