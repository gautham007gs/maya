let withBundleAnalyzer = (config) => config;
try {
  const bundleAnalyzer = require("@next/bundle-analyzer");
  withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
  });
} catch (_) {
  // @next/bundle-analyzer not installed or not needed in production build
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://kruthika.fun";

// Safely extract the hostname from baseUrl for serverActions allowedOrigins
let baseUrlHost = "localhost:5000";
try {
  baseUrlHost = new URL(baseUrl).host;
} catch {}

// Content-Security-Policy is set dynamically per-request in src/proxy.ts
// (Next 16 renamed the middleware entrypoint middleware.ts -> proxy.ts; there is
// no src/middleware.ts in this app — see buildCSP() there for the directives).
// It is nonce-based, so 'unsafe-inline' is gone from script-src for modern browsers.
// The static headers below cover everything EXCEPT CSP.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // X-Frame-Options only in production — iframing is restricted outside dev.
  ...(process.env.NODE_ENV !== "production"
    ? []
    : [{ key: "X-Frame-Options", value: "DENY" }]),
  { key: "X-XSS-Protection", value: "1; mode=block" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 'unsafe-none' allows the ad network (Adsterra) to open cross-origin
  // windows/popunders and enables proper tracking pixels across origins.
  { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
  {
    key: "Permissions-Policy",
    value:
      "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Download-Options", value: "noopen" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

// Build the list of allowed dev origins — always include localhost variants.
// Country landing pages that are noindex — keep in sync with INDEXABLE_COUNTRIES
// in src/lib/locales.ts (indexable: in, us, uk).
const NOINDEX_GEO_LIST = ["au","ca","ae","ng","my","ph","pk","br","id","de","fr","it","es","mx","jp","kr","sa","tr","vn","nl","pl","se","th","sg","za","ar","bd"];
const NOINDEX_GEO = NOINDEX_GEO_LIST.map((c) => c + "$").join("|");
const NOINDEX_GEO_ALT = NOINDEX_GEO_LIST.join("|");

const publicPageHeaders = (robotsValue) => [
          ...securityHeaders.filter(
            (h) => h.key !== "Cache-Control" && h.key !== "X-Robots-Tag",
          ),
          // Was `max-age=3600` — returning visitors could see a full hour-old
          // page (including layout/ad changes) with zero network check, which
          // is exactly the "site looks old on my device" complaint. `max-age=0`
          // still lets the browser keep a cached copy but forces it to
          // revalidate (conditional GET / 304) on every navigation, so a
          // fresh deploy is visible immediately while still being fast when
          // nothing changed server-side.
          {
            key: "Cache-Control",
            value:
              "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
          },
          ...(robotsValue ? [{ key: "X-Robots-Tag", value: robotsValue }] : []),
          // CORS: wildcard (*) and credentials:true are mutually exclusive per spec.
          // Same-origin requests (the normal case for this app) do not need CORS
          // headers at all. Only set them on /api routes where cross-origin callers
          // are expected; see the /api block above.
          { key: "Access-Control-Allow-Origin", value: baseUrl },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
];

const allowedDevOrigins = ["127.0.0.1", "localhost","172.28.45.102"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Build errors must never be silenced — a type error in production is a runtime bug.
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ["mysql2", "iconv-lite", "sharp"],
  // Note: eslint config was removed — Next.js 16 no longer supports it in next.config.js.
  // Run `next lint` directly or configure via .eslintrc instead.
  // skipTrailingSlashRedirect removed — with this option set, requests to
  // /blog/ were not redirected to /blog, allowing both trailing-slash and
  // non-trailing-slash URLs to be indexed simultaneously. That creates
  // duplicate-content pairs for every route. Next.js now automatically
  // redirects /blog/ → /blog (301) matching the canonical URLs in sitemap.ts
  // and all <link rel="canonical"> tags (audit #42).
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,

  // Allow local development origins without depending on a hosting provider.
  allowedDevOrigins: allowedDevOrigins.filter(
    (origin, index, origins) => origins.indexOf(origin) === index,
  ),

  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
    reactRemoveProperties:
      process.env.NODE_ENV === "production"
        ? { properties: ["^data-test", "^data-testid"] }
        : false,
  },

  httpAgentOptions: {
    keepAlive: true,
  },

  turbopack: {
    root: __dirname,
  },

  experimental: {
    scrollRestoration: true,
    // Hostinger shared hosting exposes many CPUs but enforces a low process/
    // thread limit. Without an explicit cap, Next.js starts one worker per
    // detected CPU during page-data collection and the build aborts with
    // "OS can't spawn worker thread". This only affects build parallelism.
    cpus: 1,
    serverActions: {
      // Allow server actions from the configured base URL and localhost variants.
      allowedOrigins: ["localhost:5000", "127.0.0.1:5000", baseUrlHost].filter(
        (v, i, arr) => arr.indexOf(v) === i,
      ), // deduplicate
      bodySizeLimit: "2mb",
    },
    // Next.js built-in tree-shaking — replaces modularizeImports.
    // NOTE: lucide-react is intentionally excluded — this optimization was
    // triggering Turbopack "module factory is not available" crashes on
    // icon chunks after larger admin components changed. lucide-react's
    // icons are already individual ESM modules, so it tree-shakes fine
    // without this flag; removing it costs nothing and fixes the crash.
    optimizePackageImports: [
      "@radix-ui/react-dialog",
      "@radix-ui/react-tabs",
      "@radix-ui/react-accordion",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-toast",
      "date-fns",
      "react-hook-form",
      "recharts",
    ],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    deviceSizes: [360, 414, 768, 1080, 1280],
    imageSizes: [16, 32, 64, 96, 128, 256],
    remotePatterns: [
      // Known image hosting and CDN domains used by this app
      { protocol: "https", hostname: "*.googleapis.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.imgur.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "*.unsplash.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.pexels.com" },
      { protocol: "https", hostname: "*.cdn.kruthika.fun" },
      // Self-hosted uploads served from the same origin
      { protocol: "https", hostname: "kruthika.fun" },
      { protocol: "https", hostname: "www.kruthika.fun" },
      // No wildcard hosts — restrict image optimizer to known CDNs and the site origin.
    ],
  },

  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    return [
      {
        // Never serve a stale service-worker script after a deployment.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2|ttf|eot)",
        locale: false,
        headers: [
          {
            key: "Cache-Control",
            value: isProd ? "public, max-age=31536000, immutable" : "no-cache",
          },
        ],
      },
      {
        // JSON API responses should never carry a public/indexable signal —
        // was previously getting BOTH this block's "no-store" Cache-Control
        // AND the generic "/:path*" block's "public, max-age=60..." (two
        // conflicting Cache-Control headers on every /api response — invalid
        // HTTP, resolved unpredictably by different caches/CDNs) plus a
        // nonsensical "index, follow" X-Robots-Tag on JSON. The generic block
        // below now excludes /api, /admin, /lite, /diagnostics entirely, so
        // these are each the single source of truth for their own paths
        // (SEO audit #3, #4).
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // /admin, /lite, and /diagnostics already set robots:{index:false}
        // via their own Next.js metadata exports, but that's a single point
        // of failure — one new page added under these paths without its own
        // metadata export silently falls back to "index, follow" from the
        // generic header block. These explicit header-level rules are a
        // backstop that doesn't depend on every page remembering to opt out
        // (SEO audit #3).
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/lite/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/diagnostics/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // /status is noindex via its metadata; the generic block below used to
        // ALSO send "index, follow" for it — two contradictory robots signals
        // on one URL. Give it the same noindex at header level.
        source: "/status",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Country pages that are noindex (see INDEXABLE_COUNTRIES in
        // src/lib/locales.ts) must not also be sent "index, follow".
        source: "/:geo(" + NOINDEX_GEO_ALT + ")",
        headers: publicPageHeaders("noindex, follow"),
      },
      {
        // Excludes /api, /admin, /lite, /diagnostics, and _next/ — those have their own
        // header blocks above and must not also receive this block's public/
        // cacheable Cache-Control or "index, follow" X-Robots-Tag (SEO audit
        // #3, #4). Everything else (real, public, indexable pages) matches
        // as before.
        source: "/((?!api/|admin/|lite/|diagnostics/|status$|status/|_next/|" + NOINDEX_GEO + ").*)",
        // No X-Robots-Tag here on purpose: each page declares its own robots meta
        // (index/noindex). A blanket "index" header contradicted pages that are
        // intentionally noindex, e.g. empty blog categories. Default = index.
        headers: publicPageHeaders(null),
      },
    ];
  },

  async redirects() {
    return [
      // Collapse www.kruthika.fun → https://kruthika.fun in a single 301 hop (fixes I-23 redirect chain)
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.kruthika.fun" }],
        destination: "https://kruthika.fun/:path*",
        permanent: true,
      },
      // Soft-404 / unpublished slugs → clean 301 redirects to live sections (fixes I-01, RC1)
      {
        source: "/blog/best-ai-girlfriend-apps-2026-ranked",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/blog/ai-companion-loneliness-2026-research",
        destination: "/blog/category/psychology",
        permanent: true,
      },
      {
        source: "/blog/how-ai-girlfriend-technology-works-2026",
        destination: "/blog/category/technology",
        permanent: true,
      },
      {
        source: "/blog/how-to-talk-to-ai-girlfriend-better-conversations",
        destination: "/blog/category/how-to",
        permanent: true,
      },
      {
        source: "/blog/is-ai-girlfriend-safe-privacy-mental-health-2026",
        destination: "/blog/category/privacy-safety",
        permanent: true,
      },
      {
        source: "/blog/author/habibi",
        destination: "/blog/author",
        permanent: true,
      },
      // Legacy 2025 slug redirects → live sections
      {
        source: "/blog/psychology-ai-girlfriends",
        destination: "/blog/category/psychology",
        permanent: true,
      },
      {
        source: "/blog/ai-girlfriend-privacy-safety-guide",
        destination: "/blog/category/privacy-safety",
        permanent: true,
      },
      {
        source: "/blog/how-to-talk-ai-girlfriend-conversation-guide",
        destination: "/blog/category/how-to",
        permanent: true,
      },
      {
        source: "/blog/best-ai-girlfriend-2025",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/blog/best-ai-girlfriend-apps-india-2025",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/blog/ai-girlfriend-emotional-support-loneliness",
        destination: "/blog/category/psychology",
        permanent: true,
      },
      {
        source: "/blog/how-does-ai-girlfriend-work-technology-guide",
        destination: "/blog/category/technology",
        permanent: true,
      },
      { source: "/blog/related-post", destination: "/blog", permanent: true },
    ];
  },

  async rewrites() {
    return [];
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        string_decoder: false,
      };
    }
    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
