import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",
  distDir: "out",
  // Set basePath for GitHub Pages subfolder deployment
  basePath: isProd ? '/md-to-pdf' : '',
  assetPrefix: isProd ? '/md-to-pdf/' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
