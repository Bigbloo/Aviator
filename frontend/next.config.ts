import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Enable static export for Android WebView packaging
  // Uncomment the line below when building for Android:
  // output: 'export',

  // Turbopack infers the workspace root from the nearest lockfile, and there is
  // a stray package-lock.json in the home directory above this project. Left to
  // guess, `next dev` picked that as the root and 404'd every route. Pin it.
  turbopack: {
    root: path.join(__dirname),
  },

  // Allow all image domains
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
