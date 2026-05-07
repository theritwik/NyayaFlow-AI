import type { Metadata } from 'next';
import './globals.css';
import { TopNav } from '@/components/TopNav';

export const metadata: Metadata = {
  title: 'NyayaFlow AI — Court Judgment to Verified Action Plan',
  description:
    'AI-assisted, officer-verified action plans from court judgments for government departments.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="bg-gov-navy text-white">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gov-gold/20 border border-gov-gold flex items-center justify-center">
                <span className="font-serif text-gov-gold text-lg">⚖</span>
              </div>
              <div className="leading-tight">
                <div className="font-serif text-lg">NyayaFlow AI</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  Court Judgment → Verified Action Plan
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-300">
                Reviewer
              </div>
              <div className="text-sm font-medium">demo.officer</div>
            </div>
          </div>
        </header>
        <div className="gov-divider" />
        <TopNav />
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white text-xs text-gov-slate">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <span>
              Decision-support system. AI suggestions require officer verification before
              they become trusted records.
            </span>
            <span>Prototype · v0.1</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
