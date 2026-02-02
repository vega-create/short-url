import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "短網址管理系統",
  description: "智慧媽咪短網址管理系統",
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
