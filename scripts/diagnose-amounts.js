/**
 * Script de diagnóstico rápido - analiza montos de pago anómalos
 * Uso: node scripts/diagnose-amounts.js
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

async function main() {
  console.log('🔍 Diagnóstico rápido de montos anómalos...\n');

  // Una sola consulta para todos los clientes
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, first_name, last_name, join_date, next_payment_date, plan_id, status');

  if (clientsError) {
    console.error('❌ Error clientes:', clientsError.message);
    process.exit(1);
  }

  // Una sola consulta para todos los planes
  const { data: plans } = await supabase.from('plans').select('id, name, price, currency');
  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = { ...p, price: parseFloat(p.price) || 0 }; });

  // Una sola consulta para todos los pagos
  const { data: allPayments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, client_id, plan_id, amount_usd, amount_bs, payment_type, discount_type, discount_value, payment_date, enrollment_fee')
    .eq('is_archived', false)
    .order('payment_date', { ascending: true });

  if (paymentsError) {
    console.error('❌ Error pagos:', paymentsError.message);
    process.exit(1);
  }

  // Agrupar pagos por cliente
  const paymentsByClient = {};
  for (const p of allPayments || []) {
    const key = `${p.client_id}-${p.plan_id}`;
    if (!paymentsByClient[key]) paymentsByClient[key] = [];
    paymentsByClient[key].push(p);
  }

  const anomalies = [];

  for (const client of clients || []) {
    const plan = planMap[client.plan_id];
    if (!plan) continue;

    const clientPayments = paymentsByClient[`${client.id}-${client.plan_id}`] || [];
    if (clientPayments.length === 0) continue;

    // Calcular total efectivo
    let totalEffective = 0;
    let hasSuspiciousPayment = false;

    for (const p of clientPayments) {
      // Determinar qué campo usar según el plan
      let field = plan.currency === 'BS' ? 'amount_bs' : 'amount_usd';

      // Pero efectivo_dolares siempre usa amount_usd, efectivo_bolivares siempre amount_bs
      if (p.payment_type === 'efectivo_dolares') field = 'amount_usd';
      else if (p.payment_type === 'efectivo_bolivares') field = 'amount_bs';

      let rawAmount = parseFloat(p[field]) || 0;
      let effective = rawAmount;

      if (p.discount_type === 'percentage' && p.discount_value) {
        const disc = parseFloat(p.discount_value) || 0;
        if (disc > 0 && disc < 100) effective = rawAmount / (1 - disc / 100);
      } else if (p.discount_type === 'fixed' && p.discount_value) {
        effective = rawAmount + (parseFloat(p.discount_value) || 0);
      }

      // Detectar pagos sospechosos: monto > 10x el precio del plan
      if (effective > plan.price * 10) {
        hasSuspiciousPayment = true;
        console.log(`\n⚠️  Pago sospechoso detectado:`);
        console.log(`   Cliente: ${client.first_name} ${client.last_name}`);
        console.log(`   Fecha: ${p.payment_date}`);
        console.log(`   Tipo: ${p.payment_type}`);
        console.log(`   Monto raw: ${field}=${rawAmount}`);
        console.log(`   Monto efectivo: $${effective.toFixed(2)}`);
        console.log(`   Plan price: $${plan.price} (${plan.currency})`);
      }

      totalEffective += effective;
    }

    const cycles = Math.floor(totalEffective / plan.price);

    // Solo reportar si tiene ciclos excesivos o pagos sospechosos
    if (cycles > 24 || hasSuspiciousPayment) {
      anomalies.push({
        name: `${client.first_name} ${client.last_name}`,
        plan: plan.name,
        planPrice: plan.price,
        planCurrency: plan.currency,
        paymentCount: clientPayments.length,
        totalEffective: Math.round(totalEffective * 100) / 100,
        cycles,
        nextPayment: client.next_payment_date,
        joinDate: client.join_date,
        hasSuspiciousPayment,
      });
    }
  }

  console.log(`\n\n📊 RESUMEN DE ANOMALÍAS: ${anomalies.length} clientes\n`);

  if (anomalies.length === 0) {
    console.log('✅ No se encontraron anomalías.');
    return;
  }

  console.log('💰 CLIENTES CON PAGOS ANÓMALOS:\n');
  console.log('   Nombre                       | Plan    | $Plan | Pagos | Total Efectivo | Ciclos | Next Payment');
  console.log('   ' + '-'.repeat(105));

  anomalies.forEach(a => {
    const currency = a.planCurrency === 'BS' ? 'Bs.' : '$';
    const name = `${a.name}`.padEnd(26);
    const plan = (a.plan || '?').padEnd(8);
    const price = `${currency}${a.planPrice}`.padEnd(6);
    const count = `${a.paymentCount}`.padEnd(6);
    const total = `${currency}${a.totalEffective.toFixed(0)}`.padEnd(15);
    const cycles = `${a.cycles}`.padEnd(7);
    const next = (a.nextPayment || '?').padEnd(12);
    const flag = a.hasSuspiciousPayment ? ' ⚠️' : '';
    console.log(`   ${name} | ${plan} | ${price} | ${count} | ${total} | ${cycles} | ${next}${flag}`);
  });

  console.log('\n📈 ANÁLISIS:');
  const extremeCases = anomalies.filter(a => a.cycles > 100);
  const highCases = anomalies.filter(a => a.cycles > 24 && a.cycles <= 100);
  const suspiciousOnly = anomalies.filter(a => a.hasSuspiciousPayment && a.cycles <= 24);

  console.log(`   - Casos extremos (>100 ciclos): ${extremeCases.length} clientes`);
  console.log(`   - Sobrepago alto (24-100 ciclos): ${highCases.length} clientes`);
  console.log(`   - Pagos sospechosos individuales: ${suspiciousOnly.length} clientes`);

  console.log('\n💡 CAUSAS PROBABLES:');
  console.log('   1. Pagos duplicados (mismo pago registrado múltiples veces)');
  console.log('   2. Montos en BS grabados como USD (ej: 9000 Bs → $9000)');
  console.log('   3. Descuentos porcentuales cercanos al 100% que inflan el monto');
  console.log('   4. Pagos de inscripción ($) sumados incorrectamente');

  console.log('\n🔧 SOLUCIONES:');
  console.log('   1. Revisar manualmente los pagos de estos clientes');
  console.log('   2. Archivar pagos duplicados desde la interfaz');
  console.log('   3. Ejecutar fix-all para corregir fechas basadas en los pagos existentes');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
