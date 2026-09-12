import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getCmsDashboardStats } from '@/lib/blog-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const stats = await getCmsDashboardStats();
    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
