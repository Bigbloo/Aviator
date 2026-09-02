import type { Metadata } from 'next';

/**
 * Metadata for the campaign landing page. Lives in a layout because the page
 * itself is a client component (install prompt + live rounds).
 */
export const metadata: Metadata = {
  title: 'Aviator — Cash out before the plane flies away',
  description:
    'Provably fair crash game. Deposit in crypto, watch the multiplier climb, cash out before it crashes. 100% welcome bonus with only 1× wagering. 18+',
  openGraph: {
    title: 'Aviator — Cash out before the plane flies away',
    description:
      'Provably fair crash game. Double your first 50 USDT with only 1× wagering. Six crypto networks, deposits credited automatically. 18+',
    type: 'website',
    images: ['/icon-512.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aviator — Cash out before the plane flies away',
    description: 'Provably fair crash game. 100% welcome bonus, 1× wagering. 18+',
    images: ['/icon-512.png'],
  },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
