'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';
import MediaLibrary from '@/components/admin/MediaLibrary';

export default function AdminMediaPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/admin/session').then(r => {
      if (r.ok) setIsAuthenticated(true);
      else router.replace('/admin/login?returnUrl=/admin/media');
    }).catch(() => router.replace('/admin/login?returnUrl=/admin/media'));
  }, [router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-pulse text-sm text-slate-500 font-medium">Checking authorization...</div>
      </div>
    );
  }

  return (
    <CmsWorkspaceShell title="Media Library" eyebrow="Assets">
      <MediaLibrary mode="page" />
    </CmsWorkspaceShell>
  );
}
