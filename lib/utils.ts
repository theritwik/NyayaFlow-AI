import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined, fallback = '—') {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatDateTime(iso: string | null | undefined, fallback = '—') {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function safeJsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export const FIELD_LABELS: Record<string, string> = {
  case_title: 'Case Title',
  case_number: 'Case Number',
  court_name: 'Court',
  order_date: 'Order Date',
  petitioner: 'Petitioner',
  respondent: 'Respondent',
  key_direction: 'Key Direction',
  deadline: 'Deadline',
  department: 'Department / Authority',
  compliance_instruction: 'Compliance Instruction',
  appeal_consideration: 'Appeal Consideration',
  urgency: 'Urgency Assessment',
};

export function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ');
}
