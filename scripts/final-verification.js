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

function getDaysUntilPayment(nextPaymentDate) {
  if (!nextPaymentDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(nextPaymentDate + 'T00:00:00');
  const diffTime = nextDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

async function main() {
  console.log('🔍 VERIFICACIÓN FINAL DE TODOS LOS CLIENTES\n');
  console.log('='.repeat(80));

  const { data: clients } = await supabase.from('clients').select('*').not('plan_id', 'is', null);
  const { data: plans } = await supabase.from('plans').select('*');
  const { data: payments } = await supabase.from('payments').select('*').eq('is_archived', false);

  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p });

  let needsUpdate = 0;
  let ok = 0;
  const changes = [];

  for (const c of clients || []) {
    const plan = planMap[c.plan_id];
    const planPrice = plan ? parseFloat(plan.price) || 0 : 0;
    if (planPrice <= 0) continue;

    const clientPayments = (payments || []).filter(
      p => p.client_id === c.id && !p.is_archived
    );

    const daysUntil = getDaysUntilPayment(c.next_payment_date);

    // MISMA LÓGICA QUE fix-status-logic.js:
    // - Activo: Tiene pagos Y días >= 0
    // - Inactivo: Tiene pagos Y días < 0
    // - Pendiente: Sin pagos Y días >= 0
    // - Inactivo: Sin pagos Y (días < 0 o no tiene fecha)

    let correctStatus;
    if (clientPayments.length > 0) {
      if (daysUntil !== null && daysUntil >= 0) {
        correctStatus = 'activo';
      } else {
        correctStatus = 'inactivo';
      }
    } else {
      if (daysUntil !== null && daysUntil >= 0) {
        correctStatus = 'pendiente';
      } else {
        correctStatus = 'inactivo';
      }
    }

    if (c.status !== correctStatus) {
      needsUpdate++;
      changes.push({
        name: `${c.first_name} ${c.last_name}`,
        status: c.status,
        correct: correctStatus,
        daysUntil: daysUntil !== null ? daysUntil : 'N/A',
        nextPayment: c.next_payment_date || 'N/A',
      });
    } else {
      ok++;
    }
  }

  console.log(`Total clientes: ${clients.length}`);
  console.log(`  ✅ Status correcto: ${ok}`);
  console.log(`  ⚠️ Necesitan actualización: ${needsUpdate}\n`);

  // Resumen de estados en BD
  const counts = {};
  clients.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
  console.log('=== ESTADO ACTUAL EN BD ===');
  console.log(`  activo: ${counts.activo || 0}`);
  console.log(`  pendiente: ${counts.pendiente || 0}`);
  console.log(`  inactivo: ${counts.inactivo || 0}\n`);

  if (changes.length > 0) {
    console.log('=== CLIENTES QUE NECESITAN ACTUALIZACIÓN ===\n');
    changes.slice(0, 20).forEach((ch, i) => {
      console.log(`${i+1}. ${ch.name}`);
      console.log(`   Status BD: ${ch.status} → Debería ser: ${ch.correct}`);
      console.log(`   Días: ${ch.daysUntil} | Próx: ${ch.nextPayment}\n`);
    });
    if (changes.length > 20) console.log(`... y ${changes.length - 20} más\n`);
  } else {
    console.log('✅ Todos los clientes tienen el status correcto.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ VERIFICACIÓN COMPLETA.');
}

main().catch(console.error);
