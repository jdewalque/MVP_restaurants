import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared package ships TypeScript sources.
  transpilePackages: ["@passaparola/shared"],
  images: {
    // Reel thumbnails come from Instagram's CDN; they are shown with <img>, not next/image.
    unoptimized: true,
  },
};

export default nextConfig;
