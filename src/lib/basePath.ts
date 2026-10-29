/**
 * The path the app is served under: '' at the site root (next dev, next start), or
 * e.g. '/agent-visual-builder-lg' when built with NEXT_BASE_PATH (next.config.ts).
 *
 * next/link and the router add it on their own. Plain URLs do not: next/image
 * sources, metadata icons and API calls go through withBasePath.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

export const withBasePath = (path: string): string => `${BASE_PATH}${path}`;
