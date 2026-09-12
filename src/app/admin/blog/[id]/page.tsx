import { redirect } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

// Safety net: /admin/blog/[id] (no /edit) used to 404 here. Every "Edit"
// link in the admin UI now points straight at /admin/blog/[id]/edit, but
// this route stays as a fallback for old bookmarks / any link we missed.
export default async function BlogPostRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/blog/${id}/edit`);
}
