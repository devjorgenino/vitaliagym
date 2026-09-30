/**
 * Script de diagnóstico - SOLO LECTURA
 * Muestra clientes con fechas de próximo pago anómalas
 * Uso: node scripts/check-dates.js
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

async function main() {
  console.log('🔍 Diagnosticando fechas de próximos pagos...\n');

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, first_name, last_name, join_date, next_payment_date, plan_id, status, enrollment_paid')
    .neq('status', null);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  const { data: plans } = await supabase.from('plans').select('id, price, currency');
  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p; });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const anomalies = [];
  let totalPaidClients = 0;
  let noPaymentsClients = 0;

  for (const client of clients || []) {
    if (!client.join_date) continue;

    const plan = planMap[client.plan_id];
    if (!plan) continue;

    const planPrice = parseFloat(plan.price) || 0;
    if (planPrice <= 0) continue;

    // Obtener pagos del cliente
    const { data: payments } = await supabase
      .from('payments')
      .select('id, amount_usd, amount_bs, payment_type, discount_type, discount_value, payment_date')
      .eq('client_id', client.id)
      .eq('plan_id', client.plan_id)
      .eq('is_archived', false);

    const totalPaid = (payments || []).reduce((sum, p) => {
      let field = 'amount_usd';
      if (p.payment_type === 'efectivo_bolivares') field = 'amount_bs';
      else if (p.payment_type === 'efectivo_dolares') field = 'amount_usd';
      else field = plan.currency === 'BS' ? 'amount_bs' : 'amount_usd';
      let amount = parseFloat(p[field]) || 0;
      if (p.discount_type === 'percentage' && p.discount_value) {
        const disc = parseFloat(p.discount_value) || 0;
        if (disc > 0 && disc < 100) amount = amount / (1 - disc / 100);
      } else if (p.discount_type === 'fixed' && p.discount_value) {
        amount += parseFloat(p.discount_value) || 0;
      }
      return sum + Math.max(0, amount);
    }, 0);

    if ((payments?.length || 0) > 0) totalPaidClients++;
    else noPaymentsClients++;

    // Calcular fecha esperada
    const expectedDate = addMonthsPreservingAnchor(
      client.join_date,
      Math.max(1, Math.floor(totalPaid / planPrice)),
      parseInt(client.join_date.split('-')[2], 10)
    );

    const stored = client.next_payment_date;
    const year = parseInt(stored?.split('-')[0] || '0', 10);
    const diff = year - today.getFullYear();

    // Detectar anomalías
    if (year > 2030 || year < today.getFullYear() - 1 || stored !== expectedDate) {
      anomalies.push({
        name: `${client.first_name} ${client.last_name}`,
        joinDate: client.join_date,
        stored,
        expected: expectedDate,
        totalPaid,
        planPrice,
        planCurrency: plan.currency,
        paymentCount: payments?.length || 0,
        daysUntilDue: expectedDate ? Math.round((new Date(expectedDate) - new Date(todayStr + 'T00:00:00')) / 86400000) : 'N/A',
      });
    }
  }

  console.log(`📊 Total clientes: ${clients?.length}`);
  console.log(`   Con pagos: ${totalPaidClients}`);
  console.log(`   Sin pagos: ${noPaymentsClients}\n`);

  if (anomalies.length === 0) {
    console.log('✅ No se encontraron anomalías en las fechas.');
  } else {
    console.log(`⚠️  ${anomalies.length} clientes con fechas anómalas:\n`);
    console.log('   Nombre                        | Join Date | Almacenado  | Esperado    | $Pagado | Ciclos | Días hasta vencimiento');
    console.log('   ' + '-'.repeat(100));

    anomalies.forEach(a => {
      const currency = a.planCurrency === 'BS' ? 'Bs.' : '$';
      const name = `${a.name}`.padEnd(28);
      const joinDate = (a.joinDate || '?').padEnd(10);
      const stored = (a.stored || '?').padEnd(10);
      const expected = (a.expected || '?').padEnd(12);
      const paid = `${currency}${a.totalPaid.toFixed(0)}`.padEnd(8);
      const cycles = `${Math.floor(a.totalPaid / a.planPrice)}`.padEnd(5);
      const days = `${a.daysUntilDue}`.padEnd(14);
      console.log(`   ${name} | ${joinDate} | ${stored} | ${expected} | ${paid} | ${cycles} | ${days}`);
    });

    console.log('\n💡 Para corregir estas fechas, ejecuta:');
    console.log('   curl http://localhost:3000/api/admin/maintenance?action=fix-dates');
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
