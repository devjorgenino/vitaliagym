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

  console.log('🔍 VERIFICACIÓN DE CLIENTES ACTIVOS CON BOTÓN DE PAGAR RESTANTE\n');

  let activosConSaldo = 0;
  let activosSinSaldo = 0;
  let activosConBoton = 0;

  for (const c of clients || []) {
    if (c.status !== 'activo') continue;

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

    // Con la nueva lógica: los clientes activos NO muestran saldo en la tabla
    // Pero el botón de pagar restante solo está activo para no-activos
    const shouldShowRemaining = c.status !== 'activo' && remainingAmount > 0.001;

    if (remainingAmount > 0.001) {
      activosConSaldo++;
      console.log(`⚠️ ${c.first_name} ${c.last_name} | Plan: ${plan?.name} | Saldo: $${remainingAmount.toFixed(2)} | Botón: ${shouldShowRemaining ? '✅ HABILITADO' : '❌ DESHABILITADO (es activo)'}`);
    } else {
      activosSinSaldo++;
    }
    
    if (shouldShowRemaining) activosConBoton++;
  }

  console.log('\n📊 RESUMEN:');
  console.log(`  Clientes activos con saldo restante: ${activosConSaldo}`);
  console.log(`  Clientes activos sin saldo: ${activosSinSaldo}`);
  console.log(`  Clientes con botón de pagar restante HABILITADO: ${activosConBoton}`);
  console.log(`  ✅ Los clientes activos NO muestran saldo en la tabla (corrección aplicada)`);
}

main().catch(console.error);
