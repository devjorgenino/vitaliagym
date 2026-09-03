/**
 * Script de sincronización de base de datos: Producción -> Local
 *
 * Descarga todos los registros de producción y los replica en la instancia local de Supabase.
 *
 * Uso:
 *   node scripts/sync-prod-to-local.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const PROD_URL = process.env.SUPABASE_PROD_URL;
const PROD_KEY = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY;

const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const LOCAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

if (!PROD_URL || !PROD_KEY) {
  console.error('❌ Faltan credenciales de producción en .env.local:');
  console.error('   SUPABASE_PROD_URL / SUPABASE_PROD_SERVICE_ROLE_KEY');
  process.exit(1);
}

const prodDb = createClient(PROD_URL, PROD_KEY);
const localDb = createClient(LOCAL_URL, LOCAL_KEY);

console.log('🔄 Sincronizando datos de PRODUCCIÓN a LOCAL...');
console.log(`📡 Origen (Prod): ${PROD_URL}`);
console.log(`💻 Destino (Local): ${LOCAL_URL}\n`);

async function syncAuthUsers() {
  console.log('👤 Sincronizando usuarios de autenticación (auth.users)...');
  const { data: { users: prodUsers }, error: pErr } = await prodDb.auth.admin.listUsers();
  if (pErr) {
    console.error('  ❌ Error al obtener usuarios de prod:', pErr.message);
    return;
  }

  const { data: { users: localUsers } } = await localDb.auth.admin.listUsers();
  const localUserIds = new Set(localUsers?.map(u => u.id) || []);

  for (const u of prodUsers) {
    if (!localUserIds.has(u.id)) {
      const { error } = await localDb.auth.admin.createUser({
        id: u.id,
        email: u.email,
        email_confirm: true,
        user_metadata: u.user_metadata,
        password: 'Password123!', // Contraseña provisional para usuarios locales nuevos
      });
      if (error) {
        console.warn(`  ⚠️ No se pudo crear usuario ${u.email}:`, error.message);
      } else {
        console.log(`  ➕ Creado usuario local: ${u.email} (${u.id})`);
      }
    }
  }
  console.log(`  ✅ ${prodUsers.length} usuarios verificados en auth local.\n`);
}

async function syncTable(tableName, primaryKey = 'id') {
  process.stdout.write(`📦 Sincronizando tabla '${tableName}'... `);

  // 1. Obtener datos de producción
  const { data: rows, error: readErr } = await prodDb
    .from(tableName)
    .select('*');

  if (readErr) {
    console.log(`❌ Error al leer prod: ${readErr.message}`);
    return;
  }

  if (!rows || rows.length === 0) {
    console.log(`(0 registros en prod) ✅`);
    return;
  }

  // 2. Upsert en lotes de 100 para evitar sobrecarga
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error: writeErr } = await localDb
      .from(tableName)
      .upsert(batch, { onConflict: primaryKey });

    if (writeErr) {
      console.log(`❌ Error al guardar en local: ${writeErr.message}`);
      return;
    }
  }

  console.log(`✅ (${rows.length} registros copiados/actualizados)`);
}

async function main() {
  await syncAuthUsers();

  const tables = [
    { name: 'roles', pk: 'id' },
    { name: 'permissions', pk: 'id' },
    { name: 'role_permissions', pk: 'id' },
    { name: 'profiles', pk: 'id' },
    { name: 'user_roles', pk: 'id' },
    { name: 'plans', pk: 'id' },
    { name: 'clients', pk: 'id' },
    { name: 'payments', pk: 'id' },
    { name: 'attendance', pk: 'id' },
    { name: 'expenses', pk: 'id' },
  ];

  for (const t of tables) {
    await syncTable(t.name, t.pk);
  }

  console.log('\n🎉 ¡Sincronización completada con éxito! Tu base de datos local tiene todos los datos de producción.');
}

main().catch(err => {
  console.error('\n❌ Error inesperado durante la sincronización:', err);
  process.exit(1);
});
