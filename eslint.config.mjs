import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code skill tooling, not part of the app source:
    ".claude/**",
    "design-system/**",
    // Local Supabase CLI runtime artifacts, not authored project source:
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
