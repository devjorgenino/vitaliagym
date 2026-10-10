/**
 * Comprehensive payment flow validation for VitaliaGym
 * Tests all edge cases and client scenarios
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

config({ path: resolve(fileURLToPath(new URL('.', import.meta.url)), '../.env.local') });
const db = createClient(process.env.SUPABASE_PROD_URL, process.env.SUPABASE_PROD_SERVICE_ROLE_KEY);

// Helper functions
function addMonthsPreservingAnchor(dateStr, months, anchorDay) {
  const [y, m, d] = dateStr.split('-').map(Number);
  let month = m + months - 1;
  let year = y;
  while (month > 11) { month -= 12; year++; }
  while (month < 0) { month += 12; year--; }
  const day = Math.min(anchorDay, new Date(year, month + 1, 0).getDate());
  return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function getAnchorDate(year, month, anchorDay) {
  const day = Math.min(anchorDay, new Date(year, month, 0).getDate());
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function getAnchorDateForTargetMonth(anchorDay, year, month) {
  const day = Math.min(anchorDay, new Date(year, month, 0).getDate());
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

const FALLBACK_EXCHANGE_RATE = 310;
function getPlanFrequency(plan) {
  if (!plan) return 'monthly';
  return (plan.frequency || 'monthly').toLowerCase();
}

function getEffectiveAmount(payment, plan, fallbackRate = FALLBACK_EXCHANGE_RATE) {
  if (!payment) return 0;
  let field = 'amount_usd';
  if (payment?.payment_type === 'efectivo_bolivares') field = 'amount_bs';
  else if (plan && (plan.currency || 'USD').toUpperCase() === 'BS') field = 'amount_bs';
  let amount = parseFloat(payment[field]) || 0;
  const isBSPlan = (plan?.currency || 'USD').toUpperCase() === 'BS';
  if (payment.payment_type === 'efectivo_bolivares' && !isBSPlan) {
    const rate = payment.exchange_rate || fallbackRate;
    amount = amount / rate;
  }
  const maxAmount = isBSPlan ? 1000000 : 10000;
  if (amount > maxAmount) amount = maxAmount;
  return Math.round(amount * 100) / 100;
}

function isMaintenancePayment(payment) {
  if (!payment) return false;
  const ref = (payment.reference || '').toLowerCase();
  return ref.includes('maintenance') || ref.includes('maintenance fee') || ref.includes('mantenimiento');
}

function computeNextPaymentDate(joinDate, clientPayments, plan, planPrice, enrollmentFee = 0) {
  if (!joinDate || planPrice <= 0) return null;
  const frequency = getPlanFrequency(plan);
  if (frequency === 'daily' || frequency === 'weekly') return null;

  const cyclePrice = planPrice + enrollmentFee;
  const anchorDay = parseInt(joinDate.split('-')[2], 10);
  if (!clientPayments || clientPayments.length === 0) {
    return addMonthsPreservingAnchor(joinDate, 1, anchorDay);
  }
  const sortedPayments = [...clientPayments].sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
  let currentDueDate = null;
  let totalEffectiveSoFar = 0;
  let maintenanceBonusSoFar = 0;
  let previousAccumulatedMonths = 0;
  let lastValidPaymentDate = joinDate;
  for (const p of sortedPayments) {
    if (p.payment_date < joinDate) continue;
    lastValidPaymentDate = p.payment_date;
    const [payYear, payMonth, payDay] = p.payment_date.split('-').map(Number);
    const effective = getEffectiveAmount(p, plan);
    const isMaint = isMaintenancePayment(p);
    const isMaintBonus = isMaint && effective > 0 && effective < planPrice;
    totalEffectiveSoFar += effective;
    if (isMaintBonus) maintenanceBonusSoFar++;
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
      const baseTarget = addMonthsPreservingAnchor(joinDate, accumulatedMonths, anchorDay);
      if (p.payment_date > baseTarget) {
        if (payDay < anchorDay) {
          let target = getAnchorDateForTargetMonth(anchorDay, payYear, payMonth);
          if (accumulatedMonths > 1) target = addMonthsPreservingAnchor(target, accumulatedMonths - 1, anchorDay);
          currentDueDate = target;
        } else {
          currentDueDate = addMonthsPreservingAnchor(getAnchorDateForTargetMonth(anchorDay, payYear, payMonth), accumulatedMonths, anchorDay);
        }
      } else {
        currentDueDate = baseTarget;
      }
    } else {
      if (p.payment_date <= currentDueDate) {
        currentDueDate = addMonthsPreservingAnchor(currentDueDate, deltaAccumulated, anchorDay);
      } else {
        if (payDay < anchorDay) {
          currentDueDate = getAnchorDateForTargetMonth(anchorDay, payYear, payMonth);
          if (deltaAccumulated > 1) currentDueDate = addMonthsPreservingAnchor(currentDueDate, deltaAccumulated - 1, anchorDay);
        } else {
          currentDueDate = addMonthsPreservingAnchor(getAnchorDateForTargetMonth(anchorDay, payYear, payMonth), Math.max(deltaAccumulated, 1), anchorDay);
        }
      }
    }
    previousAccumulatedMonths = accumulatedMonths;
  }
  const firstDueDate = addMonthsPreservingAnchor(joinDate, 1, anchorDay);
  const fallbackBase = lastValidPaymentDate > firstDueDate ? lastValidPaymentDate : joinDate;
  return currentDueDate || addMonthsPreservingAnchor(fallbackBase, 1, anchorDay);
}

function getClientStatus(nextPaymentDate, totalPaid, planPrice, enrollmentPaid) {
  const daysUntil = Math.floor((new Date(nextPaymentDate) - Date.now()) / 86400000);
  if (daysUntil < 0) return 'inactivo';
  const cyclePrice = planPrice + (enrollmentPaid ? 5 : 0);
  const cycles = Math.floor(totalPaid / cyclePrice);
  const remainder = totalPaid - (cycles * cyclePrice);
  if (remainder < 0.01) return 'activo';
  if (totalPaid > 0) return 'pendiente';
  return 'inactivo';
}

async function test() {
  const today = new Date().toISOString().split('T')[0];
  const { data: clients } = await db.from('clients').select('*').not('plan_id', 'is', null);
  const { data: payments } = await db.from('payments').select('*');
  const { data: plans } = await db.from('plans').select('*');
  const planMap = {};
  plans.forEach(p => planMap[p.id] = parseFloat(p.price) || 0);

  console.log('========================================');
  console.log('VALIDACIÓN INTEGRAL DE PAGOS - VitaliaGym');
  console.log('Fecha:', today);
  console.log('Total clientes:', clients.length);
  console.log('Total pagos:', payments.length);
  console.log('========================================\n');

  // ── SCENARIO 1: New client with no payments ──
  console.log('📋 ESCENARIO 1: Cliente nuevo sin pagos');
  const newClients = clients.filter(c => {
    const clientPayments = payments.filter(p => p.client_id === c.id);
    return clientPayments.length === 0;
  });
  console.log('  Clientes sin pagos:', newClients.length);
  newClients.slice(0, 3).forEach(c => {
    const expected = addMonthsPreservingAnchor(c.join_date, 1, parseInt(c.join_date.split('-')[2]));
    const ok = expected === c.next_payment_date ? '✅' : '❌';
    console.log(`  ${ok} ${c.first_name} ${c.last_name}: join=${c.join_date} → next=${c.next_payment_date} (expected=${expected})`);
  });

  // ── SCENARIO 2: Single payment (first cycle) ──
  console.log('\n📋 ESCENARIO 2: Un solo pago (ciclo inicial)');
  const singlePaymentClients = clients.filter(c => {
    const cp = payments.filter(p => p.client_id === c.id);
    return cp.filter(p => p.payment_date >= c.join_date).length === 1;
  });
  console.log('  Clientes con 1 pago válido:', singlePaymentClients.length);
  singlePaymentClients.slice(0, 5).forEach(c => {
    const planPrice = planMap[c.plan_id] || 25;
    const enrollmentFee = c.enrollment_paid ? 5 : 0;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const expected = computeNextPaymentDate(c.join_date, validPayments, planPrice, enrollmentFee);
    const totalPaid = validPayments.reduce((s, p) => s + p.amount_usd, 0);
    const status = getClientStatus(expected, totalPaid, planPrice, c.enrollment_paid);
    const ok = expected === c.next_payment_date ? '✅' : '❌';
    console.log(`  ${ok} ${c.first_name} ${c.last_name}: paid=$${totalPaid.toFixed(2)} on ${validPayments[0]?.payment_date} → next=${expected} (stored=${c.next_payment_date}) [${status}]`);
  });

  // ── SCENARIO 3: Multiple on-time payments (full cycles) ──
  console.log('\n📋 ESCENARIO 3: Múltiples pagos a tiempo (ciclos completos)');
  const multiPaymentClients = clients.filter(c => {
    const cp = payments.filter(p => p.client_id === c.id);
    return cp.filter(p => p.payment_date >= c.join_date).length >= 3;
  });
  console.log('  Clientes con 3+ pagos válidos:', multiPaymentClients.length);
  multiPaymentClients.slice(0, 8).forEach(c => {
    const planPrice = planMap[c.plan_id] || 25;
    const enrollmentFee = c.enrollment_paid ? 5 : 0;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const expected = computeNextPaymentDate(c.join_date, validPayments, planPrice, enrollmentFee);
    const totalPaid = validPayments.reduce((s, p) => s + p.amount_usd, 0);
    const status = getClientStatus(expected, totalPaid, planPrice, c.enrollment_paid);
    const ok = expected === c.next_payment_date ? '✅' : '❌';
    console.log(`  ${ok} ${c.first_name} ${c.last_name}: ${validPayments.length} pagos válidos, $${totalPaid.toFixed(2)} → next=${expected} (stored=${c.next_payment_date}) [${status}]`);
  });

  // ── SCENARIO 4: Pre-join payments (should be ignored) ──
  console.log('\n📋 ESCENARIO 4: Pagos ANTES del join_date (deben descartarse)');
  const preJoinClients = [];
  for (const c of clients) {
    const allPayments = payments.filter(p => p.client_id === c.id);
    const prePayments = allPayments.filter(p => p.payment_date < c.join_date);
    if (prePayments.length > 0) preJoinClients.push({ client: c, prePayments, allPayments });
  }
  console.log('  Clientes con pagos antes del join:', preJoinClients.length);
  preJoinClients.slice(0, 8).forEach(({ client: c, prePayments, allPayments }) => {
    const planPrice = planMap[c.plan_id] || 25;
    const enrollmentFee = c.enrollment_paid ? 5 : 0;
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const totalValid = validPayments.reduce((s, p) => s + p.amount_usd, 0);
    const expected = computeNextPaymentDate(c.join_date, validPayments, planPrice, enrollmentFee);
    const status = getClientStatus(expected, totalValid, planPrice, c.enrollment_paid);
    const ok = expected === c.next_payment_date ? '✅' : '❌';
    console.log(`  ${ok} ${c.first_name} ${c.last_name}: ${prePayments.length} pagos pre-join ignorados, $${totalValid.toFixed(2)} válidos → next=${expected} (stored=${c.next_payment_date}) [${status}]`);
  });

  // ── SCENARIO 5: Partial payment (pendiente status) ──
  console.log('\n📋 ESCENARIO 5: Pago parcial (status pendiente)');
  const pendingClients = clients.filter(c => c.status === 'pendiente');
  console.log('  Clientes con status "pendiente":', pendingClients.length);
  pendingClients.slice(0, 5).forEach(c => {
    const planPrice = planMap[c.plan_id] || 25;
    const enrollmentFee = c.enrollment_paid ? 5 : 0;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const totalPaid = validPayments.reduce((s, p) => s + p.amount_usd, 0);
    const expected = computeNextPaymentDate(c.join_date, validPayments, planPrice, enrollmentFee);
    const computedStatus = getClientStatus(expected, totalPaid, planPrice, c.enrollment_paid);
    const ok = computedStatus === 'pendiente' ? '✅' : '⚠️';
    console.log(`  ${ok} ${c.first_name} ${c.last_name}: $${totalPaid.toFixed(2)} pagado, expected=${expected} → status=${computedStatus} (stored=${c.status})`);
  });

  // ── SCENARIO 6: Reactivation after inactivity ──
  console.log('\n📋 ESCENARIO 6: Reactivación después de inactividad');
  const inactivoWithRecentPayment = clients.filter(c => {
    if (c.status !== 'inactivo') return false;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    if (validPayments.length === 0) return false;
    const lastPay = new Date(validPayments[validPayments.length - 1].payment_date);
    const daysSince = (Date.now() - lastPay.getTime()) / 86400000;
    return daysSince < 60;
  });
  console.log('  Inactivos con pago reciente (<60 días):', inactivoWithRecentPayment.length);
  inactivoWithRecentPayment.slice(0, 5).forEach(c => {
    const planPrice = planMap[c.plan_id] || 25;
    const enrollmentFee = c.enrollment_paid ? 5 : 0;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const totalPaid = validPayments.reduce((s, p) => s + p.amount_usd, 0);
    const expected = computeNextPaymentDate(c.join_date, validPayments, planPrice, enrollmentFee);
    const computedStatus = getClientStatus(expected, totalPaid, planPrice, c.enrollment_paid);
    const ok = computedStatus === 'activo' ? '✅' : '⚠️';
    console.log(`  ${ok} ${c.first_name} ${c.last_name}: stored_status=${c.status} → computed=${computedStatus}, next=${expected} (stored=${c.next_payment_date})`);
  });

  // ── SCENARIO 7: Special anchor days (30/31) ──
  console.log('\n📋 ESCENARIO 7: Anclas especiales (días 30/31)');
  const anchorTests = clients.filter(c => {
    const day = parseInt(c.join_date.split('-')[2]);
    return day === 30 || day === 31;
  }).slice(0, 5);
  anchorTests.forEach(c => {
    const planPrice = planMap[c.plan_id] || 25;
    const enrollmentFee = c.enrollment_paid ? 5 : 0;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const expected = computeNextPaymentDate(c.join_date, validPayments, planPrice, enrollmentFee);
    const totalPaid = validPayments.reduce((s, p) => s + p.amount_usd, 0);
    const status = getClientStatus(expected, totalPaid, planPrice, c.enrollment_paid);
    const ok = expected === c.next_payment_date ? '✅' : '❌';
    console.log(`  ${ok} ${c.first_name} ${c.last_name}: join=${c.join_date} (anchor=${c.join_date.split('-')[2]}) → next=${expected} (stored=${c.next_payment_date}) [${status}]`);
  });

  // ── SCENARIO 8: Enrollment fee impact ──
  console.log('\n📋 ESCENARIO 8: Impacto de enrollment fee en cálculo');
  const enrollmentPaidClients = clients.filter(c => c.enrollment_paid).slice(0, 3);
  const enrollmentNotPaidClients = clients.filter(c => !c.enrollment_paid).slice(0, 3);
  enrollmentPaidClients.forEach(c => {
    const planPrice = planMap[c.plan_id] || 25;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const expected = computeNextPaymentDate(c.join_date, validPayments, planPrice, 5);
    const ok = expected === c.next_payment_date ? '✅' : '❌';
    console.log(`  ${ok} ${c.first_name} ${c.last_name}: enrollmentPaid=true, plan=$${planPrice} → next=${expected} (stored=${c.next_payment_date})`);
  });
  enrollmentNotPaidClients.forEach(c => {
    const planPrice = planMap[c.plan_id] || 25;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const expected = computeNextPaymentDate(c.join_date, validPayments, planPrice, 0);
    const ok = expected === c.next_payment_date ? '✅' : '❌';
    console.log(`  ${ok} ${c.first_name} ${c.last_name}: enrollmentPaid=false, plan=$${planPrice} → next=${expected} (stored=${c.next_payment_date})`);
  });

  // ── SCENARIO 9: Clients with very high cycle counts ──
  console.log('\n📋 ESCENARIO 9: Clientes con muchos ciclos pagados');
  const highCycleClients = clients.map(c => {
    const planPrice = planMap[c.plan_id] || 25;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const totalPaid = validPayments.reduce((s, p) => s + p.amount_usd, 0);
    const enrollmentFee = c.enrollment_paid ? 5 : 0;
    const cycles = totalPaid >= (planPrice + enrollmentFee)
      ? 1 + Math.floor((totalPaid - planPrice - enrollmentFee) / planPrice)
      : Math.floor(totalPaid / (planPrice + enrollmentFee));
    return { client: c, cycles, totalPaid };
  }).filter(x => x.cycles >= 5).sort((a, b) => b.cycles - a.cycles).slice(0, 5);

  console.log('  Clientes con 5+ ciclos:', highCycleClients.length);
  highCycleClients.forEach(({ client: c, cycles, totalPaid }) => {
    const planPrice = planMap[c.plan_id] || 25;
    const enrollmentFee = c.enrollment_paid ? 5 : 0;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const expected = computeNextPaymentDate(c.join_date, validPayments, planPrice, enrollmentFee);
    const ok = expected === c.next_payment_date ? '✅' : '❌';
    console.log(`  ${ok} ${c.first_name} ${c.last_name}: ${cycles} ciclos, $${totalPaid.toFixed(2)} → next=${expected} (stored=${c.next_payment_date})`);
  });

  // ── SCENARIO 10: Verify Junior Rico, Victor Marquez, Joselin ──
  console.log('\n📋 ESCENARIO 10: Verificación de casos críticos reportados');
  const criticalNames = [['Junior', 'Rico'], ['Victor', 'Marquez'], ['Joselin', 'velasquez']];
  for (const [first, last] of criticalNames) {
    const { data: c } = await db.from('clients').select('*').eq('first_name', first).ilike('last_name', last).single();
    if (!c) { console.log(`  ❌ ${first} ${last} NOT FOUND`); continue; }
    const planPrice = planMap[c.plan_id] || 25;
    const enrollmentFee = c.enrollment_paid ? 5 : 0;
    const allPayments = payments.filter(p => p.client_id === c.id);
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date);
    const totalValid = validPayments.reduce((s, p) => s + p.amount_usd, 0);
    const expected = computeNextPaymentDate(c.join_date, validPayments, planPrice, enrollmentFee);
    const status = getClientStatus(expected, totalValid, planPrice, c.enrollment_paid);
    const ok = expected === c.next_payment_date && status === c.status ? '✅' : '❌';
    const preJoin = allPayments.filter(p => p.payment_date < c.join_date).length;
    console.log(`  ${ok} ${c.first_name} ${c.last_name}:`);
    console.log(`     join=${c.join_date} | next=${c.next_payment_date} (expected=${expected}) | status=${c.status} (computed=${status})`);
    console.log(`     payments: ${allPayments.length} total, ${validPayments.length} válidos, ${preJoin} antes de join, $${totalValid.toFixed(2)} válidos`);
  }

  // ── FINAL SUMMARY ──
  console.log('\n========================================');
  console.log('RESUMEN FINAL');
  console.log('========================================');

  let totalIssues = 0;
  let totalVerified = 0;

  for (const c of clients) {
    totalVerified++;
    const planPrice = planMap[c.plan_id] || 25;
    if (planPrice <= 0) continue;
    const enrollmentFee = c.enrollment_paid ? 5 : 0;
    const allPayments = payments.filter(p => p.client_id === c.id);
    // Filter by plan_id to match recalculate script logic
    const validPayments = allPayments.filter(p => p.payment_date >= c.join_date && (!p.plan_id || p.plan_id === c.plan_id));
    const plan = plans.find(p => p.id === c.plan_id);
    const expected = computeNextPaymentDate(c.join_date, validPayments, plan, planPrice, enrollmentFee);
    const totalPaid = validPayments.reduce((s, p) => s + getEffectiveAmount(p, plan), 0);
    const computedStatus = getClientStatus(expected, totalPaid, planPrice, c.enrollment_paid);

    if (expected !== c.next_payment_date) {
      totalIssues++;
      console.log(`  ❌ ${c.first_name} ${c.last_name}: stored=${c.next_payment_date} expected=${expected} | status=${c.status} vs computed=${computedStatus}`);
    }
    if (c.status === 'activo' && expected && expected < today && computedStatus === 'inactivo') {
      totalIssues++;
      console.log(`  ❌ ${c.first_name} ${c.last_name}: status=${c.status} but computed=${computedStatus} (next=${expected} < ${today})`);
    }
  }

  // Count activos con fecha vencida
  const activosVencidos = clients.filter(c => c.status === 'activo' && c.next_payment_date < today);
  console.log(`\n✅ Total verificados: ${totalVerified}`);
  console.log(`✅ Diferencias de fecha: ${totalIssues}`);
  console.log(`✅ Activos con fecha vencida (DB vs computed status mismatch): ${activosVencidos.length}`);
  console.log(`   (Estos necesitan actualización de status en DB, no de fecha)`);

  if (totalIssues === 0 && activosVencidos.length === 0) {
    console.log('\n🎉 TODOS LOS FLUJOS VALIDADOS CORRECTAMENTE');
  } else if (totalIssues === 0 && activosVencidos.length > 0) {
    console.log('\n⚠️  Fechas correctas pero hay activos con fecha vencida (necesitan actualización de status)');
  } else {
    console.log('\n⚠️  Hay diferencias que necesitan corrección');
  }
}

test().catch(err => { console.error(err); process.exit(1); });
