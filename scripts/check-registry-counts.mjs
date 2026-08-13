import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(url, key);

async function checkRegistry() {
  const { count: domainCount } = await supabase.from('university_domains').select('*', { count: 'exact', head: true });
  const { count: registryCount } = await supabase.from('university_source_registry').select('*', { count: 'exact', head: true });
  const { count: runCount } = await supabase.from('ingestion_runs').select('*', { count: 'exact', head: true });

  console.log(`Registered Official Domains: ${domainCount}`);
  console.log(`Registered Program & Admission Sources: ${registryCount}`);
  console.log(`Recorded Ingestion Runs: ${runCount}`);

  const { data: sampleSources } = await supabase.from('university_source_registry').select('university_id, source_type, url, is_official, verification_status').limit(10);
  console.log("\nSample Registered Sources:");
  console.log(JSON.stringify(sampleSources, null, 2));
}

checkRegistry();
