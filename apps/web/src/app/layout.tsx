import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Activity, Bell, PlusCircle, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'PagePulse - Website Change Detector',
  description: 'Monitor web pages for meaningful text and visual changes with noise filtering and alerts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600 hover:text-indigo-700">
              <Activity className="h-6 w-6 text-indigo-600 animate-pulse" />
              <span>PagePulse</span>
            </Link>

            <nav className="flex items-center gap-6">
              <Link
                href="/"
                className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/settings/notifications"
                className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
              >
                <Bell className="h-4 w-4" />
                <span>Alerts</span>
              </Link>
              <Link
                href="/watches/new"
                className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                <span>New Watch</span>
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="mt-auto border-t border-slate-200 bg-white py-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>PagePulse Enterprise Change Detection & SSRF Defense</span>
            </div>
            <span>Built by Javin Kapur • MIT License</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
