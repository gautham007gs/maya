'use client';



import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BlogEditor from '@/components/admin/BlogEditor';

interface Category { id: number; name: string; slug: string; }

export default function NewBlogPostPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/admin/session')
      .then(r => {
        if (r.ok) {
          if (mounted) setIsAuthenticated(true);
          fetch('/api/admin/categories')
            .then(res => res.json())
            .then(data => {
              if (mounted && data.categories) setCategories(data.categories);
            })
            .catch(() => { /* non-fatal categories load fallback */ });
        } else {
          if (mounted) router.replace('/admin/login?returnUrl=/admin/blog/new');
        }
      })
      .catch(() => {
        if (mounted) router.replace('/admin/login?returnUrl=/admin/blog/new');
      });
    return () => { mounted = false; };
  }, [router]);

  if (!isAuthenticated) return null;

  return <BlogEditor categories={categories} />;
}
