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
const today = new Date();
today.setHours(0, 0, 0, 0);
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

function getDaysUntilPayment(nextPaymentDate) {
  if (!nextPaymentDate) return null;
  const nextDate = new Date(nextPaymentDate + 'T00:00:00');
  const todayDate = new Date(todayStr + 'T00:00:00');
  const diffTime = nextDate.getTime() - todayDate.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

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

  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p; });

  console.log('🔍 VERIFICACIÓN DEL COMPORTAMIENTO DEL BOTÓN\n');
  console.log('Regla: Botón HABILITADO cuando:');
  console.log('  - NO es activo, O');
  console.log('  - Es activo y está vencido (días < 0), O');
  console.log('  - Es activo con ≤ 5 días para la próxima fecha\n');
  console.log(`Fecha actual para cálculo: ${todayStr}\n`);

  const sampleClients = [];

  for (const c of clients || []) {
    if (sampleClients.length >= 30) break;
    if (c.status !== 'activo') continue;

    const plan = planMap[c.plan_id];
    const planPrice = plan ? parseFloat(plan.price) || 0 : 0;
    
    const daysUntilPayment = getDaysUntilPayment(c.next_payment_date);
    const isOverdue = daysUntilPayment !== null && daysUntilPayment < 0;
    const isNearDue = daysUntilPayment !== null && daysUntilPayment >= 0 && daysUntilPayment <= 5;

    // Nueva lógica: botón HABILITADO si no es activo, o si está vencido, o si está cerca del vencimiento
    const buttonEnabled = !(c.status === 'activo' && !isOverdue && !isNearDue);

    sampleClients.push({
      name: `${c.first_name} ${c.last_name}`,
      nextPay: c.next_payment_date || 'N/A',
      daysUntil: daysUntilPayment,
      isOverdue,
      isNearDue,
      buttonEnabled,
      status: c.status
    });
  }

  sampleClients.forEach((r, i) => {
    const status = r.buttonEnabled ? '✅ HABILITADO' : '❌ DESHABILITADO';
    const proxPay = typeof r.daysUntil === 'number' 
      ? (r.daysUntil < 0 ? `Vence: ${Math.abs(r.daysUntil)}d atrás` : `Días: ${r.daysUntil}`)
      : r.nextPay;
    console.log(`${i+1}. ${r.name}`);
    console.log(`   Próx. pago: ${r.nextPay} | ${proxPay}`);
    console.log(`   Botón: ${status}\n`);
  });

  const habilitados = sampleClients.filter(c => c.buttonEnabled).length;
  const deshabilitados = sampleClients.filter(c => !c.buttonEnabled).length;
  
  console.log(`📊 Total muestreados: ${sampleClients.length}`);
  console.log(`  Botones HABILITADOS: ${habilitados}`);
  console.log(`  Botones DESHABILITADOS: ${deshabilitados}`);
}

main().catch(console.error);
