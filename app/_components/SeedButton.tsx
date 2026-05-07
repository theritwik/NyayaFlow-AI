'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SeedButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  return (
    <button
      className="gov-btn-ghost"
      disabled={loading}
      onClick={async () => {
        if (!confirm('Reset database and load 3 sample judgments?')) return;
        setLoading(true);
        await fetch('/api/seed', { method: 'POST' });
        setLoading(false);
        router.refresh();
      }}
    >
      {loading ? 'Loading…' : 'Load demo data'}
    </button>
  );
}
