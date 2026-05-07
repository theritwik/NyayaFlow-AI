import Link from 'next/link';

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: string;
  subtitle?: string;
  crumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      {crumbs && crumbs.length > 0 && (
        <div className="text-[12px] text-gov-slate mb-2">
          {crumbs.map((c, i) => (
            <span key={i}>
              {c.href ? (
                <Link href={c.href} className="hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
              {i < crumbs.length - 1 && (
                <span className="mx-1.5 text-slate-400">›</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="gov-h1">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gov-slate mt-1 max-w-3xl">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
