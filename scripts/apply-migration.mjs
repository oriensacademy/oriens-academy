import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const fileArg = process.argv[2] || 'supabase/migrations/20260813220000_phase2_source_discovery_registry.sql';
console.log(`Applying Migration ${fileArg}...`);

try {
  const container = execSync('docker ps --format "{{.Names}}" | findstr "supabase_db_"', { encoding: 'utf-8' }).trim().split('\n')[0];
  if (!container) {
    throw new Error("Supabase DB Docker container not found.");
  }
  console.log(`Target Container: ${container}`);

  const sqlFilePath = path.resolve(process.cwd(), fileArg);
  const sql = fs.readFileSync(sqlFilePath, 'utf-8');

  execSync(`docker exec -i ${container} psql -U postgres -d postgres -v ON_ERROR_STOP=1`, {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit']
  });

  console.log("✓ Migration executed successfully!");
} catch (err) {
  console.error("✗ Migration execution failed:", err.message);
  process.exit(1);
}
