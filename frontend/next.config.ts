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

  /**
   * Security headers. These pages carry a login and a live balance, so the
   * browser-side protections that cost nothing to add were simply missing.
   *
   * Deliberately NOT a full Content-Security-Policy: the TikTok pixel is an
   * inline <script> in the root layout and the game talks to a separate API
   * host over HTTPS and WebSocket, so a script-src policy needs its own pass
   * with the console open. frame-ancestors is the part of CSP that is
   * unaffected by any of that, so it ships now alongside X-Frame-Options.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // A year of HTTPS-only, including subdomains, and preload-eligible.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // No embedding anywhere: a framed copy of the game is a clickjacking
          // surface over the bet and cash-out buttons.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Stop the browser second-guessing declared content types.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Send the origin off-site, never the full path, and nothing at all
          // when downgrading to HTTP.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The game needs none of these; deny by default.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
