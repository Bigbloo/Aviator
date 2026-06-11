import type { Metadata, Viewport } from 'next';
import './globals.css';
import DemoToggle from '@/components/DemoToggle';
import ResultPopup from '@/components/ResultPopup';
import AgeGate from '@/components/AgeGate';
import PWARegister from '@/components/PWARegister';
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Aviator — Crash Game',
  description: 'Aviator crash game — bet, take off, cash out before the crash!',
  applicationName: 'Aviator',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aviator',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0e0e10',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-950 text-white antialiased">
        <ErrorBoundary>
          {children}
          <ResultPopup />
          <DemoToggle />
          <AgeGate />
          <PWARegister />
        </ErrorBoundary>
      </body>
    </html>
  );
}
