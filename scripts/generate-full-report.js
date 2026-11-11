const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

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

  console.log('📋 LISTADO DE CLIENTES CON PROBLEMAS REALES (Pendientes/Inactivos con saldo)\n');

  const problematic = [];
  const clean = [];
  let pendientes = 0;
  let inactivos = 0;

  for (const c of clients || []) {
    const plan = planMap[c.plan_id];
    const planPrice = plan ? parseFloat(plan.price) || 0 : 0;
    const clientPayments = (payments || []).filter(
      p => p.client_id === c.id && !p.is_archived
    );
    
    const totalPaid = clientPayments.reduce((s, p) => s + getEffectiveAmount(p, plan), 0);
    const enrollmentFeePaid = c.enrollment_paid ? INSCRIPTION_PRICE : 0;
    const cyclePrice = planPrice + enrollmentFeePaid;
    
    const { currentCyclePrice, currentCyclePaid } = getCycleCalculation(
      totalPaid, enrollmentFeePaid, planPrice, cyclePrice
    );
    const remaining = Math.max(0, currentCyclePrice - currentCyclePaid);

    // Solo consideramos problemáticos a clientes que NO son activos
    // porque los activos ya NO muestran saldo en la UI (corrección aplicada)
    if ((c.status === 'pendiente' || c.status === 'inactivo') && remaining > 0.001) {
      problematic.push({ client: c, plan, totalPaid, remaining, status: c.status });
      if (c.status === 'pendiente') pendientes++;
      else inactivos++;
    } else {
      clean.push({ client: c, plan, totalPaid, remaining });
    }
  }

  console.log(`Total clientes: ${clients.length}`);
  console.log(`  ✅ Sin problemas / Activos con saldo normal: ${clean.length}`);
  console.log(`  ⚠️ Clientes pendientes con saldo: ${pendientes}`);
  console.log(`  ⚠️ Clientes inactivos con saldo: ${inactivos}`);
  console.log(`  📊 TOTAL PROBLEMAS: ${problematic.length}\n`);

  if (problematic.length > 0) {
    console.log(`🔴 CLIENTES PENDIENTES CON SALDO (${pendientes}):\n`);
    problematic.filter(p => p.status === 'pendiente').forEach((p, i) => {
      console.log(`${i+1}. ${p.client.first_name} ${p.client.last_name}`);
      console.log(`   Plan: ${p.plan?.name} | Saldo: $${p.remaining.toFixed(2)} | Total pagado: $${p.totalPaid.toFixed(2)}`);
    });

    console.log(`\n🔴 CLIENTES INACTIVOS CON SALDO (${inactivos}):\n`);
    problematic.filter(p => p.status === 'inactivo').slice(0, 15).forEach((p, i) => {
      console.log(`${i+1}. ${p.client.first_name} ${p.client.last_name}`);
      console.log(`   Plan: ${p.plan?.name} | Saldo: $${p.remaining.toFixed(2)} | Total pagado: $${p.totalPaid.toFixed(2)}`);
    });
    if (problematic.filter(p => p.status === 'inactivo').length > 15) {
      console.log(`   ... y ${problematic.filter(p => p.status === 'inactivo').length - 15} más`);
    }
  }

  console.log('\n✅ RESUMEN DE CORRECCIÓN APLICADA:');
  console.log('  - Los clientes "activo" con saldo ahora NO muestran saldo en la lista principal');
  console.log('  - El saldo solo se muestra para clientes "pendiente" e "inactivo"');
  console.log('  - La lógica del cálculo de ciclos se ha corregido en ClientsTable.jsx');
}

main().catch(console.error);
