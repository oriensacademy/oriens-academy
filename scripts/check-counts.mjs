import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.');
const supabase = createClient(url, key);

async function checkCounts() {
  try {
    const { count: uCount, error: uErr } = await supabase.from('universities').select('*', { count: 'exact', head: true });
    const { count: pCount, error: pErr } = await supabase.from('programs').select('*', { count: 'exact', head: true });
    const { count: qCount, error: qErr } = await supabase.from('qualifications').select('*', { count: 'exact', head: true });
    const { count: reqCount, error: reqErr } = await supabase.from('admission_requirements').select('*', { count: 'exact', head: true });
    const { count: grpCount, error: grpErr } = await supabase.from('admission_requirement_groups').select('*', { count: 'exact', head: true });
    const { count: srcCount, error: srcErr } = await supabase.from('admission_sources').select('*', { count: 'exact', head: true });
    const { count: cCount, error: cErr } = await supabase.from('countries').select('*', { count: 'exact', head: true });
    const { count: aCount, error: aErr } = await supabase.from('search_aliases').select('*', { count: 'exact', head: true });

    console.log("DATABASE COUNTS REPORT:");
    console.log(`Universities: ${uCount} (error: ${uErr ? uErr.message : 'none'})`);
    console.log(`Programs: ${pCount} (error: ${pErr ? pErr.message : 'none'})`);
    console.log(`Qualifications: ${qCount} (error: ${qErr ? qErr.message : 'none'})`);
    console.log(`Admission requirements: ${reqCount} (error: ${reqErr ? reqErr.message : 'none'})`);
    console.log(`Admission requirement groups: ${grpCount} (error: ${grpErr ? grpErr.message : 'none'})`);
    console.log(`Admission sources: ${srcCount} (error: ${srcErr ? srcErr.message : 'none'})`);
    console.log(`Countries: ${cCount} (error: ${cErr ? cErr.message : 'none'})`);
    console.log(`Search Aliases: ${aCount} (error: ${aErr ? aErr.message : 'none'})`);
  } catch (err) {
    console.error("Error executing query:", err);
  }
}

checkCounts();
