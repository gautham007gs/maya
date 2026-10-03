import { redirect } from 'next/navigation';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params?.tab || 'instagram';
  redirect(`/admin/profile?tab=${tab}`);
}
