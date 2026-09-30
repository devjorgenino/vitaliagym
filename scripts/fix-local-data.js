/**
 * Script de corrección de datos en la base de datos local.
 *
 * Uso:
 *   node scripts/fix-local-data.js                  # Solo diagnóstico
 *   node scripts/fix-local-data.js --apply          # Corregir fechas y estados
 *   node scripts/fix-local-data.js --revert         # Revertir cambios hechos con --apply
 *   node scripts/fix-local-data.js --dry-run        # Mostrar qué se corregiría sin aplicar
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Agrega N meses a una fecha, preservando el día ancla.
 */
function addMonthsPreservingAnchor(baseDateStr, monthsToAdd, anchorDay) {
  if (!baseDateStr || monthsToAdd < 0) return null;
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const anchor = anchorDay || d;
  let targetMonth = m + monthsToAdd;
  let targetYear = y;
  while (targetMonth > 12) { targetMonth -= 12; targetYear += 1; }
  while (targetMonth < 1) { targetMonth += 12; targetYear -= 1; }
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const day = Math.min(anchor, lastDay);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Calcula el monto efectivo de un pago convirtiendo BS a USD si es necesario.
 */
function getEffectiveAmount(payment, plan) {
  if (!payment) return 0;
  let field = 'amount_usd';
  if (payment.payment_type === 'efectivo_bolivares') field = 'amount_bs';
  else if (payment.payment_type === 'efectivo_dolares') field = 'amount_usd';
  else field = (plan?.currency || 'USD').toUpperCase() === 'BS' ? 'amount_bs' : 'amount_usd';

  let amount = parseFloat(payment[field]) || 0;
  const isBSPlan = (plan?.currency || 'USD').toUpperCase() === 'BS';

  // Convertir efectivo_bolivares a USD para planes en USD
  if (payment.payment_type === 'efectivo_bolivares' && !isBSPlan) {
    const rate = payment.exchange_rate || 310;
    amount = amount / rate;
  }

  // Aplicar descuento
  if (payment.discount_type === 'percentage' && payment.discount_value) {
    const disc = parseFloat(payment.discount_value) || 0;
    const safeDisc = Math.min(disc, 95);
    if (disc > 0 && disc < 100) amount = amount / (1 - safeDisc / 100);
  } else if (payment.discount_type === 'fixed' && payment.discount_value) {
    amount += parseFloat(payment.discount_value) || 0;
  }

  // Límites de seguridad
  const maxAmount = isBSPlan ? 1000000 : 10000;
  return Math.min(amount, maxAmount);
}

/**
 * Calcula la próxima fecha de pago basada en el historial.
 */
async function computeNextPaymentDate(joinDate, payments, planPrice) {
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
    const amount = getEffectiveAmount(p, { currency: null }); // plan no necesario aquí
    if (amount <= 0) continue;

    accumulatedBalance += amount;
    const cycles = Math.floor(accumulatedBalance / planPrice);
    if (cycles <= 0) continue;

    // Limitar ciclos por pago
    const safeCycles = Math.min(cycles, 24);
    accumulatedBalance -= safeCycles * planPrice;

    const [payYear, payMonth, payDay] = p.payment_date.split('-').map(Number);

    if (!currentDueDate) {
      const firstTarget = addMonthsPreservingAnchor(joinDate, safeCycles, anchorDay);
      if (p.payment_date > firstTarget) {
        if (payDay < anchorDay) {
          let target = `${payYear}-${String(payMonth).padStart(2, '0')}-${String(Math.min(anchorDay, new Date(payYear, payMonth, 0).getDate())).padStart(2, '0')}`;
          if (safeCycles > 1) target = addMonthsPreservingAnchor(target, safeCycles - 1, anchorDay);
          currentDueDate = target;
        } else {
          currentDueDate = addMonthsPreservingAnchor(
            `${payYear}-${String(payMonth).padStart(2, '0')}-${String(Math.min(anchorDay, new Date(payYear, payMonth, 0).getDate())).padStart(2, '0')}`,
            safeCycles,
            anchorDay
          );
        }
      } else {
        currentDueDate = firstTarget;
      }
    } else {
      if (p.payment_date <= currentDueDate) {
        currentDueDate = addMonthsPreservingAnchor(currentDueDate, safeCycles, anchorDay);
      } else {
        if (payDay < anchorDay) {
          let target = `${payYear}-${String(payMonth).padStart(2, '0')}-${String(Math.min(anchorDay, new Date(payYear, payMonth, 0).getDate())).padStart(2, '0')}`;
          if (safeCycles > 1) target = addMonthsPreservingAnchor(target, safeCycles - 1, anchorDay);
          currentDueDate = target;
        } else {
          currentDueDate = addMonthsPreservingAnchor(
            `${payYear}-${String(payMonth).padStart(2, '0')}-${String(Math.min(anchorDay, new Date(payYear, payMonth, 0).getDate())).padStart(2, '0')}`,
            safeCycles,
            anchorDay
          );
        }
      }
    }
  }

  return currentDueDate || addMonthsPreservingAnchor(joinDate, 1, anchorDay);
}

// ─── Acciones ─────────────────────────────────────────────────────────────────

async function diagnose() {
  console.log('🔍 DIAGNÓSTICO DE DATOS LOCALES\n');

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, join_date, next_payment_date, plan_id, status, enrollment_paid');

  const { data: plans } = await supabase.from('plans').select('id, name, price, currency');
  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p; });

  const { data: allPayments } = await supabase
    .from('payments')
    .select('id, client_id, plan_id, amount_usd, amount_bs, payment_type, discount_type, discount_value, payment_date, exchange_rate')
    .eq('is_archived', false);

  const paymentsByClient = {};
  for (const p of allPayments || []) {
    const key = `${p.client_id}-${p.plan_id}`;
    if (!paymentsByClient[key]) paymentsByClient[key] = [];
    paymentsByClient[key].push(p);
  }

  let problematicClients = 0;
  let totalDatesToFix = 0;
  let totalStatusToFix = 0;

  console.log('📊 Resumen por cliente:\n');
  console.log('   Nombre                       | Plan     | Status  | Next Payment | Problema');
  console.log('   ' + '-'.repeat(90));

  for (const client of clients || []) {
    const plan = planMap[client.plan_id];
    if (!plan) continue;

    const clientPayments = paymentsByClient[`${client.id}-${client.plan_id}`] || [];
    const planPrice = parseFloat(plan.price) || 0;
    if (planPrice <= 0 || clientPayments.length === 0) continue;

    // Calcular total efectivo con conversión correcta
    let totalEffective = 0;
    for (const p of clientPayments) {
      totalEffective += getEffectiveAmount(p, plan);
    }

    const expectedDate = await computeNextPaymentDate(client.join_date, clientPayments, planPrice);
    const storedDate = client.next_payment_date;

    // Detectar problemas
    const issues = [];

    // Fecha anómala (muy lejana o muy pasada)
    if (expectedDate && storedDate) {
      const storedYear = parseInt(storedDate.split('-')[0], 10);
      const expectedYear = parseInt(expectedDate.split('-')[0], 10);
      const currentYear = new Date().getFullYear();

      if (storedYear > currentYear + 2 || storedYear < currentYear - 1) {
        issues.push('fecha_extrema');
      } else if (storedDate !== expectedDate) {
        issues.push('fecha_desfasada');
      }
    }

    // Calcular estado esperado
    const cycles = Math.floor(totalEffective / planPrice);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let daysUntil = null;
    if (expectedDate) {
      daysUntil = Math.round((new Date(expectedDate) - new Date(todayStr + 'T00:00:00')) / 86400000);
    }

    let expectedStatus;
    if (cycles >= 1 && daysUntil !== null && daysUntil >= 0) expectedStatus = 'activo';
    else if (daysUntil !== null && daysUntil < 0) expectedStatus = 'inactivo';
    else if (totalEffective > 0 && totalEffective % planPrice > 0.01) expectedStatus = 'pendiente';
    else expectedStatus = 'inactivo';

    if (client.status && client.status !== expectedStatus) {
      issues.push(`status:${client.status}→${expectedStatus}`);
    }

    if (issues.length > 0) {
      problematicClients++;
      if (issues.includes('fecha_extrema') || issues.includes('fecha_desfasada')) totalDatesToFix++;
      if (issues.some(i => i.startsWith('status:'))) totalStatusToFix++;

      const name = `${client.first_name} ${client.last_name}`.padEnd(26);
      const planName = (plan.name || '?').padEnd(9);
      const status = (client.status || '?').padEnd(8);
      const nextPay = (storedDate || '?').padEnd(12);
      const issue = issues.join(', ');
      console.log(`   ${name} | ${planName} | ${status} | ${nextPay} | ${issue}`);
    }
  }

  console.log(`\n📈 RESUMEN:`);
  console.log(`   Clientes con problemas: ${problematicClients}`);
  console.log(`   Fechas a corregir: ${totalDatesToFix}`);
  console.log(`   Estados a corregir: ${totalStatusToFix}`);
  console.log(`\n💡 Para aplicar correcciones: node scripts/fix-local-data.js --apply`);
  console.log(`   Para solo ver sin cambiar: node scripts/fix-local-data.js --dry-run`);
}

async function applyFixes() {
  console.log('🔧 CORGIENDO DATOS...\n');

  // Hacer backup primero
  const { data: clientsBackup } = await supabase
    .from('clients')
    .select('id, join_date, next_payment_date, status');

  const backupTable = 'clients_backup_' + Date.now();
  await supabase.from(backupTable).insert(clientsBackup);
  console.log(`✅ Backup creado en tabla: ${backupTable}`);

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, join_date, next_payment_date, plan_id, status');

  const { data: plans } = await supabase.from('plans').select('id, name, price, currency');
  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p; });

  const { data: allPayments } = await supabase
    .from('payments')
    .select('id, client_id, plan_id, amount_usd, amount_bs, payment_type, discount_type, discount_value, payment_date, exchange_rate')
    .eq('is_archived', false);

  const paymentsByClient = {};
  for (const p of allPayments || []) {
    const key = `${p.client_id}-${p.plan_id}`;
    if (!paymentsByClient[key]) paymentsByClient[key] = [];
    paymentsByClient[key].push(p);
  }

  let datesFixed = 0;
  let statusFixed = 0;

  for (const client of clients || []) {
    const plan = planMap[client.plan_id];
    if (!plan) continue;

    const clientPayments = paymentsByClient[`${client.id}-${client.plan_id}`] || [];
    const planPrice = parseFloat(plan.price) || 0;
    if (planPrice <= 0) continue;

    // Calcular total efectivo
    let totalEffective = 0;
    for (const p of clientPayments) {
      totalEffective += getEffectiveAmount(p, plan);
    }

    // Calcular nueva fecha
    const expectedDate = await computeNextPaymentDate(client.join_date, clientPayments, planPrice);

    if (expectedDate && expectedDate !== client.next_payment_date) {
      await supabase.from('clients').update({ next_payment_date: expectedDate }).eq('id', client.id);
      datesFixed++;
      console.log(`   📅 ${client.first_name} ${client.last_name}: ${client.next_payment_date} → ${expectedDate}`);
    }

    // Calcular nuevo estado
    const cycles = Math.floor(totalEffective / planPrice);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let daysUntil = null;
    if (expectedDate) {
      daysUntil = Math.round((new Date(expectedDate) - new Date(todayStr + 'T00:00:00')) / 86400000);
    }

    let newStatus;
    if (cycles >= 1 && daysUntil !== null && daysUntil >= 0) newStatus = 'activo';
    else if (daysUntil !== null && daysUntil < 0) newStatus = 'inactivo';
    else if (totalEffective > 0 && totalEffective % planPrice > 0.01) newStatus = 'pendiente';
    else newStatus = 'inactivo';

    if (client.status !== newStatus) {
      await supabase.from('clients').update({ status: newStatus }).eq('id', client.id);
      statusFixed++;
      console.log(`   📊 ${client.first_name} ${client.last_name}: ${client.status} → ${newStatus}`);
    }
  }

  console.log(`\n🎉 Correcciones aplicadas:`);
  console.log(`   - Fechas corregidas: ${datesFixed}`);
  console.log(`   - Estados corregidos: ${statusFixed}`);
  console.log(`\n💾 Backup disponible en: ${backupTable}`);
  console.log('   Para revertir: node scripts/fix-local-data.js --revert');
}

async function revertFixes() {
  // Buscar la tabla de backup más reciente
  const { data: tables } = await supabase
    .from('clients_backup_')
    .select('*')
    .limit(0); // Solo para verificar existencia

  // Listar todas las tablas de backup
  const { data: allTables } = await supabase.rpc('pg_tables');

  const backupTables = (allTables || [])
    .filter(t => t.tablename.startsWith('clients_backup_'))
    .sort((a, b) => b.tablename.localeCompare(a.tablename));

  if (backupTables.length === 0) {
    console.log('❌ No se encontraron backups para revertir.');
    console.log('   Primero ejecuta: node scripts/fix-local-data.js --apply');
    return;
  }

  const latestBackup = backupTables[0].tablename;
  console.log(`🔄 Revertiendo desde backup: ${latestBackup}\n`);

  // Obtener datos del backup
  const { data: backupData } = await supabase.from(latestBackup).select('id, join_date, next_payment_date, status');

  // Revertir
  for (const record of backupData || []) {
    if (record.next_payment_date || record.status) {
      await supabase.from('clients').update({
        next_payment_date: record.next_payment_date,
        status: record.status,
      }).eq('id', record.id);
    }
  }

  console.log(`✅ ${backupData?.length || 0} registros revertidos.`);
  console.log(`💾 Backup original conservado en: ${latestBackup}`);
  console.log('   Para eliminar el backup: DELETE FROM postgres.pg_tables WHERE tablename = \'' + latestBackup + '\' (requiere SQL directo)');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const action = args.find(a => a.startsWith('--'))?.replace('--', '') || 'diagnose';

  switch (action) {
    case 'apply':
      await applyFixes();
      break;
    case 'revert':
      await revertFixes();
      break;
    case 'dry-run':
    case 'diagnose':
    default:
      await diagnose();
      break;
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
