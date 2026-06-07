import type { Metadata } from 'next';
import './globals.css';
import { SocketProvider } from '@/lib/socketContext';

export const metadata: Metadata = {
  title: 'Aviator — Crash Game',
  description: 'Aviator crash game — mise, envole-toi, encaisse avant le crash !',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-950 text-white antialiased">
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
