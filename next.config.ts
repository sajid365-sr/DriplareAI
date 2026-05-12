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

};



export default nextConfig;
