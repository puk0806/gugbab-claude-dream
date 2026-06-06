import type { Metadata, Viewport } from 'next';
import '@gugbab/tokens/radix.css';
import '@gugbab/styled-radix/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: '꿈해몽',
  description: '어젯밤 꿈을 적고 톤을 골라 누르면 Claude가 해석해주는 PWA',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '꿈해몽',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
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
