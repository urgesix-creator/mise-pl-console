import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sales Console | KOGA Holdings',
  description: 'KOGAホールディングス 海外飲食店 売上管理システム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
