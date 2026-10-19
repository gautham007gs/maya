/**
 * SEO Automation Cron — /api/cron/seo
 *
 * Schedule this to run every hour via your cron provider:
 *   - Vercel: set in vercel.json crons → "0 * * * *"
 *   - cron-job.org / EasyCron: POST https://kruthika.fun/api/cron/seo
 *     with header: Authorization: Bearer <CRON_SECRET>
 *
 * What it does:
 *   1. Submits any posts published or modified in the last 25 hours to IndexNow
 *   2. Pings Google & Bing with the sitemap URL
 *   3. Revalidates the sitemap, blog list, and blog author pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getPublishedPosts, publishScheduledPosts } from '@/lib/blog-db';
import { pingIndexNow, blogUrl } from '@/lib/indexnow';
import { acquireCronRun } from '@/lib/cron-idempotency';
import { cronLockGate } from '@/lib/cron-lock-gate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // Require secret to be set
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

/** Ping Google's Ping API with the sitemap URL */
async function pingSitemapGoogle(): Promise<void> {
  try {
    const sitemapUrl = encodeURIComponent(`${BASE_URL}/sitemap.xml`);
    await fetch(`https://www.google.com/ping?sitemap=${sitemapUrl}`, { method: 'GET' });
  } catch (err) {
    console.warn('[SEO Cron] Google sitemap ping failed:', err);
  }
}

/** Ping Bing's sitemap submission API */
async function pingSitemapBing(): Promise<void> {
  try {
    const sitemapUrl = encodeURIComponent(`${BASE_URL}/sitemap.xml`);
    await fetch(`https://www.bing.com/ping?sitemap=${sitemapUrl}`, { method: 'GET' });
  } catch (err) {
    console.warn('[SEO Cron] Bing sitemap ping failed:', err);
  }
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Idempotency lock (hourly) ──
  // Prevent duplicate/overlapping external cron invocations in the same UTC
  // hour from double-pinging indexes / double-publishing scheduled posts.
  const runKey = `seo:hourly:${new Date().toISOString().slice(0, 13)}`;
  const lock = await acquireCronRun('seo', runKey);
  const blocked = cronLockGate(lock, runKey);
  if (blocked) return blocked;

  const results: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
  };

  // ── 0. Publish any scheduled posts that are due now ───────────────────────
  let scheduledPublished: string[] = [];
  try {
    scheduledPublished = await publishScheduledPosts();
    results.scheduledPublished = scheduledPublished.length;
  } catch (err) {
    results.scheduleError = String(err);
  }

  // ── 1. Fetch all published posts ──────────────────────────────────────────
  let recentUrls: string[] = [];
  try {
    const posts = await getPublishedPosts();
    const cutoff = Date.now() - 25 * 60 * 60 * 1000; // 25 h window

    const recent = posts.filter(p => {
      const modDate = p.date_modified || p.date_published;
      if (!modDate) return false;
      return new Date(modDate).getTime() >= cutoff;
    });

    recentUrls = recent.map(p => blogUrl(p.slug));
    results.recentPostCount = recent.length;
    results.recentUrls = recentUrls;
  } catch (err) {
    results.dbError = String(err);
  }

  // ── 2. Always include top-level URLs in the IndexNow ping ─────────────────
  const coreUrls = [
    BASE_URL,
    `${BASE_URL}/blog`,
    `${BASE_URL}/sitemap.xml`,
  ];
  const scheduledUrls = scheduledPublished.map(slug => blogUrl(slug));
  const allIndexNowUrls = [...new Set([...coreUrls, ...recentUrls, ...scheduledUrls])];

  // ── 3. Submit to IndexNow ─────────────────────────────────────────────────
  try {
    const ok = await pingIndexNow(allIndexNowUrls);
    results.indexNow = { ok, urlCount: allIndexNowUrls.length };
  } catch (err) {
    results.indexNowError = String(err);
  }

  // ── 4. Ping Google & Bing sitemaps in parallel ────────────────────────────
  await Promise.allSettled([pingSitemapGoogle(), pingSitemapBing()]);
  results.sitemapPings = 'Google + Bing';

  // ── 5. Revalidate Next.js ISR cache for key paths ─────────────────────────
  try {
    revalidatePath('/sitemap.xml');
    revalidatePath('/blog');
    revalidatePath('/blog/author');
    scheduledPublished.forEach(slug => revalidatePath(`/blog/${slug}`));
    results.revalidated = ['/sitemap.xml', '/blog', '/blog/author', ...scheduledPublished.map(slug => `/blog/${slug}`)];
  } catch (err) {
    results.revalidateError = String(err);
  }

  results.finishedAt = new Date().toISOString();
  console.log('[SEO Cron] Completed:', results);
  await lock.finish('done', { recentPostCount: results.recentPostCount, indexNow: results.indexNow });

  return NextResponse.json({ ok: true, ...results });
}

/** Allow GET for easy testing in development */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Use POST in production' }, { status: 405 });
  }
  return POST(request);
}
