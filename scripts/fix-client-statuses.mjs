import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const LOCAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const localDb = createClient(LOCAL_URL, LOCAL_KEY);

function calculateDaysUntilPayment(nextPaymentDate, joinDate) {
  if (!nextPaymentDate && !joinDate) return null;
  
  const referenceDate = nextPaymentDate ? new Date(nextPaymentDate) : new Date(joinDate);
  const today = new Date();
  
  // Set both to midnight to count full days
  referenceDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffTime = referenceDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

async function fixAllClientStatuses() {
  console.log('🔄 Arreglando estados de clientes...');
  try {
    const { data: allClients, error: fetchError } = await localDb
      .from('clients')
      .select(`
        id,
        first_name,
        last_name,
        status,
        next_payment_date,
        join_date,
        plan_id,
        plans (
          id,
          price
        )
      `);

    if (fetchError) throw fetchError;
    if (!allClients || allClients.length === 0) {
      console.log('No hay clientes.');
      return;
    }

    const { data: allPayments, error: paymentsError } = await localDb
      .from('payments')
      .select('id, client_id, plan_id, amount_usd');

    if (paymentsError) throw paymentsError;

    let updatedCount = 0;

    for (const clientData of allClients) {
      try {
        // En supabase-js v2 un objeto anidado viene como array si es una relación one-to-many, 
        // o un objeto directamente si es many-to-one, pero para estar seguros:
        const plan = Array.isArray(clientData.plans) ? clientData.plans[0] : clientData.plans;
        const planPrice = plan ? parseFloat(plan.price) || 0 : 0;
        
        if (planPrice <= 0) continue;

        const clientPayments = (allPayments || []).filter(
          p => p.client_id === clientData.id && p.plan_id === clientData.plan_id
        );

        const totalPaid = clientPayments.reduce(
          (sum, p) => sum + (parseFloat(p.amount_usd) || 0),
          0
        );

        const cycles = Math.floor(totalPaid / planPrice);
        const daysUntilPayment = calculateDaysUntilPayment(
          clientData.next_payment_date,
          clientData.join_date
        );

        let newStatus;
        if (cycles >= 1 && daysUntilPayment !== null && daysUntilPayment >= 0) {
          newStatus = 'activo';
        } else if (daysUntilPayment !== null && daysUntilPayment < 0) {
          newStatus = 'inactivo';
        } else if (cycles < 1 && daysUntilPayment !== null && daysUntilPayment >= 0) {
          newStatus = 'pendiente';
        } else {
          newStatus = 'inactivo';
        }

        if (newStatus !== clientData.status) {
          console.log(`Actualizando ${clientData.first_name} ${clientData.last_name}: ${clientData.status} -> ${newStatus}`);
          const { error } = await localDb
            .from('clients')
            .update({ status: newStatus })
            .eq('id', clientData.id);
            
          if (error) console.error(error);
          else updatedCount++;
        }
      } catch (err) {
        console.error(`Error con cliente ${clientData.id}:`, err);
      }
    }
    
    console.log(`✅ Actualizados ${updatedCount} clientes.`);

  } catch (e) {
    console.error(e);
  }
}

fixAllClientStatuses();
