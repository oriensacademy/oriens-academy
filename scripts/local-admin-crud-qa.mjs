import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!key || !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) {
  throw new Error("Safety stop: expected the local Supabase API and publishable key.");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: signInError } = await supabase.auth.signInWithPassword({
  email: "admin@oriens.local",
  password: "OriensAdmin#2026",
});
if (signInError) throw signInError;

const stamp = Date.now();
const startsAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
startsAt.setUTCMinutes(0, 0, 0);
const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

const results = {};

const { data: slot, error: slotInsertError } = await supabase
  .from("availability_slots")
  .insert({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
  .select("id")
  .single();
if (slotInsertError) throw slotInsertError;
const { error: slotDeleteError } = await supabase.from("availability_slots").delete().eq("id", slot.id);
if (slotDeleteError) throw slotDeleteError;
results.availability = "insert/delete verified";

const { data: testimonial, error: testimonialInsertError } = await supabase
  .from("testimonials")
  .insert({ locale: "tr", quote: `Local QA ${stamp}`, name: "Local QA", active: false })
  .select("id")
  .single();
if (testimonialInsertError) throw testimonialInsertError;
const { error: testimonialDeleteError } = await supabase.from("testimonials").delete().eq("id", testimonial.id);
if (testimonialDeleteError) throw testimonialDeleteError;
results.content = "insert/delete verified";

const { data: pricing, error: pricingReadError } = await supabase
  .from("pricing_packages")
  .select("id,display_order")
  .order("display_order")
  .limit(1)
  .single();
if (pricingReadError) throw pricingReadError;
const originalOrder = pricing.display_order;
const { error: pricingUpdateError } = await supabase
  .from("pricing_packages")
  .update({ display_order: originalOrder + 1000 })
  .eq("id", pricing.id);
if (pricingUpdateError) throw pricingUpdateError;
const { error: pricingRestoreError } = await supabase
  .from("pricing_packages")
  .update({ display_order: originalOrder })
  .eq("id", pricing.id);
if (pricingRestoreError) throw pricingRestoreError;
results.pricing = "update/restore verified";

console.log(JSON.stringify({ environment: "local", url, ...results }, null, 2));
