import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  title: '오늘 뭐 먹지?',
  description: '뭐 먹을지 모르겠다면 ㄱㄱ',
  openGraph: {
    title: '오늘 뭐 먹지?',
    description: '뭐 먹을지 모르겠다면 ㄱㄱ',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
