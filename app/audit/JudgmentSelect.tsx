'use client';
import { useRouter } from 'next/navigation';
import type { Judgment } from '@/lib/types';

export function JudgmentSelect({
  judgments,
  current,
}: {
  judgments: Judgment[];
  current?: number;
}) {
  const router = useRouter();
  return (
    <select
      className="gov-input w-auto"
      value={current ? String(current) : ''}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `/audit?judgmentId=${v}` : '/audit');
      }}
    >
      <option value="">All judgments</option>
      {judgments.map((j) => (
        <option key={j.id} value={j.id}>
          #{j.id} {j.case_title || j.file_name}
        </option>
      ))}
    </select>
  );
}
