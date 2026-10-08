import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const LOCAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const localDb = createClient(LOCAL_URL, LOCAL_KEY);

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
      .select('id, client_id, plan_id, amount_usd, payment_date');

    if (paymentsError) throw paymentsError;

    let updatedCount = 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const clientData of allClients) {
      try {
        // En supabase-js v2 un objeto anidado viene como array si es una relación one-to-many,
        // o un objeto directamente si es many-to-one, pero para estar seguros:
        const plan = Array.isArray(clientData.plans) ? clientData.plans[0] : clientData.plans;
        const planPrice = plan ? parseFloat(plan.price) || 0 : 0;

        if (planPrice <= 0) continue;

        // Get ALL payments for this client (not filtering by plan_id to include history)
        const clientPayments = (allPayments || []).filter(
          p => p.client_id === clientData.id
        );

        // Calculate days since last payment for accurate status determination
        let daysSinceLastPayment = 999;
        if (clientPayments.length > 0) {
          // Parse YYYY-MM-DD format safely
          const lastPaymentTimestamp = Math.max(
            ...clientPayments.map(p => {
              if (!p.payment_date) {
                console.error(`Payment missing payment_date for client ${clientData.id}`);
                return 0;
              }
              const [year, month, day] = p.payment_date.split('-').map(Number);
              if (isNaN(year) || isNaN(month) || isNaN(day)) {
                console.error(`Invalid date format for payment: ${p.payment_date}`);
                return 0;
              }
              const date = new Date(year, month - 1, day); // month is 0-indexed in JS Date
              if (isNaN(date.getTime())) {
                console.error(`Invalid date for payment: ${p.payment_date}`);
                return 0;
              }
              return date.getTime();
            })
          );
          const lastPaymentDate = new Date(lastPaymentTimestamp);
          lastPaymentDate.setHours(0, 0, 0, 0);
          daysSinceLastPayment = Math.floor((now.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Determine status based on days since last payment (correct logic)
        let newStatus;
        if (clientPayments.length === 0) {
          // No payments: check if new client or reactivated (clean slate logic)
          const joinDate = new Date(clientData.join_date);
          const daysSinceJoin = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
          newStatus = (now < joinDate || daysSinceJoin <= 7) ? 'pendiente' : 'inactivo';
        } else {
          // Has payments: based on days since last payment
          if (daysSinceLastPayment <= 30) {
            newStatus = 'activo';
          } else {
            newStatus = 'inactivo';
          }
          // Note: We're not handling 'finalizado' here to keep it simple and match existing logic
          // The existing logic for finalized (12+ cycles) is more complex and handled elsewhere
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