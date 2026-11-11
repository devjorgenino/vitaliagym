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

  if (totalPaid === 0) return { currentCyclePrice: cyclePrice, currentCyclePaid: 0 };
  if (totalPaid < cyclePrice) return { currentCyclePrice: cyclePrice, currentCyclePaid: totalPaid };
  if (amountAfterEnrollment > 0 && amountInCurrentCycle === 0) return { currentCyclePrice: planPrice, currentCyclePaid: planPrice };
  if (amountInCurrentCycle > 0) return { currentCyclePrice: planPrice, currentCyclePaid: amountInCurrentCycle };
  return { currentCyclePrice: planPrice, currentCyclePaid: 0 };
}

async function main() {
  const { data: clients } = await supabase.from('clients').select('*').not('plan_id', 'is', null);
  const { data: plans } = await supabase.from('plans').select('*');
  const { data: payments } = await supabase.from('payments').select('*').eq('is_archived', false);

  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p; });

  console.log('🔍 BUSCANDO CLIENTES CON SALDO RESTANTE Y BOTÓN HABILITADO\n');

  const results = [];

  for (const c of clients || []) {
    // Clientes activos no muestran saldo según la nueva regla
    if (c.status === 'activo') continue;

    const plan = planMap[c.plan_id];
    const planPrice = plan ? parseFloat(plan.price) || 0 : 0;
    const clientPayments = (payments || []).filter(
      p => p.client_id === c.id && p.plan_id === c.plan_id && !p.is_archived
    );
    
    const totalPaid = clientPayments.reduce((s, p) => s + getEffectiveAmount(p, plan), 0);
    const enrollmentFeePaid = (c.enrollment_paid ? INSCRIPTION_PRICE : 0) + clientPayments.reduce((s, p) => s + (parseFloat(p.enrollment_fee) || 0), 0);
    const cyclePrice = planPrice + enrollmentFeePaid;
    
    const { currentCyclePrice, currentCyclePaid } = getCycleCalculation(
      totalPaid, enrollmentFeePaid, planPrice, cyclePrice
    );
    const remainingAmount = Math.max(0, currentCyclePrice - currentCyclePaid);

    if (remainingAmount > 0.001) {
      results.push({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        status: c.status,
        planName: plan?.name || 'Sin plan',
        planPrice,
        totalPaid,
        remainingAmount: remainingAmount.toFixed(2),
      });
    }
  }

  console.log(`Total clientes con opción de pagar restante habilitada: ${results.length}\n`);
  results.forEach((r, i) => {
    console.log(`${i+1}. ${r.name} (${r.status.toUpperCase()})`);
    console.log(`   Plan: ${r.planName} ($${r.planPrice}) | Total pagado: $${r.totalPaid.toFixed(2)} | Saldo restante: $${r.remainingAmount}`);
  });
}

main().catch(console.error);
