'use client';


import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import BlogEditor from '@/components/admin/BlogEditor';

interface Category { id: number; name: string; slug: string; }

function normalizeJsonField(val: any, fallback: any[] = []): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : fallback; } catch { return fallback; } }
  return fallback;
}

// Every nullable TEXT/VARCHAR column comes back from MySQL as `null`, not
// `""`, whenever the field was never filled in. Controlled <input>/<textarea>
// elements throw "value prop should not be null" the moment one of these
// hits `value={post.someField}` directly — this was firing on canonical_url,
// excerpt, author_title, seo_keywords, og_image, etc. on any post that
// hadn't had every optional field filled in. Coerce every string-typed
// field to '' up front instead of patching each <input> individually.
const NULLABLE_STRING_FIELDS = [
  'excerpt', 'author', 'author_title', 'featured_image', 'featured_image_alt',
  'seo_title', 'seo_description', 'seo_keywords', 'og_image', 'og_title',
  'og_description', 'twitter_title', 'twitter_description', 'canonical_url',
] as const;

function normalizeNullableStrings(post: Record<string, any>) {
  for (const field of NULLABLE_STRING_FIELDS) {
    if (post[field] === null || post[field] === undefined) post[field] = '';
  }
  return post;
}

export default function EditBlogPostPage() {
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const postId  = Number(params.id);

  const [auth, setAuth]       = useState(false);
  const [post, setPost]       = useState<any>(null);
  const [categories, setCats] = useState<Category[]>([]);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/session')
      .then(r => {
        if (!r.ok) { router.replace(`/admin/login?returnUrl=/admin/blog/${postId}/edit`); return; }
        setAuth(true);
        return Promise.all([
          fetch(`/api/admin/blog/${postId}`).then(x => x.json()),
          fetch('/api/admin/blog').then(x => x.json()),
        ]).then(([pd, ld]) => {
          if (pd.error) { setError(pd.error); return; }
          const p = pd.post;
          // Normalise all JSON fields so the editor always gets arrays
          p.long_tail_keywords = normalizeJsonField(p.long_tail_keywords);
          p.faq_items          = normalizeJsonField(p.faq_items);
          p.tags               = normalizeJsonField(p.tags);
          // Normalise every nullable string column to '' — see helper above.
          normalizeNullableStrings(p);
          // content itself is LONGTEXT NOT NULL in the schema, but guard anyway.
          if (p.content === null || p.content === undefined) p.content = '';
          // Normalise dates
          const today = new Date().toISOString().split('T')[0];
          p.date_published = p.date_published ?? today;
          p.date_modified  = p.date_modified  ?? today;
          // Ensure schema_type has a sane default
          const valid = ['BlogPosting','Article','NewsArticle','TechArticle','FAQPage','HowTo'];
          if (!valid.includes(p.schema_type)) p.schema_type = 'BlogPosting';
          setPost(p);
          setCats(ld.categories ?? []);
        });
      })
      .catch(() => router.replace(`/admin/login?returnUrl=/admin/blog/${postId}/edit`));
  }, [router, postId]);

  if (!auth) return null;

  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-center p-8">
      <div>
        <p className="text-destructive font-semibold mb-2">Post not found</p>
        <p className="text-muted-foreground text-sm mb-4">{error}</p>
        <button onClick={() => router.push('/admin/blog')} className="text-sm text-blue-600 hover:underline">
          ← Back to Blog CMS
        </button>
      </div>
    </div>
  );

  if (!post) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-3 w-64">
        <div className="h-5 bg-muted animate-pulse rounded" />
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
      </div>
    </div>
  );

  return <BlogEditor initialPost={post} postId={postId} categories={categories} />;
}
