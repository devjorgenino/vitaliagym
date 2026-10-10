/**
 * Script para sincronizar el status de los clientes basado en next_payment_date
 * Ejecutar: node scripts/sync-client-status.mjs --prod
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const isProd = process.argv.includes('--prod');
const SUPABASE_URL = isProd
  ? (process.env.SUPABASE_PROD_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
  : process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = isProd
  ? (process.env.SUPABASE_PROD_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

console.log(`📡 Conectado a: ${isProd ? 'PRODUCCIÓN' : 'LOCAL'}`);

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const today = new Date().toISOString().split('T')[0];

async function main() {
  const { data: clients } = await db.from('clients').select('*').not('plan_id', 'is', null);
  
  let toUpdate = 0;
  const updates = [];
  
  for (const c of clients) {
    const daysUntil = Math.floor((new Date(c.next_payment_date) - Date.now()) / 86400000);
    const expectedStatus = daysUntil < 0 ? 'inactivo' : 'activo';
    
    if (c.status !== expectedStatus) {
      toUpdate++;
      updates.push({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        oldStatus: c.status,
        newStatus: expectedStatus,
        nextPaymentDate: c.next_payment_date,
        daysUntil
      });
    }
  }
  
  console.log(`\n📋 Clientes con status incorrecto: ${toUpdate}\n`);
  
  if (updates.length === 0) {
    console.log('✅ Todos los clientes tienen el status correcto.\n');
    return;
  }
  
  // Mostrar lista
  for (const u of updates) {
    console.log(`  ${u.oldStatus.toUpperCase()} → ${u.newStatus.toUpperCase()}: ${u.name}`);
    console.log(`     next_payment_date: ${u.nextPaymentDate} (${u.daysUntil} días)`);
  }
  
  if (DRY_RUN) {
    console.log('\n⚠️  Modo dry-run: no se realizaron cambios.\n');
    return;
  }
  
  // Aplicar actualizaciones
  console.log('\n🔧 Aplicando correcciones...\n');
  let updated = 0;
  const errors = [];
  
  for (const u of updates) {
    const { error } = await db
      .from('clients')
      .update({ status: u.newStatus })
      .eq('id', u.id);
    
    if (error) {
      errors.push(`${u.name}: ${error.message}`);
    } else {
      updated++;
    }
  }
  
  console.log('─'.repeat(60));
  console.log(`  ✅ Corregidos:          ${updated}`);
  console.log(`  ❌ Errores:             ${errors.length}`);
  console.log(`  🔴 A inactivo:          ${updates.filter(u => u.newStatus === 'inactivo').length}`);
  console.log(`  🟢 A activo:            ${updates.filter(u => u.newStatus === 'activo').length}`);
  console.log('─'.repeat(60) + '\n');
  
  if (errors.length) {
    errors.forEach(e => console.log(`  ❌ ${e}`));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
