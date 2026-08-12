import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ordinary shared web hosting, no Node.js server — the whole site (both
  // locales, plus the static `/` redirect entry) is exported as plain
  // HTML/CSS/JS at build time.
  output: "export",
};

export default nextConfig;
