import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const projectRef = "mwbrlfmdpbkmdjroxhcc";
const projectUrl = `https://${projectRef}.supabase.co`;
const raw = execSync(`npx supabase projects api-keys --project-ref ${projectRef}`, { encoding: "utf8", windowsHide: true });
const keys = JSON.parse(raw.slice(raw.indexOf("{"))).keys;
const anonKey = keys.find((key) => key.id === "anon")?.api_key;
const serviceKey = keys.find((key) => key.id === "service_role")?.api_key;

async function checkPricing() {
  const service = createClient(projectUrl, serviceKey, { auth: { persistSession: false } });
  const { data: all, error: allErr } = await service.from("pricing_packages").select("*");
  console.log("All pricing packages (service_role):", all?.length, "Error:", allErr);
  if (all) console.log(all.map(p => ({ id: p.id, active: p.active, name_tr: p.name_tr, current_total: p.current_total, purchase_mode: p.purchase_mode })));

  const anon = createClient(projectUrl, anonKey, { auth: { persistSession: false } });
  const { data: anonData, error: anonErr } = await anon.from("pricing_packages").select("*");
  console.log("\nPricing packages (anon query):", anonData?.length, "Error:", anonErr);
}

checkPricing().catch(console.error);
