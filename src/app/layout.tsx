import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sipariş Atama Sistemi",
  description: "Kurye sipariş atama ve yönetim sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <div className="min-h-screen">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h1 className="text-xl font-bold text-gray-900">Sipariş Atama Sistemi</h1>
                </div>
                <nav className="flex items-center gap-6">
                  <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium">
                    Anasayfa
                  </Link>
                  <Link href="/atama" className="text-gray-600 hover:text-gray-900 font-medium">
                    Atama Ekranı
                  </Link>
                </nav>
              </div>
            </div>
          </header>

          {/* Main content - tam genişlik */}
          <main className="w-full px-4 sm:px-6 lg:px-8 py-4">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
