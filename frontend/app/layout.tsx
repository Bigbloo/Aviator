import type { Metadata, Viewport } from 'next';
import './globals.css';
import DemoToggle from '@/components/DemoToggle';

export const metadata: Metadata = {
  title: 'Aviator — Crash Game',
  description: 'Aviator crash game — mise, envole-toi, encaisse avant le crash !',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-950 text-white antialiased">
        {children}
        <DemoToggle />
      </body>
    </html>
  );
}
