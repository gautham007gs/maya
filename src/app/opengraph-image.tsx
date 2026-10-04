import { ImageResponse } from 'next/og';

export const alt = 'Kruthika AI Girlfriend — Free, No Sign Up';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  // Branded high-contrast social banner
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #075e54 0%, #128c7e 40%, #25d366 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -120, left: -60,
          width: 500, height: 500, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          display: 'flex',
        }} />

        {/* Avatar circle */}
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          border: '3px solid rgba(255,255,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 32, fontSize: 60,
        }}>
          💬
        </div>

        {/* Title */}
        <div style={{
          fontSize: 64, fontWeight: 800, color: '#ffffff',
          letterSpacing: '-1px', marginBottom: 16,
          textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex',
        }}>
          Kruthika AI
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 28, fontWeight: 500, color: 'rgba(255,255,255,0.88)',
          marginBottom: 40, display: 'flex',
        }}>
          Free AI Girlfriend · No Sign Up · 24/7 Chat
        </div>

        {/* Tags row */}
        <div style={{ display: 'flex', gap: 16 }}>
          {['Hindi & English', 'Generous Free Chat', 'No Sign Up'].map(tag => (
            <div key={tag} style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 100, padding: '8px 20px',
              color: '#ffffff', fontSize: 18, fontWeight: 500,
              display: 'flex',
            }}>
              {tag}
            </div>
          ))}
        </div>

        {/* Domain badge */}
        <div style={{
          position: 'absolute', bottom: 32, right: 40,
          color: 'rgba(255,255,255,0.7)', fontSize: 20, fontWeight: 600,
          display: 'flex',
        }}>
          kruthika.fun
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
