/**
 * Script de backup de base de datos de producción a Supabase
 *
 * Realiza un dump completo de la base de datos PostgreSQL y lo guarda
 * en la carpeta backups/ con fecha y hora.
 *
 * Uso:
 *   node scripts/backup-prod-db.mjs
 *
 * Requiere en .env.local:
 *   SUPABASE_PROD_URL=https://tu-proyecto.supabase.co
 *   SUPABASE_PROD_SERVICE_ROLE_KEY=tu-service-role-key
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const PROD_URL = process.env.SUPABASE_PROD_URL;
const PROD_KEY = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY;

if (!PROD_URL || !PROD_KEY) {
  console.error('❌ Faltan credenciales de producción en .env.local:');
  console.error('   SUPABASE_PROD_URL');
  console.error('   SUPABASE_PROD_SERVICE_ROLE_KEY');
  console.error('\nAgrega estas variables a tu .env.local y vuelve a intentar.');
  process.exit(1);
}

const BACKUPS_DIR = resolve(__dirname, '../backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const BACKUP_FILE = resolve(BACKUPS_DIR, `backup-${TIMESTAMP}.sql`);

async function main() {
  console.log('🔄 Iniciando backup de producción...');
  console.log(`📡 Origen: ${PROD_URL}`);
  console.log(`💾 Destino: ${BACKUP_FILE}\n`);

  // Crear directorio de backups si no existe
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log('📁 Carpeta de backups creada\n');
  }

  try {
    // Usar el CLI de Supabase para hacer el backup
    const command = `supabase db dump --project-ref sefshrkbuydtocxrbowe --file "${BACKUP_FILE}"`;

    console.log('📦 Ejecutando backup...\n');

    // Ejecutar el comando de backup
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN }
    });

    console.log('\n✅ Backup completado exitosamente!');
    console.log(`📄 Archivo: ${BACKUP_FILE}`);

  } catch (error) {
    console.error('❌ Error durante el backup:', error.message);
    console.error('\nAlternativas:');
    console.error(`  1. Configura SUPABASE_ACCESS_TOKEN y ejecuta: supabase db dump --project-ref vitaliagym -f ${BACKUP_FILE}`);
    console.error(`  2. Usa psql directamente: psql "${PROD_URL}" -f ${BACKUP_FILE}`);
    console.error(`  3. Usa el dashboard de Supabase: Database → Backups → Download`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Error inesperado:', err);
  process.exit(1);
});
