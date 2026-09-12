import assert from 'node:assert/strict';
import { sanitizeCmsHtml, validatePublishFields } from '../src/lib/cms-content';

const html = '<p>Safe content</p><img src="/uploads/blog/2026/07/hero.webp" alt="Hero image" onerror="alert(1)" /><script>alert(1)</script><a href="javascript:alert(1)" target="_blank">Unsafe</a>';
const sanitized = sanitizeCmsHtml(html);
assert.ok(!sanitized.includes('<script'), 'Script tags should be removed');
assert.ok(sanitized.includes('/uploads/blog/2026/07/hero.webp'), 'Same-origin upload URLs should be preserved');
assert.ok(sanitized.includes('rel="noopener noreferrer"'), 'Blank-target links should get safe rel attributes');

const publishErrors = validatePublishFields({
  title: 'Healthy post',
  slug: 'healthy-post',
  excerpt: 'A good excerpt',
  author: 'Team',
  category_id: 1,
  featured_image: '/uploads/blog/2026/07/hero.webp',
  featured_image_alt: 'Editorial hero image',
  seo_title: 'Healthy post',
  seo_description: 'A good excerpt',
});
assert.equal(publishErrors.featured_image, undefined, 'Same-origin media URLs should pass publish validation');

const invalidCanonical = validatePublishFields({
  title: 'Healthy post',
  slug: 'healthy-post',
  excerpt: 'A good excerpt',
  author: 'Team',
  category_id: 1,
  featured_image: 'https://example.com/hero.webp',
  featured_image_alt: 'Editorial hero image',
  seo_title: 'Healthy post',
  seo_description: 'A good excerpt',
  canonical_url: 'not-a-url',
});
assert.equal(invalidCanonical.canonical_url, 'Canonical URL must be a valid absolute HTTP(S) URL.', 'Invalid canonical URLs should be rejected');

console.log('CMS foundation validation checks passed.');
