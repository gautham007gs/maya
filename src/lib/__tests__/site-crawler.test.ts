import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSiteCrawlerAudit } from './site-crawler';

describe('Search Engine Crawler & Indexer Simulation (2026)', () => {
  it('crawls all indexable pages and verifies 100% search engine readiness', async () => {
    const result = await runSiteCrawlerAudit();
    
    console.log(`\n🕸️ [Crawler Audit] Crawled ${result.totalPages} pages across the site:`);
    console.log(`  ✅ Passed:   ${result.passedCount}`);
    console.log(`  ⚠️ Warnings: ${result.warningCount}`);
    console.log(`  ❌ Failed:   ${result.failedCount}`);

    assert.ok(result.totalPages >= 20, `Expected at least 20 pages in sitemap, got ${result.totalPages}`);
    assert.equal(result.failedCount, 0, 'No pages should fail crawler validation');
    assert.equal(result.passedCount, result.totalPages, 'All pages should pass 100% of indexer checks');
  });
});
