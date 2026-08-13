import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
