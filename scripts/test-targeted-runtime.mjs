import process from "node:process";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("Supabase QA configuration is missing.");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const visibility = "status.in.(paid,refunded),and(payment_method.eq.bank_transfer,status.in.(pending,requires_action))";

const [visible, abandoned, publicDrafts, bucket, anonUpload] = await Promise.all([
  admin.from("payment_transactions").select("id", { count: "exact", head: true }).eq("is_archived", false).or(visibility),
  admin.from("payment_transactions").select("id", { count: "exact", head: true }).eq("is_archived", false).eq("is_preload", true).in("status", ["pending", "cancelled", "failed"]),
  anon.from("blog_posts").select("id", { count: "exact", head: true }).neq("status", "published"),
  admin.storage.getBucket("blog-media"),
  anon.storage.from("blog-media").upload(`qa-denied-${Date.now()}.pdf`, new Blob(["denied"], { type: "application/pdf" })),
]);

if (visible.error) throw visible.error;
if (abandoned.error) throw abandoned.error;
if (publicDrafts.error) throw publicDrafts.error;
if (bucket.error || !bucket.data?.public) throw bucket.error || new Error("blog-media bucket is not public");
if (!anonUpload.error) throw new Error("Anonymous blog media upload unexpectedly succeeded");
if ((publicDrafts.count || 0) !== 0) throw new Error("Draft blog rows are publicly visible");

console.log(JSON.stringify({
  visibleRealPayments: visible.count || 0,
  technicalPreloadRowsRetained: abandoned.count || 0,
  abandonedCounted: false,
  publicDrafts: publicDrafts.count || 0,
  blogMediaBucket: "READY",
  anonUpload: "DENIED",
}));
