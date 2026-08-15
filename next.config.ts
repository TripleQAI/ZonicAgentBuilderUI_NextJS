import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The builder is a single client-heavy route; no image optimisation needed.
  images: { unoptimized: true },
};

export default config;
