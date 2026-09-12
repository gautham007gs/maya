import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { computeSeoScore } from '@/lib/schema-generator';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/seo/score
 * Accepts partial post data and returns SEO/readability scores + issues.
 * Also optionally checks for broken external links (HEAD request, 5s timeout).
 */
export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    const { seoScore, readabilityScore, issues } = computeSeoScore({
      title:                body.title              || '',
      seo_title:            body.seo_title           || null,
      seo_description:      body.seo_description     || null,
      excerpt:              body.excerpt              || null,
      content:              body.content             || null,
      featured_image:       body.featured_image      || null,
      featured_image_alt:   body.featured_image_alt  || null,
      seo_keywords:         body.seo_keywords        || null,
      long_tail_keywords:   body.long_tail_keywords  || null,
      faq_items:            body.faq_items           || null,
      author:               body.author              || null,
      author_title:         body.author_title        || null,
      word_count:           body.word_count          || 0,
      schema_type:          body.schema_type         || 'BlogPosting',
      og_image:             body.og_image            || null,
      og_title:             body.og_title            || null,
      og_description:       body.og_description      || null,
    });

    // Optional: check broken external links (fire-and-forget, max 6 links)
    const brokenLinks: string[] = [];
    if (body.check_links && body.content) {
      const externalUrlPattern = /href="(https?:\/\/(?!kruthika\.fun)[^"]+)"/gi;
      const content: string = body.content;
      const urls: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = externalUrlPattern.exec(content)) !== null && urls.length < 6) {
        urls.push(m[1]);
      }

      const checkUrl = async (url: string): Promise<boolean> => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
          clearTimeout(timer);
          return res.status >= 400;
        } catch { return true; /* treat as broken */ }
      };

      const results = await Promise.allSettled(urls.map(checkUrl));
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) brokenLinks.push(urls[i]);
      });
    }

    return NextResponse.json({
      seoScore,
      readabilityScore,
      issues,
      brokenLinks,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Score computation failed' }, { status: 500 });
  }
}
