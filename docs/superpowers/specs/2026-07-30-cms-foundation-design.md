# CMS Foundation — Design Specification

> **Status (2026-08-09):** This design spec was **implemented**. It is preserved here as the historical record of the CMS foundation release. Note: it was written against Next.js 15; the project has since upgraded to **Next.js 16.3.0** (which renamed `middleware.ts` → `proxy.ts`). See `docs/` for current architecture.

## Purpose

Make the existing Kruthika AI Blog CMS safe, reliable, search-ready, and compatible with Hostinger Business hosting before introducing larger editorial workflow and rich-text-editor changes.

This is a foundation release. It preserves the existing Next.js (15 → 16.3.0), TypeScript, Tailwind, and Hostinger MySQL/phpMyAdmin architecture. It does not migrate to another CMS or database.

## Goals

1. Prevent unsafe authored HTML from reaching public pages.
2. Ensure CMS-uploaded media survives Hostinger application deployments.
3. Correct publishing, cache invalidation, canonical URL, and structured-data behavior.
4. Give editors clear field requirements and useful validation feedback without blocking incomplete drafts.
5. Provide idempotent, phpMyAdmin-runnable database changes and explicit Hostinger setup instructions.

## Explicitly Out of Scope

- Replacing the current HTML editor with Tiptap or another rich-text editor.
- Publishing workflow states beyond the current draft/published states.
- Scheduling, autosave, revision history, trash/restore, bulk editing, and editorial calendar.
- Database-managed authors and taxonomy-management screens.
- Cloud media services or new third-party accounts.
- Changing existing public URLs or deleting existing post data.

These capabilities are later milestones. This release prepares their underlying seams without partially implementing them.

## Hosting and Media Design

### Persistent media directory

Media files will live outside the Hostinger application/release directory, in a configurable persistent filesystem directory. The app will use environment variables rather than hard-coded Hostinger account paths:

```text
CMS_MEDIA_ROOT=/home/<hosting-account>/cms-media
CMS_MEDIA_PUBLIC_PATH=/uploads
```

- `CMS_MEDIA_ROOT` is the server filesystem directory. It must be writable by the Node.js process and must not be removed during application deployments.
- `CMS_MEDIA_PUBLIC_PATH` is the stable public URL prefix stored in CMS fields, for example `/uploads/blog/2026/07/hero.webp`.
- A same-origin application route serves files from this directory. It validates the requested path, blocks traversal, and sends an appropriate `Content-Type` and cache policy.
- In development, a local non-versioned media folder is used when a persistent Hostinger path is not configured. The fallback is explicitly documented as development-only.

### Image upload policy

The upload endpoint remains admin-only and rate-limited. It will:

- accept JPEG, PNG, WebP, and GIF images only;
- verify declared MIME type and file signature;
- enforce a 10 MB maximum file size;
- generate server-owned filenames and organized year/month paths;
- reject malformed input, traversal attempts, and unsupported image data;
- return a stable same-origin URL only after a successful write.

The existing featured-image field remains URL-based so historical external image URLs continue to work. The editor will record an image alt-text field for newly uploaded or chosen featured images.

### Required Hostinger setup

Before deploying this release, the site owner must create the persistent directory and grant write access to the Node.js application user. The deployment documentation will include exact hPanel/SSH guidance using the account's own path, without embedding account identifiers in code or documentation examples.

## Content Security Design

### Server-side sanitization

The system must not trust HTML supplied by an authenticated administrator. Content is sanitized:

1. before it is stored on create and update; and
2. before it is rendered on public pages, protecting existing legacy rows.

The sanitizer uses an explicit allowlist appropriate for editorial content:

- structural content: `p`, `br`, `h2`–`h6`, `hr`, `blockquote`, `ul`, `ol`, `li`;
- inline content: `strong`, `b`, `em`, `i`, `code`, `pre`;
- links: `a` with validated `href`, `title`, and safe `rel`/`target`;
- media: `img` with validated `src`, non-empty `alt`, supported sizing and loading attributes;
- tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`, `caption`.

It removes scripts, styles, forms, embeds, event-handler attributes, `javascript:`/data URLs, and all attributes not explicitly allowed. Link behavior must add safe `rel` values when a link opens a new tab.

FAQ answers are treated as text unless the future rich editor adds a separately sanitized rich-answer model.

### Render safety

The public renderer may retain the current display enhancements—heading anchors, table of contents, image dimension defaults, and ad insertion—but only operates on sanitized HTML. Content transformations must never concatenate untrusted attribute values into output markup.

## Data Model and Migration

One new, idempotent migration file will be added for phpMyAdmin execution. It will use the project’s existing MySQL 5.7+ compatible information-schema procedure pattern.

### `blog_posts` additions

- `featured_image_alt VARCHAR(255) NULL` — concise editorial alt text for the featured image.
- `content_sanitized_at DATETIME NULL` — optional migration/operational marker, only included if it is used by the migration strategy.

Existing records retain their original values. A missing featured image alt text is a visible editorial warning, not a mass-breaking migration.

No existing status values, slugs, canonical URLs, or records are changed by schema migration.

## Validation and Publishing Rules

### Draft saves

Drafts can be saved with incomplete content. The API validates field types, maximum lengths, valid schema type, URL safety, JSON-array shapes, and sanitizes content. It returns a checklist of non-blocking warnings where appropriate.

### Publish action

Publishing requires:

- title;
- unique valid slug;
- excerpt;
- author;
- selected category;
- featured image;
- featured image alt text;
- SEO title and SEO description;
- valid schema type;
- valid canonical URL when an override is supplied.

The server is authoritative. Client-side checks improve editor feedback but never replace API validation. Existing published legacy posts remain public; when an editor next updates or republishes one, its missing items are surfaced for correction.

### SEO field guardrails

The editor continues to display live character guidance and additionally enforces field caps:

| Field | Target | Hard limit |
|---|---:|---:|
| Title | 50–60 characters | 70 |
| Excerpt | 120–160 characters | 165 |
| SEO title | 50–60 characters | 65 |
| SEO description | 140–160 characters | 165 |
| Featured image alt text | descriptive and concise | 255 |
| Slug | lowercase, readable, stable | 200 |

SEO title falls back to title and SEO description falls back to excerpt for metadata generation, but publishing requires explicit fields in this first foundation release so editorial quality is deliberate.

## Publishing, Caching, and Indexing Design

### State correctness

- Metadata-only updates preserve an existing `schema_type`; an omitted schema type must never reset a post to `BlogPosting`.
- Updates reject a missing or blank title when the title field is supplied.
- Cache invalidation covers the current public route, blog listing, and sitemap only when a post is published or when a previously published post changes.
- A draft-only edit never creates search-engine notifications.
- A published URL is submitted to IndexNow after a successful publish or relevant published-post update.

### Site URL configuration

`NEXT_PUBLIC_BASE_URL` is the canonical site URL configuration for the codebase and deployment documentation. It must be a valid absolute HTTPS URL in production. A temporary compatibility read for `NEXT_PUBLIC_SITE_URL` may be retained during transition, with one documented precedence order, so existing Hostinger configuration does not break unexpectedly.

### Structured data

Each database-driven blog post emits one JSON-LD `@graph` only:

- `WebPage`;
- the selected article node (`BlogPosting`, `Article`, `NewsArticle`, `TechArticle`, `FAQPage`, or `HowTo`);
- `Person` author;
- `Organization` publisher;
- `ImageObject` when a featured image exists;
- `BreadcrumbList`;
- optional `FAQPage` only where applicable.

The page-level duplicate Article, Author, and Breadcrumb scripts are removed. Generated metadata continues to provide canonical, robots, Open Graph, Twitter, author, publish-date, and modified-date values.

## Admin Experience Changes

The existing screen remains familiar for this foundation release. It gains:

- unambiguous required-field labels for publish-only requirements;
- an actionable pre-publish checklist showing missing fields;
- persistent, human-readable API validation errors beside the relevant field where practical;
- an image alt-text field tied to the featured image;
- a media status message distinguishing external image URLs from Hostinger-persistent uploads;
- wording that makes deletion’s permanence clear until the later Trash feature is delivered;
- professional neutral status badges and messages (no emoji-based status indicators).

The full rich-text editing and live-preview redesign is a dedicated follow-up milestone rather than an incomplete partial replacement in this release.

## API and Error Handling

All changed admin routes require the existing verified admin session.

Validation failures return HTTP 400 with a stable `{ error, fields? }` response shape. Duplicate slugs return HTTP 409. Unauthorized requests return 401. File type/size/signature failures return clear 400/413 responses. Filesystem write failures return 500 without exposing server paths.

The content-fetch path fails closed for malformed media paths and degrades safely for missing media files with a 404 response. Database connectivity failures retain the existing graceful-degradation approach, but admin save/upload actions surface a clear error rather than pretending success.

## Testing and Verification

### Automated checks

- `npm run typecheck`
- `npm run build`
- focused tests or testable helper checks covering:
  - script/event/unsafe URL removal;
  - preserved allowed content;
  - schema type preservation on partial update;
  - publish-only required fields;
  - invalid canonical URL rejection;
  - valid and invalid image signature/type paths;
  - rejected media traversal requests;
  - one JSON-LD graph generated for a DB post.

### Browser and manual verification

1. Create an incomplete draft and confirm it saves with warnings.
2. Attempt to publish without required fields and confirm the API blocks it.
3. Upload a valid image; confirm it appears via its stable `/uploads/...` URL.
4. Publish a complete post; confirm listing, article page, canonical/meta tags, and the single JSON-LD graph.
5. Edit SEO-only metadata on a non-default schema post; confirm the schema type is unchanged.
6. Run a Hostinger deployment following the documented setup and confirm a previously uploaded image remains available afterward.

## Rollout

1. Deploy code and add new environment variables in hPanel.
2. Create the persistent media directory and permissions.
3. Run the migration through phpMyAdmin.
4. Restart the Node.js application.
5. Test upload and publish using a non-production draft first.
6. Publish the release after verification.

No destructive migration or bulk data rewrite is included. Rollback is code/config rollback; uploaded media files and added nullable columns are backwards-compatible.

## Follow-up Milestones

1. Editorial workflow: review, scheduled, archived, trash/restore, revisions, autosave, and an editorial calendar.
2. Professional editor: Tiptap-based rich-text authoring, preview, link/media tooling, internal-link suggestions, and migration from raw HTML to structured content.
3. Content operations: author management, taxonomy management, category/tag archive pages, paginated search, and bulk operations.