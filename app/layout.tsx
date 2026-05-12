import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  title: '뭐든 골라보기',
  description: '뭐 먹을지, 뭐 볼지 모르겠다면 ㄱㄱ',
  openGraph: {
    title: '뭐든 골라보기',
    description: '뭐 먹을지, 뭐 볼지 모르겠다면 ㄱㄱ',
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
