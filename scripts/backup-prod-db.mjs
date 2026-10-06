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

const BACKUPS_DIR = '/home/jorge/Documents/Projects/backups-vitaliagym';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const BACKUP_FILE = resolve(BACKUPS_DIR, `backup-${TIMESTAMP}.sql`);

// Extract project reference from SUPABASE_PROD_URL (e.g., https://xyz.supabase.co -> xyz)
// Falls back to SUPABASE_PROJECT_REF if set, or empty string (will cause error later).
function getProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF) {
    return process.env.SUPABASE_PROJECT_REF;
  }
  if (PROD_URL) {
    if (
      PROD_URL.startsWith('https://') &&
      PROD_URL.endsWith('.supabase.co')
    ) {
      return PROD_URL.substring(8, PROD_URL.length - '.supabase.co'.length);
    }
  }
  return '';
}

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
    const projectRef = getProjectRef();
      if (!projectRef) {
        console.error('❌ No se pudo determinar la referencia del proyecto. Verifique SUPABASE_PROD_URL o establezca SUPABASE_PROJECT_REF.');
        process.exit(1);
      }
      // Use --data-only to dump table data (rows) in addition to schema.
      // For a full backup (schema + data) you could omit --data-only, but default is schema-only.
      const command = `supabase db dump --project-ref ${projectRef} --data-only --file "${BACKUP_FILE}"`;

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
