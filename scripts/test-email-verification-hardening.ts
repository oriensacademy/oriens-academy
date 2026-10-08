import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinationForAccount } from "../src/lib/auth/account-routing";

assert.equal(destinationForAccount("student", "tr"), "/tr/hesabim/");
assert.equal(destinationForAccount("student", "en"), "/en/account/");
assert.equal(
  destinationForAccount("student", "tr", "/tr/odeme/?package=fixture#checkout"),
  "/tr/odeme/?package=fixture#checkout"
);
assert.equal(destinationForAccount("student", "en", "https://evil.example/account"), "/en/account/");

const loginSource = readFileSync("src/components/auth/UnifiedLoginPage.tsx", "utf8");
const gateSource = readFileSync("src/components/auth/EmailOtpGate.tsx", "utf8");
assert.equal(loginSource.includes("onboarding=personalization"), false);
assert.equal(loginSource.includes("onboarding_completed"), false);
assert.match(loginSource, /router\.replace\(destinationForAccount\("student", locale, requested\)\)/);
assert.match(gateSource, /Doğrulama kodu gönderilemedi\. Lütfen tekrar deneyin\./);
assert.match(gateSource, /The verification code could not be sent\. Please try again\./);

console.log("EMAIL_VERIFICATION_ROUTE_AND_UI=PASS");
