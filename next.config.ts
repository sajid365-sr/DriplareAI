import type { NextConfig } from "next";
import path from "path";


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
// Force Next.js Turbopack compiler cache invalidation

