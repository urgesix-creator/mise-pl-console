import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'みせPL｜店舗経営ダッシュボード',
  description: '飲食・小売の店舗経営を、日次入力から月次PL・粗利まで自動で見える化するツール',
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
