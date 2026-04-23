/**
 * Script de corrección de statuses de clientes.
 *
 * Lee las credenciales desde .env.local (nunca las expone en código).
 * Requiere: npm install dotenv @supabase/supabase-js
 *
 * REGLA DE NEGOCIO:
 *   - Si ciclos >= 1 Y próximo pago no vencido → "activo"
 *   - Si próximo pago vencido (días negativos) → "inactivo"
 *   - Si no tiene pagos suficientes → "inactivo"
 *
 * Uso:
 *   node scripts/fix-client-statuses.mjs          → corrige automáticamente
 *   node scripts/fix-client-statuses.mjs --dry-run → solo muestra qué cambiaría
 */

import { createClient } from '@supabase/supabase-js';
import { config }       from 'dotenv';
import { resolve }      from 'path';
import { fileURLToPath } from 'url';
import { dirname }      from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function daysUntil(dateStr, joinDate) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d); target.setHours(0, 0, 0, 0);
  const today  = new Date();             today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function computeStatus(client, payments, planPrice) {
  if (!client.plan_id || planPrice <= 0) return 'inactivo';

  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount_usd) || 0), 0);
  const cycles = Math.floor(totalPaid / planPrice);
  const daysUntilPayment = daysUntil(client.next_payment_date, client.join_date);

  if (cycles >= 1 && daysUntilPayment !== null && daysUntilPayment >= 0) {
    return 'activo';
  } else if (daysUntilPayment !== null && daysUntilPayment < 0) {
    return 'inactivo';
  }
  return 'inactivo';
}

async function main() {
  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`\n📅 Fecha: ${todayStr}${DRY_RUN ? '  [DRY RUN — no se modificará nada]' : ''}\n`);

  const { data: clients, error: cErr } = await db
    .from('clients')
    .select('id, first_name, last_name, cedula, plan_id, join_date, next_payment_date, status, plans(id, price)')
    .not('plan_id', 'is', null)
    .order('last_name', { ascending: true });

  if (cErr) { console.error('Error al obtener clientes:', cErr.message); process.exit(1); }

  const { data: payments, error: pErr } = await db
    .from('payments')
    .select('id, client_id, plan_id, amount_usd');

  if (pErr) { console.error('Error al obtener pagos:', pErr.message); process.exit(1); }

  console.log(`Clientes con plan: ${clients.length}  |  Total pagos: ${payments.length}\n`);

  const toFix = [];
  const correct = [];

  for (const c of clients) {
    if (!c.plans) continue;
    const planPrice = parseFloat(c.plans.price) || 0;
    if (planPrice <= 0) continue;

    const cp = payments.filter(p => p.client_id === c.id && p.plan_id === c.plan_id);
    const newStatus = computeStatus(c, cp, planPrice);

    if (newStatus !== c.status) {
      toFix.push({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        cedula: c.cedula,
        oldStatus: c.status,
        newStatus,
        payments: cp.length,
        nextPayment: c.next_payment_date,
      });
    } else {
      correct.push(c.id);
    }
  }

  if (toFix.length === 0) {
    console.log(`✅ Todos los clientes tienen status correcto. (${correct.length} verificados)\n`);
    return;
  }

  console.log(`🔍 Clientes con status incorrecto: ${toFix.length}\n`);

  for (const fix of toFix) {
    const icon = fix.newStatus === 'activo' ? '🟢' : '🔴';
    console.log(`  ${icon} ${fix.name.padEnd(35)} (${fix.cedula})`);
    console.log(`     Pagos: ${fix.payments}  |  próximo: ${fix.nextPayment ?? 'NULL'}`);
    console.log(`     ${fix.oldStatus} → ${fix.newStatus}`);
  }

  if (DRY_RUN) {
    console.log('\n⚠️  Modo dry-run: no se realizaron cambios. Ejecuta sin --dry-run para aplicar.\n');
    return;
  }

  console.log('\n🔧 Aplicando correcciones...\n');
  let updated = 0;
  const errors = [];

  for (const fix of toFix) {
    const { error } = await db
      .from('clients')
      .update({ status: fix.newStatus })
      .eq('id', fix.id);

    if (error) {
      errors.push(`${fix.name}: ${error.message}`);
    } else {
      updated++;
    }
  }

  const activados = toFix.filter(f => f.oldStatus === 'pendiente' && f.newStatus === 'activo').length;
  const inactivados = toFix.filter(f => f.newStatus === 'inactivo').length;

  console.log('─'.repeat(60));
  console.log(`  ✅ Corregidos:              ${updated}`);
  console.log(`  ❌ Errores:                 ${errors.length}`);
  console.log(`  🟢 Pendiente → Activo:     ${activados}`);
  console.log(`  🔴 others to Inactivo:     ${inactivados}`);
  console.log('─'.repeat(60) + '\n');
  if (errors.length) errors.forEach(e => console.log(`  ❌ ${e}`));
}

main().catch(err => { console.error(err); process.exit(1); });