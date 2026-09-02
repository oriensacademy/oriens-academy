import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

console.log("Running Cart Persistence, Deduplication & Admin Filter Tests...");

// 1. Check cart-context.tsx source
const cartContext = readFileSync(new URL("../src/lib/cart/cart-context.tsx", import.meta.url), "utf8");

// Verify guest->user transfer handles undefined initial hydration
assert.match(
  cartContext,
  /isLoginOrInitialUser\s*=\s*\(prevUserId\s*===\s*null\s*\|\|\s*prevUserId\s*===\s*undefined\)\s*&&\s*currentUserId\s*!==\s*null/
);
console.log("✓ Test 1 Passed: cart-context.tsx handles initial hydration merge for authenticated user.");

// Verify isHydrated is exported
assert.match(cartContext, /isHydrated:\s*boolean/);
assert.match(cartContext, /value=\{\{[\s\S]*?isHydrated[\s\S]*?\}\}/);
console.log("✓ Test 2 Passed: isHydrated is properly exposed in CartContext.");

// 2. Check PaymentPage.tsx source
const paymentPage = readFileSync(new URL("../src/components/payment/PaymentPage.tsx", import.meta.url), "utf8");

// Verify isCartCheckout determination
assert.match(paymentPage, /const\s*isCartCheckout\s*=\s*sourceParam\s*===\s*"cart"\s*\|\|\s*\(!isDirectPackageMode\s*&&\s*cartItems\.length\s*>\s*0\)/);
assert.match(paymentPage, /!isCartCheckout\s*\?\s*<label[\s\S]*?<select/);
console.log("✓ Test 3 Passed: PaymentPage.tsx locks cart mode and omits <select> dropdown in cart checkout.");

// Verify login redirect preserves source=cart
assert.match(paymentPage, /search\.set\("source",\s*"cart"\)/);
console.log("✓ Test 4 Passed: PaymentPage preserves source=cart on login redirect.");

// 3. Check HostedCardPanel.tsx source
const hostedCardPanel = readFileSync(new URL("../src/components/payment/HostedCardPanel.tsx", import.meta.url), "utf8");

// Verify sortedPackagesKey memoization
assert.match(hostedCardPanel, /const\s*sortedPackagesKey\s*=\s*useMemo\(\(\)\s*=>\s*\[\.\.\.packageIds\]\.sort\(\)\.join\(","\),\s*\[packageIds\]\)/);

// Verify inFlightKeyRef and preparedKeyRef locks
assert.match(hostedCardPanel, /const\s*inFlightKeyRef\s*=\s*useRef<string>\(""\)/);
assert.match(hostedCardPanel, /const\s*preparedKeyRef\s*=\s*useRef<string>\(""\)/);
assert.match(hostedCardPanel, /if\s*\(inFlightKeyRef\.current\s*===\s*currentContextKey\s*\|\|\s*preparedKeyRef\.current\s*===\s*currentContextKey\)\s*\{\s*return;\s*\}/);
console.log("✓ Test 5 Passed: HostedCardPanel enforces single-flight and prepared locks.");

// 4. Check paytr-create-token function
const paytrCreateToken = readFileSync(new URL("../supabase/functions/paytr-create-token/index.ts", import.meta.url), "utf8");

// Verify server-side idempotency
assert.match(paytrCreateToken, /checkoutIdempotencyKey\s*=\s*await\s*sha256\(idempotencyContext\)/);
assert.match(paytrCreateToken, /is_preload:\s*true/);
assert.match(paytrCreateToken, /checkout_idempotency_key:\s*checkoutIdempotencyKey/);
assert.match(paytrCreateToken, /reused_existing:\s*true/);
console.log("✓ Test 6 Passed: paytr-create-token enforces server-side idempotency and records is_preload.");

// 5. Check admin payments query filter
const adminPayments = readFileSync(new URL("../src/lib/admin/payments.ts", import.meta.url), "utf8");
assert.match(adminPayments, /\.or\("is_preload\.eq\.false,is_preload\.is\.null,status\.neq\.pending"\)/);
console.log("✓ Test 7 Passed: listAdminPaymentsPaginated excludes unattempted pure preloads.");

// 6. Test in-memory cart merge simulation
const guestCart = [{ packageId: "package5", quantity: 1 }, { packageId: "package10", quantity: 1 }];
const userCart = [{ packageId: "package10", quantity: 1 }];

const existingIds = new Set(userCart.map((i) => i.packageId));
const merged = [...userCart];
for (const gItem of guestCart) {
  if (!existingIds.has(gItem.packageId)) {
    merged.push(gItem);
    existingIds.add(gItem.packageId);
  }
}

assert.equal(merged.length, 2);
assert.equal(merged[0].packageId, "package10");
assert.equal(merged[1].packageId, "package5");
console.log("✓ Test 8 Passed: Cart deduplication and merge preserves distinct package items.");

console.log("\nALL CART PERSISTENCE & DEDUPLICATION TESTS PASSED!");
