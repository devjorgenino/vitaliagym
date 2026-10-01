/**
 * Script para corregir status y fechas en PRODUCCIÓN.
 * 
 * Uso:
 *   node scripts/fix-status-production.js --apply    # Corregir todo
 *   node scripts/fix-status-production.js --dry-run  # Solo ver qué cambiaría
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const PROD_URL = process.env.SUPABASE_PROD_URL;
const PROD_KEY = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY;

if (!PROD_URL || !PROD_KEY) {
  console.error('❌ Faltan variables SUPABASE_PROD_URL y/o SUPABASE_PROD_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(PROD_URL, PROD_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const INSCRIPTION_PRICE = 5;
const MAX_DAYS_ACTIVE = 30;
const MAX_CYCLES = 12;

/**
 * Calcula el monto efectivo de un pago
 */
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

/**
 * Agrega N meses preservando el día ancla
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
 * Calcula la próxima fecha de pago
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentDueDate = null;
  let accumulatedBalance = 0;

  for (const p of sortedPayments) {
    const amount = getEffectiveAmount(p);
    if (amount <= 0) continue;

    accumulatedBalance += amount;
    
    if (accumulatedBalance >= planPrice) {
      const cycles = Math.floor(accumulatedBalance / planPrice);
      const remainder = accumulatedBalance % planPrice;
      
      const lastPaymentDate = new Date(p.payment_date);
      let newDueDate = addMonthsPreservingAnchor(
        lastPaymentDate.toISOString().split('T')[0],
        cycles,
        anchorDay
      );
      
      if (newDueDate && currentDueDate && newDueDate < currentDueDate) {
        newDueDate = currentDueDate;
      }
      
      currentDueDate = newDueDate;
      accumulatedBalance = remainder;
    }
  }

  if (accumulatedBalance >= planPrice * 0.99) {
    const lastPaymentDate = new Date(sortedPayments[sortedPayments.length - 1].payment_date);
    currentDueDate = addMonthsPreservingAnchor(
      lastPaymentDate.toISOString().split('T')[0],
      1,
      anchorDay
    );
  }

  if (!currentDueDate || currentDueDate < today.toISOString().split('T')[0]) {
    const lastPaymentDate = new Date(sortedPayments[sortedPayments.length - 1].payment_date);
    let candidate = addMonthsPreservingAnchor(
      lastPaymentDate.toISOString().split('T')[0],
      1,
      anchorDay
    );
    
    while (candidate && candidate < today.toISOString().split('T')[0]) {
      candidate = addMonthsPreservingAnchor(candidate, 1, anchorDay);
    }
    
    currentDueDate = candidate || today.toISOString().split('T')[0];
  }

  return currentDueDate;
}

/**
 * Corrige el status de todos los clientes
 */
async function fixAllClientStatuses(dryRun = false) {
  const { data: allClients, error: fetchError } = await supabase
    .from('clients')
    .select('id, first_name, last_name, status, next_payment_date, join_date, enrollment_paid, original_join_date, plan_id, plans(id, price, currency)');

  if (fetchError) throw fetchError;
  if (!allClients || allClients.length === 0) {
    return { success: true, updated: 0, total: 0, changes: [] };
  }

  const { data: allPayments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, client_id, plan_id, amount_usd, amount_bs, exchange_rate, payment_type, discount_type, discount_value, payment_date, is_archived');

  if (paymentsError) throw paymentsError;

  const validPayments = (allPayments || []).filter(p => !p.is_archived);
  
  const clientPaymentsMap = {};
  validPayments.forEach(p => {
    if (!clientPaymentsMap[p.client_id]) clientPaymentsMap[p.client_id] = [];
    clientPaymentsMap[p.client_id].push(p);
  });

  const planMap = {};
  (allClients || []).forEach(c => {
    if (c.plans) planMap[c.plan_id] = c.plans;
  });

  const updates = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const clientData of allClients) {
    const plan = planMap[clientData.plan_id];
    if (!plan) continue;

    const planPrice = parseFloat(plan.price) || 0;
    if (planPrice <= 0) continue;

    const clientPayments = clientPaymentsMap[clientData.id] || [];
    
    const totalPaid = clientPayments.reduce(
      (sum, p) => sum + getEffectiveAmount(p, plan),
      0
    );

    let daysSinceLastPayment = 999;
    if (clientPayments.length > 0) {
      const lastPaymentDate = Math.max(
        ...clientPayments.map(p => new Date(p.payment_date).getTime())
      );
      daysSinceLastPayment = Math.floor((now.getTime() - lastPaymentDate) / (1000 * 60 * 60 * 24));
    }

    const cycles = Math.floor(totalPaid / planPrice);
    const remainder = totalPaid % planPrice;
    const isFullyPaid = remainder < 0.001;
    const hasHadReset = !!clientData.original_join_date;

    const joinDate = new Date(clientData.join_date);
    const daysSinceJoin = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));

    let newStatus;
    if (clientPayments.length === 0) {
      newStatus = (hasHadReset || now < joinDate || daysSinceJoin <= 7) ? 'pendiente' : 'inactivo';
    } else if (isFullyPaid && cycles >= MAX_CYCLES) {
      newStatus = 'finalizado';
    } else if (daysSinceLastPayment <= MAX_DAYS_ACTIVE) {
      newStatus = 'activo';
    } else {
      newStatus = 'inactivo';
    }

    if (newStatus !== clientData.status) {
      updates.push({
        id: clientData.id,
        name: `${clientData.first_name} ${clientData.last_name}`,
        oldStatus: clientData.status,
        newStatus,
        daysSinceLast: daysSinceLastPayment,
        totalPaid: totalPaid.toFixed(2)
      });
    }
  }

  if (updates.length === 0) {
    return { success: true, updated: 0, total: allClients.length, changes: [] };
  }

  if (dryRun) {
    console.log(`\n📊 [DRY RUN] Se corregirían ${updates.length} status:`);
    const counts = {};
    updates.forEach(u => {
      const key = u.oldStatus + ' -> ' + u.newStatus;
      counts[key] = (counts[key] || 0) + 1;
    });
    Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    return { success: true, updated: 0, total: allClients.length, changes: updates, dryRun: true };
  }

  // Hacer backup
  const backupTable = 'clients_backup_' + Date.now();
  await supabase.from(backupTable).insert(updates.map(u => ({
    id: u.id,
    status: u.oldStatus
  })));
  console.log(`💾 Backup creado en: ${backupTable}`);

  // Aplicar cambios
  let applied = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('clients')
      .update({ status: u.newStatus })
      .eq('id', u.id);
    
    if (error) {
      console.error(`❌ Error actualizando ${u.name}: ${error.message}`);
    } else {
      applied++;
    }
  }

  return { success: true, updated: applied, total: allClients.length, changes: updates };
}

/**
 * Recalcula todas las fechas de próximo pago
 */
async function recalculateAllNextPaymentDates(dryRun = false) {
  const { data: allClients, error: fetchError } = await supabase
    .from('clients')
    .select('id, first_name, last_name, join_date, plan_id, next_payment_date, plans(id, price, currency)');

  if (fetchError) throw fetchError;
  if (!allClients || allClients.length === 0) {
    return { success: true, updated: 0, total: 0 };
  }

  const { data: allPayments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, client_id, plan_id, payment_date, is_archived')
    .eq('is_archived', false)
    .order('payment_date', { ascending: true });

  if (paymentsError) throw paymentsError;

  const updates = [];
  const planMap = {};
  (allClients || []).forEach(c => {
    if (c.plans) planMap[c.plan_id] = c.plans;
  });

  for (const clientData of allClients) {
    const plan = planMap[clientData.plan_id];
    if (!plan) continue;

    const planPrice = parseFloat(plan.price) || 0;
    if (planPrice <= 0) continue;

    const clientPayments = (allPayments || []).filter(
      p => p.client_id === clientData.id
    );

    const newNextPaymentDate = await computeNextPaymentDate(
      clientData.join_date,
      clientPayments,
      planPrice
    );

    if (newNextPaymentDate && newNextPaymentDate !== clientData.next_payment_date) {
      updates.push({
        id: clientData.id,
        name: `${clientData.first_name} ${clientData.last_name}`,
        oldDate: clientData.next_payment_date,
        newDate: newNextPaymentDate
      });
    }
  }

  if (updates.length === 0) {
    return { success: true, updated: 0, total: allClients.length };
  }

  if (dryRun) {
    console.log(`\n📊 [DRY RUN] Se corregirían ${updates.length} fechas:`);
    updates.slice(0, 10).forEach(u => {
      console.log(`  ${u.name}: ${u.oldDate} -> ${u.newDate}`);
    });
    if (updates.length > 10) console.log(`  ... y ${updates.length - 10} más`);
    return { success: true, updated: 0, total: allClients.length, changes: updates, dryRun: true };
  }

  // Hacer backup
  const backupTable = 'clients_dates_backup_' + Date.now();
  await supabase.from(backupTable).insert(updates.map(u => ({
    id: u.id,
    next_payment_date: u.oldDate
  })));
  console.log(`💾 Backup de fechas creado en: ${backupTable}`);

  // Aplicar cambios
  let applied = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('clients')
      .update({ next_payment_date: u.newDate })
      .eq('id', u.id);
    
    if (error) {
      console.error(`❌ Error actualizando fecha de ${u.name}: ${error.message}`);
    } else {
      applied++;
    }
  }

  return { success: true, updated: applied, total: allClients.length };
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const action = args.find(a => a.startsWith('--'))?.replace('--', '') || 'dry-run';
  const dryRun = action !== 'apply';

  console.log('\n========================================');
  console.log('SCRIPT DE CORRECCIÓN - PRODUCCIÓN');
  console.log('========================================\n');

  try {
    // 1. Fix statuses
    console.log('🔧 Paso 1: Corrigiendo status de clientes...');
    const statusResult = await fixAllClientStatuses(dryRun);
    console.log(`✅ Status: ${statusResult.updated} corregidos de ${statusResult.total}`);
    
    if (statusResult.changes && statusResult.changes.length > 0) {
      const counts = {};
      statusResult.changes.forEach(c => {
        const key = c.oldStatus + ' -> ' + c.newStatus;
        counts[key] = (counts[key] || 0) + 1;
      });
      console.log('   Distribución de cambios:');
      Object.entries(counts).forEach(([k, v]) => console.log(`     ${k}: ${v}`));
    }

    // 2. Fix dates
    console.log('\n🔧 Paso 2: Corrigiendo fechas de próximo pago...');
    const dateResult = await recalculateAllNextPaymentDates(dryRun);
    console.log(`✅ Fechas: ${dateResult.updated} corregidas de ${dateResult.total}`);
    
    if (dateResult.changes && dateResult.changes.length > 0) {
      console.log('   Ejemplos de cambios:');
      dateResult.changes.slice(0, 5).forEach(c => {
        console.log(`     ${c.name}: ${c.oldDate} -> ${c.newDate}`);
      });
      if (dateResult.changes.length > 5) {
        console.log(`     ... y ${dateResult.changes.length - 5} más`);
      }
    }

    console.log('\n========================================');
    if (dryRun) {
      console.log('✅ DRY RUN COMPLETADO - No se aplicaron cambios');
      console.log('   Para aplicar: node scripts/fix-status-production.js --apply');
    } else {
      console.log('✅ CORRECCIÓN COMPLETADA');
    }
    console.log('========================================\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
