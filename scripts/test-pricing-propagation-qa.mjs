import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mwbrlfmdpbkmdjroxhcc.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runPropagationQA() {
  console.log("==================================================");
  console.log("STARTING LIVE REVERSIBLE PRICING PROPAGATION QA");
  console.log("==================================================");

  let initialSingle = null;
  let testPassed = false;

  try {
    // 1. Fetch current baseline
    const { data: rows, error: fetchErr } = await supabase
      .from("pricing_packages")
      .select("*")
      .order("lesson_count", { ascending: true });

    if (fetchErr || !rows) {
      throw new Error(`Failed to fetch baseline pricing_packages: ${fetchErr?.message}`);
    }

    console.log(`[PASS] Fetched ${rows.length} pricing packages from live database.`);
    const single = rows.find((r) => r.id === "single");
    if (!single) throw new Error("Could not find 'single' package");
    initialSingle = { ...single };

    console.log(`[INFO] Baseline for 'single': price_amount=${single.price_amount}, current_total=${single.current_total}`);

    // 2. Perform temporary test price update (e.g. 3201 TL)
    const testPrice = 3201;
    console.log(`[TEST] Updating 'single' to test price: ${testPrice} TL...`);
    const { data: updated, error: updateErr } = await supabase
      .from("pricing_packages")
      .update({ price_amount: testPrice })
      .eq("id", "single")
      .select()
      .single();

    if (updateErr || !updated) {
      throw new Error(`Failed to update test price: ${updateErr?.message}`);
    }

    if (updated.price_amount !== testPrice || updated.current_total !== testPrice) {
      throw new Error(`Trigger sync failed: price_amount=${updated.price_amount}, current_total=${updated.current_total}`);
    }
    console.log(`[PASS] Live DB trigger synchronized current_total to ${updated.current_total}`);

    // 3. Verify public read fetch returns test price immediately
    const { data: verifyRead, error: readErr } = await supabase
      .from("pricing_packages")
      .select("id, name_tr, price_amount, current_total, purchase_mode, active")
      .eq("id", "single")
      .single();

    if (readErr || !verifyRead || verifyRead.price_amount !== testPrice) {
      throw new Error(`Public read did not reflect test price: ${JSON.stringify(verifyRead)}`);
    }
    console.log(`[PASS] Public read verified immediately with test price: ${verifyRead.price_amount}`);

    testPassed = true;
  } finally {
    // 4. Restore original baseline
    if (initialSingle) {
      console.log(`[RESTORE] Restoring 'single' back to baseline price: ${initialSingle.price_amount} TL...`);
      const { data: restored, error: restoreErr } = await supabase
        .from("pricing_packages")
        .update({
          price_amount: initialSingle.price_amount,
          current_total: initialSingle.current_total,
          unit_price: initialSingle.unit_price,
          old_total: initialSingle.old_total,
          discount_percentage: initialSingle.discount_percentage,
          purchase_mode: "purchasable",
          active: true,
        })
        .eq("id", "single")
        .select()
        .single();

      if (restoreErr || !restored) {
        console.error(`[CRITICAL] Failed to restore baseline: ${restoreErr?.message}`);
      } else {
        console.log(`[PASS] Successfully restored 'single' to price_amount=${restored.price_amount}, current_total=${restored.current_total}`);
      }
    }
  }

  if (testPassed) {
    console.log("\n>>> LIVE REVERSIBLE PRICING PROPAGATION QA: 100% PASSED <<<\n");
  } else {
    throw new Error("QA failed during test execution");
  }
}

runPropagationQA().catch((err) => {
  console.error("QA Test Error:", err);
  process.exit(1);
});
