import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable static export for Android WebView packaging
  // Uncomment the line below when building for Android:
  // output: 'export',

  // Allow all image domains
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
