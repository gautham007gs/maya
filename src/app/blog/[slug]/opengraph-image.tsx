import { ImageResponse } from 'next/og';
import { getPublishedPostBySlug } from '@/lib/blog-db';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ slug: string }> };

export default async function Image({ params }: Props) {
  const { slug } = await params;

  let title = 'Kruthika AI Girlfriend Blog';
  let excerpt = 'Guides, tips, and insights on AI companionship and virtual relationships.';
  let author = 'Kruthika.fun Team';
  let category = 'AI Companion';

  try {
    const post = await getPublishedPostBySlug(slug);
    if (post) {
      title = post.seo_title || post.title;
      excerpt = post.seo_description || post.excerpt || excerpt;
      author = post.author;
      category = post.category_name || category;
    }
  } catch { /* Use defaults */ }

  // Truncate long titles so they fit
  const displayTitle = title.length > 72 ? title.slice(0, 69) + '…' : title;
  const displayExcerpt = excerpt.length > 120 ? excerpt.slice(0, 117) + '…' : excerpt;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#0f172a',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left green accent bar */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 8, background: '#25d366',
          display: 'flex',
        }} />

        {/* Background gradient blob */}
        <div style={{
          position: 'absolute', top: -200, right: -200,
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,211,102,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -150, left: 200,
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,211,102,0.08) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Main content */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          padding: '52px 72px 52px 80px',
          flex: 1, justifyContent: 'space-between',
        }}>
          {/* Header: site + category */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              color: '#25d366', fontSize: 22, fontWeight: 700,
              display: 'flex',
            }}>
              kruthika.fun
            </div>
            <div style={{
              width: 4, height: 4, borderRadius: '50%',
              background: '#475569', display: 'flex',
            }} />
            <div style={{
              background: 'rgba(37,211,102,0.15)',
              border: '1px solid rgba(37,211,102,0.3)',
              borderRadius: 100, padding: '4px 16px',
              color: '#4ade80', fontSize: 18, fontWeight: 500,
              display: 'flex',
            }}>
              {category}
            </div>
          </div>

          {/* Title */}
          <div style={{
            fontSize: displayTitle.length > 50 ? 46 : 54,
            fontWeight: 800,
            color: '#f8fafc',
            lineHeight: 1.2,
            letterSpacing: '-0.5px',
            display: 'flex',
            flexWrap: 'wrap',
          }}>
            {displayTitle}
          </div>

          {/* Excerpt */}
          <div style={{
            fontSize: 22, color: '#94a3b8',
            lineHeight: 1.5, display: 'flex',
          }}>
            {displayExcerpt}
          </div>

          {/* Footer: author + blog label */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Author avatar circle */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 18, fontWeight: 700,
              }}>
                {author.charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 600, display: 'flex' }}>
                  {author}
                </div>
                <div style={{ color: '#64748b', fontSize: 15, display: 'flex' }}>
                  Kruthika.fun
                </div>
              </div>
            </div>

            <div style={{
              background: '#25d366',
              borderRadius: 12, padding: '10px 24px',
              color: '#fff', fontSize: 18, fontWeight: 700,
              display: 'flex',
            }}>
              Read Article →
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
