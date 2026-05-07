import { NextResponse } from 'next/server';
import { dashboardStats, departmentBreakdown, listActions } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = dashboardStats();
  const departments = departmentBreakdown();
  const approved = listActions({ status: 'Approved' });
  return NextResponse.json({ stats, departments, approved });
}
