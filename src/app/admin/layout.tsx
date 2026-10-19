import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifyAdminSessionFromCookie } from '@/lib/admin-auth';

export const metadata: Metadata = {
  title: 'Admin Panel | Kruthika AI',
  description: 'Admin panel for Kruthika AI Girlfriend.',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get('x-pathname') || '';
  const isLoginRoute = pathname === '/admin/login' || pathname.startsWith('/admin/login/');

  if (!isLoginRoute) {
    const cookieStore = await cookies();
    const session = await verifyAdminSessionFromCookie(cookieStore.get(SESSION_COOKIE)?.value);
    if (!session.isValid) {
      redirect(`/admin/login?returnUrl=${encodeURIComponent(pathname || '/admin')}`);
    }
  }

  return <>{children}</>;
}
