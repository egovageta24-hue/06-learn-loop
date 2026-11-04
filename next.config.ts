import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is intentionally off: nearly every page is per-user and
  // reads live progress from the DB, so nothing here should be prerendered or
  // cached across requests.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
