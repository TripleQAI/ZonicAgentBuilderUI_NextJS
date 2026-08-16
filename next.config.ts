import type { NextConfig } from 'next';

/**
 * Where the API actually lives. Server-side only — deliberately NOT
 * `NEXT_PUBLIC_`, because the browser never needs to know it.
 */
const BACKEND = (process.env.API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');

const config: NextConfig = {
  reactStrictMode: true,
  // The builder is a single client-heavy route; no image optimisation needed.
  images: { unoptimized: true },

  /**
   * Proxy the API through this server so the browser makes same-origin
   * requests only.
   *
   * The alternative is for the browser to call http://localhost:8000 directly,
   * which is cross-origin from whatever port the UI happens to be on, so every
   * request needs a CORS preflight and the backend has to list that exact
   * origin in CORS_ORIGINS. Changing the dev port then breaks the app until
   * someone edits the backend's .env and restarts it — a footgun that fires
   * every time a port moves.
   *
   * With these rewrites the browser only ever talks to its own origin, Next
   * forwards server-side, and CORS never enters the picture. It also matches
   * how this is usually deployed: one origin in front of both.
   *
   * Setting NEXT_PUBLIC_API_BASE_URL opts back into direct calls — useful when
   * the API is on another host that sends its own CORS headers. These rewrites
   * stay defined but go unused in that mode.
   */
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${BACKEND}/api/v1/:path*` },
      { source: '/health', destination: `${BACKEND}/health` },
      { source: '/health/:path*', destination: `${BACKEND}/health/:path*` },
    ];
  },
};

export default config;
