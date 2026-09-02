import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function run() {
  const { data: tables, error: tErr } = await supabase.rpc("execute_sql_query", {
    sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
  });

  if (tErr) {
    // If execute_sql_query rpc doesn't exist, let's query via supabase db query in cli or inspect migrations
    console.log("RPC error (might not exist):", tErr.message);
  } else {
    console.log("Tables in public schema:", tables);
  }
}

run().catch(console.error);
