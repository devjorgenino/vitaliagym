const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const isProd = process.argv.includes('--prod');
const supabaseUrl = isProd 
  ? (process.env.SUPABASE_PROD_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
  : process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = isProd 
  ? (process.env.SUPABASE_PROD_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  console.log('🔄 SINCRONIZANDO STATUS DE CLIENTES CON LA NUEVA LÓGICA\n');

  const { data: clients } = await supabase.from('clients').select('*').not('plan_id', 'is', null);
  const { data: plans } = await supabase.from('plans').select('*');
  const { data: payments } = await supabase.from('payments').select('*').eq('is_archived', false);

  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p; });

  let updated = 0;
  let unchanged = 0;
  const changes = [];

  for (const c of clients || []) {
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

    // Determinar el status correcto según la nueva lógica
    let correctStatus;

    if (clientPayments.length === 0) {
      // Sin pagos
      if (daysUntil !== null && daysUntil >= 0) {
        correctStatus = 'pendiente'; // Nuevo cliente, tiene tiempo
      } else {
        correctStatus = 'inactivo'; // Sin pagos y vencido
      }
    } else if (remaining < 0.001) {
      // Ciclo actual completado
      correctStatus = daysUntil !== null && daysUntil >= 0 ? 'activo' : 'inactivo';
    } else if (remaining > 0.001 && daysUntil !== null && daysUntil >= 0) {
      // Tiene saldo pero no está vencido
      correctStatus = 'pendiente'; // Pago parcial, pendiente de completar ciclo
    } else {
      // Tiene saldo y está vencido
      correctStatus = 'inactivo';
    }

    if (c.status !== correctStatus) {
      updated++;
      changes.push({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        oldStatus: c.status,
        newStatus: correctStatus,
        totalPaid: totalPaid.toFixed(2),
        remaining: remaining.toFixed(2),
        daysUntil,
        nextPaymentDate: c.next_payment_date,
      });

      // Actualizar en BD
      const { error } = await supabase
        .from('clients')
        .update({ status: correctStatus })
        .eq('id', c.id);

      if (error) {
        console.error(`❌ Error actualizando ${c.first_name} ${c.last_name}:`, error.message);
      }
    } else {
      unchanged++;
    }
  }

  console.log(`📊 RESULTADO:`);
  console.log(`  ✅ Sin cambios: ${unchanged}`);
  console.log(`  🔄 Actualizados: ${updated}\n`);

  if (changes.length > 0) {
    console.log('=== CLIENTES ACTUALIZADOS ===\n');
    changes.slice(0, 20).forEach((ch, i) => {
      console.log(`${i+1}. ${ch.name}`);
      console.log(`   Status: ${ch.oldStatus} → ${ch.newStatus}`);
      console.log(`   Total pagado: $${ch.totalPaid} | Saldo: $${ch.remaining} | Días: ${ch.daysUntil !== null ? ch.daysUntil : 'N/A'}\n`);
    });
    if (changes.length > 20) console.log(`... y ${changes.length - 20} más\n`);
  }

  console.log('\n✅ Sincronización completada.');
}

main().catch(console.error);
