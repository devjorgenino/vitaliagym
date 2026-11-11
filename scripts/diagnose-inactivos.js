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

const INSCRIPTION_PRICE = 5;

function getEffectiveAmount(payment, plan, fallbackRate = 310) {
  if (!payment) return 0;
  let field = 'amount_usd';
  if (payment?.payment_type === 'efectivo_bolivares') field = 'amount_bs';
  else if (plan && (plan.currency || 'USD').toUpperCase() === 'BS') field = 'amount_bs';
  let amount = parseFloat(payment[field]) || 0;
  const isBSPlan = (plan?.currency || 'USD').toUpperCase() === 'BS';
  if (payment.payment_type === 'efectivo_bolivares' && !isBSPlan) {
    amount = amount / (payment.exchange_rate || fallbackRate);
  }
  return Math.round(amount * 100) / 100;
}

function getCycleCalculation(totalPaid, enrollmentFeePaid, planPrice, cyclePrice) {
  const amountAfterEnrollment = Math.max(0, totalPaid - enrollmentFeePaid);
  const fullCyclesCompleted = amountAfterEnrollment >= planPrice ? Math.floor(amountAfterEnrollment / planPrice) : 0;
  const amountInCurrentCycle = amountAfterEnrollment - (fullCyclesCompleted * planPrice);

  if (totalPaid === 0) return { currentCyclePrice: cyclePrice, currentCyclePaid: 0, remaining: cyclePrice };
  if (totalPaid < cyclePrice) return { currentCyclePrice: cyclePrice, currentCyclePaid: totalPaid, remaining: cyclePrice - totalPaid };
  if (amountAfterEnrollment > 0 && amountInCurrentCycle === 0) return { currentCyclePrice: planPrice, currentCyclePaid: planPrice, remaining: 0 };
  if (amountInCurrentCycle > 0) return { currentCyclePrice: planPrice, currentCyclePaid: amountInCurrentCycle, remaining: planPrice - amountInCurrentCycle };
  return { currentCyclePrice: planPrice, currentCyclePaid: 0, remaining: planPrice };
}

function getDaysUntilPayment(nextPaymentDate) {
  if (!nextPaymentDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(nextPaymentDate + 'T00:00:00');
  const diffTime = nextDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

async function main() {
  console.log('🔍 DIAGNÓSTICO DE CLIENTES INACTIVOS\n');

  const { data: clients } = await supabase.from('clients').select('*').not('plan_id', 'is', null);
  const { data: plans } = await supabase.from('plans').select('*');
  const { data: payments } = await supabase.from('payments').select('*').eq('is_archived', false);

  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p });

  const inactivos = [];

  for (const c of clients || []) {
    if (c.status !== 'inactivo') continue;

    const plan = planMap[c.plan_id];
    const planPrice = plan ? parseFloat(plan.price) || 0 : 0;
    if (planPrice <= 0) continue;

    const clientPayments = (payments || []).filter(
      p => p.client_id === c.id && !p.is_archived
    );

    const totalPaid = clientPayments.reduce((s, p) => s + getEffectiveAmount(p, plan), 0);
    const enrollmentFeePaid = (c.enrollment_paid ? INSCRIPTION_PRICE : 0) + 
      clientPayments.reduce((s, p) => s + (parseFloat(p.enrollment_fee) || 0), 0);
    const cyclePrice = planPrice + enrollmentFeePaid;

    const { remaining } = getCycleCalculation(totalPaid, enrollmentFeePaid, planPrice, cyclePrice);
    const daysUntil = getDaysUntilPayment(c.next_payment_date);

    let reason = '';
    if (clientPayments.length === 0) {
      reason = 'Sin pagos';
    } else if (remaining < 0.001) {
      reason = daysUntil !== null && daysUntil >= 0 ? 'Ciclo completo y al día' : 'Ciclo completo pero vencido';
    } else if (remaining > 0.001) {
      if (daysUntil !== null && daysUntil >= 0) {
        reason = 'Tiene saldo pero NO está vencido (debería ser pendiente)';
      } else if (daysUntil !== null && daysUntil < 0) {
        reason = 'Tiene saldo Y está vencido';
      } else {
        reason = 'Tiene saldo pero sin fecha de próximo pago calculada';
      }
    }

    inactivos.push({
      name: `${c.first_name} ${c.last_name}`,
      totalPaid: totalPaid.toFixed(2),
      remaining: remaining.toFixed(2),
      daysUntil: daysUntil !== null ? daysUntil : 'N/A',
      nextPayment: c.next_payment_date || 'N/A',
      paymentsCount: clientPayments.length,
      reason,
    });
  }

  console.log(`Total inactivos: ${inactivos.length}\n`);

  // Agrupar por razón
  const groups = {};
  inactivos.forEach(i => {
    if (!groups[i.reason]) groups[i.reason] = [];
    groups[i.reason].push(i);
  });

  Object.entries(groups).forEach(([reason, items], idx) => {
    console.log(`\n=== ${reason} (${items.length} clientes) ===`);
    items.slice(0, 10).forEach((item, i) => {
      console.log(`${idx+1}.${i+1} ${item.name} | Pagos: $${item.totalPaid} | Saldo: $${item.remaining} | Días: ${item.daysUntil} | Próx: ${item.nextPayment}`);
    });
    if (items.length > 10) console.log(`   ... y ${items.length - 10} más`);
  });
}

main().catch(console.error);
