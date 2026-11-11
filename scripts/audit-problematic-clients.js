/**
 * Script de auditoría para identificar clientes con problemas de status y saldo pendiente
 * No modifica nada - solo identifica y reporta
 * 
 * Uso: node scripts/audit-problematic-clients.js
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

// Constantes del sistema
const INSCRIPTION_PRICE = 5;
const MAX_EFFECTIVE_AMOUNT_USD = 10000;
const MAX_EFFECTIVE_AMOUNT_BS = 1000000;

// Funciones auxiliares
function getPaymentAmountField(payment, plan) {
  if (payment?.payment_type === 'efectivo_dolares') return 'amount_usd';
  if (payment?.payment_type === 'efectivo_bolivares') return 'amount_bs';
  const currency = (plan?.currency || 'USD').toUpperCase();
  return currency === 'BS' ? 'amount_bs' : 'amount_usd';
}

function getEffectiveAmount(payment, plan, fallbackRate = 310) {
  if (!payment) return 0;
  
  const field = getPaymentAmountField(payment, plan);
  let amount = parseFloat(payment[field]) || 0;
  const isBSPlan = (plan?.currency || 'USD').toUpperCase() === 'BS';

  // Convertir Bs a USD si el plan es en USD
  if (payment.payment_type === 'efectivo_bolivares' && !isBSPlan) {
    const rate = payment.exchange_rate || fallbackRate;
    amount = amount / rate;
  }

  const maxAmount = isBSPlan ? MAX_EFFECTIVE_AMOUNT_BS : MAX_EFFECTIVE_AMOUNT_USD;
  if (amount > maxAmount) amount = maxAmount;

  // Aplicar descuentos
  if (payment.discount_type === 'percentage' && payment.discount_value) {
    const disc = parseFloat(payment.discount_value) || 0;
    if (disc > 0 && disc < 100) {
      amount = amount / (1 - Math.min(disc, 95) / 100);
    } else if (disc >= 100) {
      return 0;
    }
  } else if (payment.discount_type === 'fixed' && payment.discount_value) {
    amount += parseFloat(payment.discount_value) || 0;
  }

  return Math.round(amount * 100) / 100;
}

function getPlanPrice(plan) {
  return plan ? parseFloat(plan.price) || 0 : 0;
}

function getPlanCurrency(plan) {
  return (plan?.currency || 'USD').toUpperCase();
}

function getEnrollmentFeePaid(client, clientPayments) {
  const fromBoolean = client?.enrollment_paid === true ? INSCRIPTION_PRICE : 0;
  const fromColumn = (clientPayments || []).reduce(
    (sum, p) => sum + (parseFloat(p.enrollment_fee) || 0),
    0
  );
  return Math.max(fromBoolean, fromColumn);
}

function getClientStatus(client, payments, plan) {
  if (!client || !client.plan_id) {
    return { status: "inactivo", label: "Inactivo" };
  }

  // Usar el status de la base de datos si está disponible
  if (client.status === "pendiente") {
    return { status: "pendiente", label: "Pendiente" };
  }

  const planPrice = getPlanPrice(plan);
  if (planPrice <= 0) {
    return { status: "activo", label: "Activo" };
  }

  const allClientPayments = (payments || []).filter(
    p => p.client_id === client.id && !p.is_archived
  );

  if (allClientPayments.length === 0) {
    return { status: "inactivo", label: "Inactivo" };
  }

  const totalPaidSoFar = allClientPayments.reduce(
    (sum, p) => sum + getEffectiveAmount(p, plan),
    0
  );

  const enrollmentFeePaid = getEnrollmentFeePaid(client, allClientPayments);
  const cyclePrice = planPrice + enrollmentFeePaid;

  let paidForCurrentCycle = 0;
  let currentCyclePrice = planPrice;

  if (totalPaidSoFar === 0) {
    currentCyclePrice = cyclePrice;
    paidForCurrentCycle = 0;
  } else if (totalPaidSoFar < cyclePrice) {
    currentCyclePrice = cyclePrice;
    paidForCurrentCycle = totalPaidSoFar;
  } else if ((totalPaidSoFar - enrollmentFeePaid) % planPrice === 0) {
    currentCyclePrice = planPrice;
    paidForCurrentCycle = planPrice;
  } else {
    paidForCurrentCycle = totalPaidSoFar - enrollmentFeePaid - Math.floor((totalPaidSoFar - enrollmentFeePaid) / planPrice) * planPrice;
  }

  const currentRemaining = Math.max(0, currentCyclePrice - paidForCurrentCycle);
  const isFullyPaid = currentRemaining < 0.001;

  if (isFullyPaid) {
    return { status: "activo", label: "Activo" };
  }

  if (totalPaidSoFar > 0 && currentRemaining > 0) {
    return { status: "pendiente", label: "Pendiente" };
  }

  return { status: "inactivo", label: "Inactivo" };
}

function getPaymentWithRemaining(client, payments, plan, usePlanFilter = true) {
  if (!client || !client.plan_id) return null;

  // Parámetro usePlanFilter para simular el comportamiento actual de ClientsTable.jsx
  let allClientPayments;
  if (usePlanFilter) {
    // COMPORTAMIENTO ACTUAL (BUG): Filtrar por plan_id
    allClientPayments = (payments || []).filter(
      p => p.client_id === client.id && !p.is_archived && p.plan_id === client.plan_id
    );
  } else {
    // COMPORTAMIENTO CORREGIDO: No filtrar por plan_id
    allClientPayments = (payments || []).filter(
      p => p.client_id === client.id && !p.is_archived
    );
  }

  if (allClientPayments.length === 0) return null;

  const planPrice = getPlanPrice(plan);
  if (planPrice <= 0) return null;

  const totalPaid = allClientPayments.reduce(
    (sum, p) => sum + getEffectiveAmount(p, plan),
    0
  );

  const enrollmentFeePaid = getEnrollmentFeePaid(client, allClientPayments);
  const cyclePrice = planPrice + enrollmentFeePaid;

  // Calculate amount available AFTER the one-time enrollment fee
  const amountAfterEnrollment = Math.max(0, totalPaid - enrollmentFeePaid);
  const fullCyclesCompleted = amountAfterEnrollment >= planPrice ? Math.floor(amountAfterEnrollment / planPrice) : 0;
  const amountInCurrentCycle = amountAfterEnrollment - (fullCyclesCompleted * planPrice);

  let currentCyclePrice, currentCyclePaid;
  if (totalPaid === 0) {
    currentCyclePrice = cyclePrice;
    currentCyclePaid = 0;
  } else if (totalPaid < cyclePrice) {
    currentCyclePrice = cyclePrice;
    currentCyclePaid = totalPaid;
  } else if (amountAfterEnrollment > 0 && amountInCurrentCycle === 0) {
    currentCyclePrice = planPrice;
    currentCyclePaid = planPrice;
  } else if (amountInCurrentCycle > 0) {
    currentCyclePrice = planPrice;
    currentCyclePaid = amountInCurrentCycle;
  } else {
    currentCyclePrice = planPrice;
    currentCyclePaid = 0;
  }

  const remainingAmount = Math.max(0, currentCyclePrice - currentCyclePaid);

  if (remainingAmount < 0.001) return null;

  if (remainingAmount > 0) {
    const lastPayment = allClientPayments.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    )[0];

    return {
      ...lastPayment,
      remainingAmount,
      remainingFormatted: remainingAmount.toFixed(2),
      planPrice,
      totalPaid,
      enrollmentFeePaid,
      currentCyclePrice,
      paymentsCount: allClientPayments.length,
      usePlanFilter,
    };
  }

  return null;
}

async function auditProblematicClients() {
  console.log('🔍 AUDITORÍA DE CLIENTES CON PROBLEMAS DE STATUS Y SALDO\n');

  // Obtener datos
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .not('plan_id', 'is', null);

  if (clientsError) {
    console.error('❌ Error al obtener clientes:', clientsError.message);
    return;
  }

  const { data: plans } = await supabase.from('plans').select('*');
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('is_archived', false);

  const planMap = {};
  (plans || []).forEach(p => { planMap[p.id] = p; });

  const issues = [];

  for (const client of clients || []) {
    const plan = planMap[client.plan_id];
    const clientPayments = (payments || []).filter(
      p => p.client_id === client.id && !p.is_archived
    );

    // Calcular estado según la lógica corregida
    const computedStatus = getClientStatus(client, clientPayments, plan);
    const paymentWithRemaining = getPaymentWithRemaining(client, clientPayments, plan);

    // Problema 1: Estado "pendiente" de BD vs cálculo actual
    if (client.status === 'pendiente' && computedStatus.status !== 'pendiente') {
      issues.push({
        type: 'STATUS_MISMATCH',
        client: `${client.first_name} ${client.last_name} (ID: ${client.id})`,
        dbStatus: client.status,
        computedStatus: computedStatus.status,
        planName: plan?.name || 'Sin plan',
        planPrice: getPlanPrice(plan),
        totalPaid: clientPayments.reduce((s, p) => s + getEffectiveAmount(p, plan), 0),
        paymentsCount: clientPayments.length,
        enrollmentPaid: client.enrollment_paid,
        isOverdue: client.daysUntilPayment !== null && client.daysUntilPayment < 0,
      });
    }

    // Problema 2: Estado "activo" pero con saldo pendiente mostrado
    // Comparar comportamiento ACTUAL vs CORREGIDO del filtro por plan_id
    const currentBehavior = getPaymentWithRemaining(client, clientPayments, plan, true);
    const correctedBehavior = getPaymentWithRemaining(client, clientPayments, plan, false);

    if (client.status === 'activo' && currentBehavior && currentBehavior.remainingAmount > 0.001) {
      const causeAnalysis = [];
      const planPriceLocal = getPlanPrice(plan);
      
      // Determinar la causa específica
      if (correctedBehavior && correctedBehavior.remainingAmount <= 0.001) {
        causeAnalysis.push('El problema es el filtro por plan_id: si se incluyen TODOS los pagos, el saldo desaparece.');
      } else if (currentBehavior.totalPaid % planPriceLocal === 0) {
        causeAnalysis.push('Saldo residuo de redondeo: total pagado es múltiplo exacto del plan pero el cálculo muestra diferencia.');
      } else if (currentBehavior.remainingAmount >= 5) {
        causeAnalysis.push('El cliente necesita un pago parcial: el saldo restante es significativo y debe pagarse.');
      }

      issues.push({
        type: 'ACTIVE_WITH_REMAINING',
        client: `${client.first_name} ${client.last_name} (ID: ${client.id})`,
        dbStatus: client.status,
        remainingAmount: currentBehavior.remainingAmount,
        remainingFormatted: currentBehavior.remainingFormatted,
        planName: plan?.name || 'Sin plan',
        planPrice: planPriceLocal,
        totalPaid: currentBehavior.totalPaid,
        enrollmentFeePaid: currentBehavior.enrollmentFeePaid,
        currentCyclePrice: currentBehavior.currentCyclePrice,
        paymentsCount: currentBehavior.paymentsCount,
        isOverdue: client.daysUntilPayment !== null && client.daysUntilPayment < 0,
        causeAnalysis,
        filteredPayments: clientPayments.filter(p => p.plan_id === client.plan_id).length,
        totalClientPayments: clientPayments.length,
      });
    }

    // Problema 3: Estado "pendiente" pero con saldo restante mostrado
    if (client.status === 'pendiente' && paymentWithRemaining) {
      issues.push({
        type: 'PENDING_WITH_REMAINING_BUT_SHOULD_BE_ACTIVE',
        client: `${client.first_name} ${client.last_name} (ID: ${client.id})`,
        dbStatus: client.status,
        remainingAmount: paymentWithRemaining.remainingAmount,
        remainingFormatted: paymentWithRemaining.remainingFormatted,
        planName: plan?.name || 'Sin plan',
        totalPaid: paymentWithRemaining.totalPaid,
        daysUntilPayment: client.daysUntilPayment,
        isOverdue: client.daysUntilPayment !== null && client.daysUntilPayment < 0,
      });
    }

    // Problema 4: Cliente activo que está vencido (días negativos)
    if (client.status === 'activo' && 
        client.daysUntilPayment !== null && 
        client.daysUntilPayment < 0) {
      issues.push({
        type: 'ACTIVE_BUT_OVERDUE',
        client: `${client.first_name} ${client.last_name} (ID: ${client.id})`,
        dbStatus: client.status,
        daysOverdue: Math.abs(client.daysUntilPayment),
        planName: plan?.name || 'Sin plan',
        nextPaymentDate: client.next_payment_date,
      });
    }
  }

  // Generar reporte
  console.log('📊 RESUMEN DE PROBLEMAS DETECTADOS:\n');

  const problemCounts = {};
  issues.forEach(issue => {
    problemCounts[issue.type] = (problemCounts[issue.type] || 0) + 1;
  });

  console.log(`Total problemas encontrados: ${issues.length}`);
  Object.entries(problemCounts).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });

  // Mostrar detalles de cada problema
  if (issues.length > 0) {
    console.log('\n🔴 DETALLES DE PROBLEMAS:\n');

    const issuesByType = {};
    issues.forEach(issue => {
      if (!issuesByType[issue.type]) issuesByType[issue.type] = [];
      issuesByType[issue.type].push(issue);
    });

    for (const [type, issuesOfType] of Object.entries(issuesByType)) {
      console.log(`\n=== ${type} (${issuesOfType.length} casos) ===\n`);

      issuesOfType.slice(0, 10).forEach((issue, i) => {
        console.log(`(${i + 1}) ${issue.client}`);
        console.log(`    Plan: ${issue.planName} ($${issue.planPrice || 0})`);
        console.log(`    Status BD: ${issue.dbStatus}`);
        
        if (issue.remainingAmount !== undefined) {
          console.log(`    Saldo restante: $${issue.remainingAmount.toFixed(2)} Bs: ${issue.remainingAmount}`);
        }
        
        if (issue.totalPaid !== undefined) {
          console.log(`    Total pagado: $${issue.totalPaid.toFixed(2)}`);
        }
        
        if (issue.daysUntilPayment !== undefined) {
          console.log(`    Días hasta pago: ${issue.daysUntilPayment}`);
        }
        
        if (issue.daysOverdue !== undefined) {
          console.log(`    Días vencido: ${issue.daysOverdue}`);
        }

        if (issue.type === 'STATUS_MISMATCH') {
          console.log(`    ❌ INCONSISTENCIA: DB dice "${issue.dbStatus}" pero cálculo dice "${issue.computedStatus}"`);
          console.log(`    Causa: El estado "pendiente" está hardcodeado en ClientsTable.jsx:210`);
        }

        if (issue.type === 'ACTIVE_WITH_REMAINING') {
          console.log(`    ❌ ERROR: Cliente "activo" con saldo restante de $${issue.remainingAmount.toFixed(2)}`);
          console.log(`    🧮 ANÁLISIS:`);
          console.log(`       Total pagado: $${issue.totalPaid}`);
          console.log(`       Precio plan: $${issue.planPrice}`);
          console.log(`       Inscripción pagada: $${issue.enrollmentFeePaid}`);
          console.log(`       Precio ciclo actual: $${issue.currentCyclePrice}`);
          console.log(`       Pagos filtrados por plan_id: ${issue.filteredPayments} de ${issue.totalClientPayments}`);
          
          if (issue.causeAnalysis && issue.causeAnalysis.length > 0) {
            console.log(`    💡 CAUSA:`);
            issue.causeAnalysis.forEach(c => console.log(`       ${c}`));
          } else if (issue.remainingAmount >= 5) {
            console.log(`    💡 CAUSA: Necesita pago parcial de $${issue.remainingAmount.toFixed(2)}`);
          } else {
            console.log(`    💡 CAUSA: Posible redondeo o filtro por plan_id`);
          }
          console.log(`    📋 SOLUCIÓN:`);
          console.log(`       - Si el cliente está activo y con pago al día: NO debe mostrar saldo pendiente.`);
          console.log(`       - El botón debe decir "Pago al día" y estar deshabilitado.`);
        }

        if (issue.type === 'ACTIVE_BUT_OVERDUE') {
          console.log(`    ❌ ERROR: Estado "activo" con next_payment_date vencida (${issue.daysOverdue} días atrás)`);
          console.log(`    Causa: El cálculo de status no considera las fechas vencidas en ClientsTable.jsx:215-221`);
        }

        console.log('');
      });

      if (issuesOfType.length > 10) {
        console.log(`  ... y ${issuesOfType.length - 10} casos más\n`);
      }
    }
  }

  console.log('\n📋 CAUSAS PRINCIPALES IDENTIFICADAS:');
  console.log(`
1. CLIENTES TABLE - Filtrado por plan_id (línea 298-299):
   Los pagos se filtran usando: p.plan_id === client.plan_id
   Si el cliente cambió de plan, los pagos del plan anterior no se consideran
   → Genera saldos pendientes fantasma

2. CLIENTES TABLE - Estado "pendiente" hardcodeado (línea 210-211):
   if (client.status === "pendiente") { return { status: "pendiente" }; }
   El componente respeta el status de BD sin calcularlo
   → Estado inconsistente con los pagos reales

3. CLIENTES TABLE - Redondeo insuficiente (línea 334):
   if (remainingAmount < 0.001) { return null; }
   Saldos entre 0.001 y 0.01 pueden quedar como residuales
   → Muestra saldo pendiente aunque está pagado

4. UPDATE CLIENT STATUS - Lógica de inscripción:
   Usa enrollment_paid del cliente o enrollment_fee de pagos
   Pero ClientsTable usa ambos (línea 191-198)
   → Inconsistencia en cálculo del ciclo inicial
`);

  // Archivar resultados
  const output = {
    summary: {
      totalClients: clients?.length || 0,
      totalProblems: issues.length,
      problemCounts,
    },
    issues,
  };

  // Guardar a archivo
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '../reports/problematic-clients-report.json'),
    JSON.stringify(output, null, 2)
  );

  console.log('\n✅ Reporte guardado en: reports/problematic-clients-report.json');
}

auditProblematicClients().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});