/**
 * Script de auditoría completo de clientes y pagos.
 * Revisa inconsistencias en datos, saldos, fechas y estados.
 *
 * Uso:
 *   node scripts/audit-clients-payments.js              # Auditoría completa
 *   node scripts/audit-clients-payments.js --summary    # Solo resumen
 *   node scripts/audit-clients-payments.js --json       # Salida en JSON
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

function getEffectiveAmount(payment, plan) {
  if (!payment) return 0;
  let field = 'amount_usd';
  if (payment.payment_type === 'efectivo_bolivares') field = 'amount_bs';
  else if (payment.payment_type === 'efectivo_dolares') field = 'amount_usd';
  else field = (plan?.currency || 'USD').toUpperCase() === 'BS' ? 'amount_bs' : 'amount_usd';

  let amount = parseFloat(payment[field]) || 0;
  const isBSPlan = (plan?.currency || 'USD').toUpperCase() === 'BS';

  if (payment.payment_type === 'efectivo_bolivares' && !isBSPlan) {
    const rate = payment.exchange_rate || 310;
    amount = amount / rate;
  }

  if (payment.discount_type === 'percentage' && payment.discount_value) {
    const disc = parseFloat(payment.discount_value) || 0;
    const safeDisc = Math.min(disc, 95);
    if (disc > 0 && disc < 100) amount = amount / (1 - safeDisc / 100);
  } else if (payment.discount_type === 'fixed' && payment.discount_value) {
    amount += parseFloat(payment.discount_value) || 0;
  }

  const maxAmount = isBSPlan ? 1000000 : 10000;
  return Math.min(amount, maxAmount);
}

function calculateDaysUntilPayment(nextPaymentDate) {
  if (!nextPaymentDate) return null;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const diffTime = new Date(nextPaymentDate + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// ─── Auditoría ────────────────────────────────────────────────────────────────

async function runAudit(options = {}) {
  const { summaryOnly = false, jsonOutput = false } = options;

  // Obtener todos los datos
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*');

  if (clientsError) {
    console.error('❌ Error al obtener clientes:', clientsError.message);
    return;
  }

  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('*');

  if (plansError) {
    console.error('❌ Error al obtener planes:', plansError.message);
    return;
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('is_archived', false);

  if (paymentsError) {
    console.error('❌ Error al obtener pagos:', paymentsError.message);
    return;
  }

  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p; });

  const paymentsByClient = {};
  for (const p of payments || []) {
    const key = `${p.client_id}-${p.plan_id}`;
    if (!paymentsByClient[key]) paymentsByClient[key] = [];
    paymentsByClient[key].push(p);
  }

  // Variables de control
  const stats = {
    totalClients: clients?.length || 0,
    activeClients: 0,
    inactiveClients: 0,
    pendingClients: 0,
    noPlanClients: 0,
    noJoinDateClients: 0,
    noPaymentsClients: 0,
  };

  const issues = {
    missingFields: [],
    invalidDates: [],
    missingPlan: [],
    missingJoinDate: [],
    paymentAnomalies: [],
    statusMismatch: [],
    dateMismatch: [],
    balanceIssues: [],
    zeroPaymentClients: [],
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  for (const client of clients || []) {
    const plan = planMap[client.plan_id];
    const clientPayments = paymentsByClient[`${client.id}-${client.plan_id}`] || [];
    const planPrice = plan ? parseFloat(plan.price) || 0 : 0;

    // Contar por estado
    if (client.status === 'activo') stats.activeClients++;
    else if (client.status === 'inactivo') stats.inactiveClients++;
    else if (client.status === 'pendiente') stats.pendingClients++;

    // Validaciones básicas
    if (!client.plan_id) {
      issues.noPlanClients++;
      issues.missingFields.push({ client: `${client.first_name} ${client.last_name}`, field: 'plan_id' });
    }

    if (!client.join_date) {
      issues.noJoinDateClients++;
      issues.missingFields.push({ client: `${client.first_name} ${client.last_name}`, field: 'join_date' });
    }

    if (clientPayments.length === 0) {
      issues.noPaymentsClients++;
    }

    // Calcular totales
    let totalEffective = 0;
    let hasAnomaly = false;

    for (const p of clientPayments) {
      const effective = getEffectiveAmount(p, plan);
      totalEffective += effective;

      // Detectar pagos anómalos
      if (effective > (planPrice * 12)) {
        hasAnomaly = true;
        issues.paymentAnomalies.push({
          client: `${client.first_name} ${client.last_name}`,
          paymentId: p.id,
          date: p.payment_date,
          type: p.payment_type,
          amount: p[payment_type === 'efectivo_bolivares' ? 'amount_bs' : 'amount_usd'],
          effective: Math.round(effective * 100) / 100,
          reason: 'Monto excesivo (>12 meses)',
        });
      }
    }

    if (clientPayments.length === 0 && client.status === 'activo') {
      issues.zeroPaymentClients.push({
        client: `${client.first_name} ${client.last_name}`,
        status: client.status,
        nextPayment: client.next_payment_date,
      });
    }

    // Calcular fecha esperada
    if (client.join_date && planPrice > 0) {
      const expectedDate = addMonthsPreservingAnchor(
        client.join_date,
        Math.max(1, Math.floor(totalEffective / planPrice)),
        parseInt(client.join_date.split('-')[2], 10)
      );

      // Verificar discrepancia de fechas
      if (client.next_payment_date && client.next_payment_date !== expectedDate) {
        const storedYear = parseInt(client.next_payment_date.split('-')[0], 10);
        const currentYear = today.getFullYear();

        if (storedYear > currentYear + 1 || storedYear < currentYear - 1) {
          issues.dateMismatch.push({
            client: `${client.first_name} ${client.last_name}`,
            stored: client.next_payment_date,
            expected: expectedDate,
            reason: 'Fecha extrema o desfasada',
          });
        }
      }
    }

    // Verificar estado vs saldo
    const cycles = Math.floor(totalEffective / planPrice);
    const remainder = totalEffective % planPrice;
    const daysUntil = calculateDaysUntilPayment(client.next_payment_date);
    const isFullyPaid = remainder < 0.001;

    let expectedStatus;
    if (cycles >= 1 && daysUntil !== null && daysUntil >= 0) expectedStatus = 'activo';
    else if (daysUntil !== null && daysUntil < 0) expectedStatus = 'inactivo';
    else if (totalEffective > 0 && !isFullyPaid) expectedStatus = 'pendiente';
    else expectedStatus = 'inactivo';

    if (client.status && client.status !== expectedStatus) {
      issues.statusMismatch.push({
        client: `${client.first_name} ${client.last_name}`,
        stored: client.status,
        expected: expectedStatus,
        cycles,
        daysUntil,
      });
    }
  }

  // ─── Output ─────────────────────────────────────────────────────────────────

  if (jsonOutput) {
    console.log(JSON.stringify({ stats, issues }, null, 2));
    return;
  }

  if (summaryOnly) {
    console.log('📊 RESUMEN DE AUDITORÍA\n');
    console.log(`Total clientes: ${stats.totalClients}`);
    console.log(`  - Activos: ${stats.activeClients}`);
    console.log(`  - Inactivos: ${stats.inactiveClients}`);
    console.log(`  - Pendientes: ${stats.pendingClients}`);
    console.log(`  - Sin plan: ${stats.noPlanClients}`);
    console.log(`  - Sin join_date: ${stats.noJoinDateClients}`);
    console.log(`  - Sin pagos: ${stats.noPaymentsClients}`);
    console.log(`\nInconsistencias detectadas:`);
    console.log(`  - Pagos anómalos: ${issues.paymentAnomalies.length}`);
    console.log(`  - Fechas inconsistentes: ${issues.dateMismatch.length}`);
    console.log(`  - Estados inconsistentes: ${issues.statusMismatch.length}`);
    console.log(`  - Clientes con 0 pagos activos: ${issues.zeroPaymentClients.length}`);
    return;
  }

  // Reporte completo
  console.log('🔍 AUDITORÍA COMPLETA DE CLIENTES Y PAGOS\n');

  // Estadísticas generales
  console.log('📊 ESTADÍSTICAS GENERALES:');
  console.log(`   Total clientes: ${stats.totalClients}`);
  console.log(`   Activos: ${stats.activeClients}`);
  console.log(`   Inactivos: ${stats.inactiveClients}`);
  console.log(`   Pendientes: ${stats.pendingClients}`);
  console.log(`   Sin plan asignado: ${stats.noPlanClients}`);
  console.log(`   Sin fecha de ingreso: ${stats.noJoinDateClients}`);
  console.log(`   Sin pagos registrados: ${stats.noPaymentsClients}`);

  // Camplos faltantes
  if (issues.missingFields.length > 0) {
    console.log('\n⚠️  CAMPOS FALTANTES:');
    issues.missingFields.forEach(f => {
      console.log(`   ${f.client}: falta ${f.field}`);
    });
  }

  // Pagos anómalos
  if (issues.paymentAnomalies.length > 0) {
    console.log(`\n⚠️  PAGOS ANÓMALOS (${issues.paymentAnomalies.length}):`);
    console.log('   Cliente                      | Fecha Pago | Tipo             | Monto Raw | Monto Efectivo | Razón');
    console.log('   ' + '-'.repeat(100));
    issues.paymentAnomalies.forEach(p => {
      const name = `${p.client}`.padEnd(26);
      const date = (p.date || '?').padEnd(12);
      const type = (p.type || '?').padEnd(15);
      const raw = (p.amount || 0).toFixed(0).padEnd(10);
      const effective = (p.effective || 0).toFixed(0).padEnd(13);
      console.log(`   ${name} | ${date} | ${type} | $${raw} | $${effective} | ${p.reason}`);
    });
  }

  // Fechas inconsistentes
  if (issues.dateMismatch.length > 0) {
    console.log(`\n⚠️  FECHAS INCONSISTENTES (${issues.dateMismatch.length}):`);
    console.log('   Cliente                       | Almacenada   | Esperada     | Razón');
    console.log('   ' + '-'.repeat(80));
    issues.dateMismatch.forEach(d => {
      const name = `${d.client}`.padEnd(26);
      const stored = (d.stored || '?').padEnd(12);
      const expected = (d.expected || '?').padEnd(12);
      console.log(`   ${name} | ${stored} | ${expected} | ${d.reason}`);
    });
  }

  // Estados inconsistentes
  if (issues.statusMismatch.length > 0) {
    console.log(`\n⚠️  ESTADOS INCONSISTENTES (${issues.statusMismatch.length}):`);
    console.log('   Cliente                       | Status Actual | Status Esperado | Ciclos | Días hasta vencimiento');
    console.log('   ' + '-'.repeat(90));
    issues.statusMismatch.forEach(s => {
      const name = `${s.client}`.padEnd(26);
      const stored = (s.stored || '?').padEnd(12);
      const expected = (s.expected || '?').padEnd(12);
      const cycles = `${s.cycles ?? '?'}`.padEnd(7);
      const days = `${s.daysUntil ?? '?'}`.padEnd(20);
      console.log(`   ${name} | ${stored} | ${expected} | ${cycles} | ${days}`);
    });
  }

  // Clientes con 0 pagos
  if (issues.zeroPaymentClients.length > 0) {
    console.log(`\n⚠️  CLIENTES CON 0 PAGOS ACTIVOS (${issues.zeroPaymentClients.length}):`);
    issues.zeroPaymentClients.forEach(c => {
      console.log(`   ${c.client} | Status: ${c.status} | Next: ${c.nextPayment || 'N/A'}`);
    });
  }

  // Resumen final
  const totalIssues = issues.paymentAnomalies.length +
    issues.dateMismatch.length +
    issues.statusMismatch.length +
    issues.missingFields.length;

  console.log('\n📈 RESUMEN FINAL:');
  console.log(`   Problemas críticos: ${totalIssues}`);
  if (totalIssues === 0) {
    console.log('   ✅ No se encontraron problemas. Los datos están consistentes.');
  } else {
    console.log('   💡 Recomendaciones:');
    if (issues.paymentAnomalies.length > 0) console.log('      1. Revisar pagos anómalos y archivar duplicados');
    if (issues.dateMismatch.length > 0) console.log('      2. Corregir fechas de próximo pago');
    if (issues.statusMismatch.length > 0) console.log('      3. Actualizar estados de clientes');
    console.log('\n   Ejecuta: node scripts/fix-local-data.js --apply');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const summaryOnly = args.includes('--summary');
  const jsonOutput = args.includes('--json');

  try {
    await runAudit({ summaryOnly, jsonOutput });
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
