import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/portfolio" : undefined,
  assetPrefix: isProd ? "/portfolio" : undefined,
  images: { unoptimized: true },
  // Префикс для файлов из public/: next сам не переписывает пути к ним,
  // поэтому отдаём его в код через env и используем asset() из src/lib.
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? "/portfolio" : "",
  },
};

export default nextConfig;
