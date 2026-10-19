'use client';

// Item #28 — Global Error Boundary (wraps the root layout itself)
// Only fires when the root layout crashes — rare but important to handle.
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A deployment changes content-hashed Next chunks. An already-open tab can
    // briefly request a chunk from the prior build and throw ChunkLoadError.
    // Refresh once to obtain the new document; the guard prevents a loop if a
    // network is genuinely unavailable.
    if (/ChunkLoadError|Loading chunk .* failed/i.test(error.message)) {
      const key = 'reloaded_after_chunk_error';
      if (sessionStorage.getItem(key) !== '1') {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return;
      }
    }
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong — Kruthika.fun</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          body { margin: 0; font-family: system-ui, sans-serif; background: #fafafa; color: #111; }
          .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
          .card { max-width: 480px; width: 100%; text-align: center; }
          h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 0.75rem; }
          p { color: #555; line-height: 1.6; margin: 0 0 1.5rem; }
          .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; }
          button, a { padding: 0.625rem 1.5rem; border-radius: 0.75rem; font-weight: 600; font-size: 0.9rem; cursor: pointer; text-decoration: none; border: none; }
          .btn-primary { background: linear-gradient(135deg,#e91e8c,#7c3aed); color: #fff; }
          .btn-secondary { border: 2px solid #c4b5fd; color: #5b21b6; background: transparent; }
          .digest { font-family: monospace; font-size: 0.75rem; color: #999; margin-top: 1rem; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="card">
            <div style={{ fontSize: '5rem', fontWeight: 900, background: 'linear-gradient(135deg,#ef4444,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, marginBottom: '1.5rem' }}>
              500
            </div>
            <h1>Critical error</h1>
            <p>
              Something went seriously wrong. Please try refreshing the page or return to the homepage.
              {error.digest && (
                <span className="digest"><br />Error ID: {error.digest}</span>
              )}
            </p>
            <div className="actions">
              <button className="btn-primary" onClick={reset}>Try Again</button>
              <a className="btn-secondary" href="/">Go Home</a>
            </div>
            <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#999' }}>
              Persistent? Email <a href="mailto:support@kruthika.fun" style={{ color: '#7c3aed' }}>support@kruthika.fun</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
