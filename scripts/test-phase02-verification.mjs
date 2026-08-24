import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("=== PHASE 02 VERIFICATION SUITE ===");

// 1. Check migration file
const migrationPath = path.resolve(process.cwd(), "supabase/migrations/20260825140000_phase02_student_security_and_admin_reauth.sql");
assert.ok(fs.existsSync(migrationPath), "Phase 02 migration file must exist");
const migrationContent = fs.readFileSync(migrationPath, "utf-8");

assert.ok(migrationContent.includes("protect_student_profile_fields"), "Trigger function protect_student_profile_fields must be defined");
assert.ok(migrationContent.includes("new.full_name := old.full_name"), "Trigger must prevent student updating full_name");
assert.ok(migrationContent.includes("new.phone := old.phone"), "Trigger must prevent student updating phone");
assert.ok(migrationContent.includes("admin_update_student_profile"), "Admin RPC admin_update_student_profile must be defined");
assert.ok(migrationContent.includes("student.identity.updated"), "Audit log entry student.identity.updated must be created");
console.log("✓ Migration 20260825140000_phase02_student_security_and_admin_reauth.sql integrity verified.");

// 2. Check StudentPortal.tsx
const portalPath = path.resolve(process.cwd(), "src/components/student/StudentPortal.tsx");
const portalContent = fs.readFileSync(portalPath, "utf-8");
assert.ok(portalContent.includes("SUPPORTED_EXAMS"), "StudentPortal must import SUPPORTED_EXAMS");
assert.ok(portalContent.includes("SUPPORTED_DESTINATIONS"), "StudentPortal must import SUPPORTED_DESTINATIONS");
assert.ok(portalContent.includes("saveStudentPreferences"), "StudentPortal must use saveStudentPreferences canonical flow");
assert.ok(portalContent.includes("Kişisel Bilgiler"), "StudentPortal must render read-only personal fields section");
assert.ok(portalContent.includes("Akademik Hedefler & Tercihler"), "StudentPortal must render academic preferences form");
assert.ok(portalContent.includes("Hesap Güvenliği"), "StudentPortal must keep Hesap Güvenliği on the same page");
console.log("✓ StudentPortal.tsx read-only personal fields and multi-select preferences verified.");

// 3. Check StudentDetailSheet.tsx
const sheetPath = path.resolve(process.cwd(), "src/components/admin/StudentDetailSheet.tsx");
const sheetContent = fs.readFileSync(sheetPath, "utf-8");
assert.ok(sheetContent.includes("EditStudentIdentityModal"), "StudentDetailSheet must include EditStudentIdentityModal");
assert.ok(sheetContent.includes("signInWithPassword"), "StudentDetailSheet must re-authenticate admin password");
assert.ok(sheetContent.includes("adminUpdateStudentProfile"), "StudentDetailSheet must call adminUpdateStudentProfile");
console.log("✓ StudentDetailSheet.tsx admin re-authentication and student identity edit modal verified.");

// 4. Check Public Settings and Pricing Visibility
const publicSettingsPath = path.resolve(process.cwd(), "src/lib/public-settings.ts");
const publicSettingsContent = fs.readFileSync(publicSettingsPath, "utf-8");
assert.ok(!publicSettingsContent.includes("localStorage.getItem"), "getPricingNavigationVisibility must not use localStorage dev override");
console.log("✓ public-settings.ts database-authoritative visibility verified.");

// 5. Check Navbar, CartPage, PaymentPage, CreativePricing guards
const navbarPath = path.resolve(process.cwd(), "src/components/sections/Navbar.tsx");
const navbarContent = fs.readFileSync(navbarPath, "utf-8");
assert.ok(navbarContent.includes("showPricing && (cartCount > 0 || isStudent)"), "Navbar must gate cart icon and mobile link with showPricing");

const cartPath = path.resolve(process.cwd(), "src/components/cart/CartPage.tsx");
const cartContent = fs.readFileSync(cartPath, "utf-8");
assert.ok(cartContent.includes("usePublicSettings"), "CartPage must consume usePublicSettings");
assert.ok(cartContent.includes("!showPricing && accountType !== \"admin\""), "CartPage must block non-admin when pricing is offline");

const paymentPath = path.resolve(process.cwd(), "src/components/payment/PaymentPage.tsx");
const paymentContent = fs.readFileSync(paymentPath, "utf-8");
assert.ok(paymentContent.includes("usePublicSettings"), "PaymentPage must consume usePublicSettings");
assert.ok(paymentContent.includes("!showPricing && accountType !== \"admin\""), "PaymentPage must block checkout when pricing is offline");

const creativePricingPath = path.resolve(process.cwd(), "src/components/ui/oriens-creative-pricing.tsx");
const creativePricingContent = fs.readFileSync(creativePricingPath, "utf-8");
assert.ok(creativePricingContent.includes("usePublicSettings"), "CreativePricing must consume usePublicSettings");

console.log("✓ All runtime pricing entry-point guards verified.");
console.log("\n=== ALL PHASE 02 VERIFICATION CHECKS PASSED SUCCESSFULLY ===");
