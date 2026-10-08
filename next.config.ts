import type { NextConfig } from "next";
import path from "path";

/**
 * Turbopack's dev filesystem cache (`.next/dev/cache/turbopack`) survives a
 * dev-server restart — it is restored from disk. When its route tree goes
 * stale, dynamic routes 404 even though the source is fine; the
 * `/dashboard/chatbots/[chatbotId]/*` subtree was the last victim.
 *
 * Run `npm run clean` to reset it. To disable the cache entirely, set
 * `experimental.turbopackFileSystemCacheForDev: false` — at the cost of a
 * noticeably slower dev-server startup.
 *
 * Never run `next build` while `next dev` is running: the production build
 * writes into the same `.next` directory and muddies the dev cache.
 */
const nextConfig: NextConfig = {
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  turbopack: {
    root: path.resolve("."),
  },
  async redirects() {
    return [
      {
        source: "/dashboard/chatbot/:path*",
        destination: "/dashboard/chatbots/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

