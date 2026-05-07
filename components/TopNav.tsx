'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', label: 'Overview' },
  { href: '/upload', label: 'Upload Judgment' },
  { href: '/judgments', label: 'Judgments' },
  { href: '/dashboard', label: 'Verified Dashboard' },
  { href: '/audit', label: 'Audit Trail' },
  { href: '/export', label: 'Export Report' },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto">
        {items.map((it) => {
          const active =
            it.href === '/'
              ? pathname === '/'
              : pathname?.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'px-4 py-3 text-sm whitespace-nowrap border-b-2 transition',
                active
                  ? 'border-gov-navy text-gov-navy font-semibold'
                  : 'border-transparent text-gov-slate hover:text-gov-navy hover:border-slate-300'
              )}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
