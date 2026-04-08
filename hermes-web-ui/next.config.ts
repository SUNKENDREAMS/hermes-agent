import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production: static export served by FastAPI on port 8080
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
