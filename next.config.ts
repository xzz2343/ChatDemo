import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/chatdemo",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
