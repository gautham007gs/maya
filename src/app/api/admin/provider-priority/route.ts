/**
 * GET /api/admin/provider-priority — current provider rank map
 * PUT /api/admin/provider-priority — save rankings
 *
 * Body (PUT): { ranks: { provider: number, ... } }   ← batch save (admin UI
 *   "Save Ranking" button). Replaces the whole map; conflicts are resolved
 *   server-side: if two providers claim the same rank, the one earlier in the
 *   default order keeps it and the other drops back to Auto.
 * Body (PUT): { provider: string, rank: number | null }   ← single assignment.
 *   rank = 1..N  → assign; if another provider already holds that rank it is
 *                  displaced back to Auto (uniqueness is guaranteed).
 *   rank = null  → clear back to "Auto" (default cascade position).
 * Body (PUT): { reset: true } → clear every rank back to Auto.
 *
 * Saving busts the AI engine caches, so changes apply to the next chat request
 * immediately on this instance (≤10 s on any other instance).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { PROVIDER_ORDER, invalidateKeysCache } from '@/ai/multi-provider';
import {
  getProviderRanks,
  saveProviderRanks,
  resolveRankConflicts,
  type ProviderRanks,
} from '@/lib/provider-priority';

export async function GET(req: NextRequest) {
  const session = await verifyAdminSession(req);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ranks = await getProviderRanks();
  return NextResponse.json({ ranks, defaultOrder: PROVIDER_ORDER });
}

export async function PUT(req: NextRequest) {
  const session = await verifyAdminSession(req);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const knownProvider = (p: string) => (PROVIDER_ORDER as string[]).includes(p);

  // Full reset → Auto for everyone
  if (body.reset === true) {
    const ranks = await saveProviderRanks({});
    invalidateKeysCache();
    return NextResponse.json({ success: true, ranks, swappedWith: null });
  }

  // ── Batch save: { ranks: { provider: rank, ... } } ─────────────────────────
  // Sent by the admin UI's "Save Ranking" button. The client resolves conflicts
  // optimistically in its draft, but the server re-resolves authoritatively so
  // two providers can never end up sharing a rank.
  if (body.ranks !== undefined) {
    if (typeof body.ranks !== 'object' || body.ranks === null || Array.isArray(body.ranks)) {
      return NextResponse.json({ error: 'ranks must be an object of { provider: rank }' }, { status: 400 });
    }
    const raw = body.ranks as Record<string, unknown>;
    for (const [provider, rank] of Object.entries(raw)) {
      if (!knownProvider(provider)) {
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
      }
      if (!Number.isInteger(rank) || (rank as number) < 1 || (rank as number) > PROVIDER_ORDER.length) {
        return NextResponse.json(
          { error: `Invalid rank for ${provider}: must be an integer 1–${PROVIDER_ORDER.length}` },
          { status: 400 },
        );
      }
    }
    const resolved = resolveRankConflicts(raw as ProviderRanks, PROVIDER_ORDER);
    const saved = await saveProviderRanks(resolved);
    invalidateKeysCache();
    return NextResponse.json({ success: true, ranks: saved });
  }

  // ── Single assignment: { provider, rank } ──────────────────────────────────
  const provider: string = typeof body.provider === 'string' ? body.provider : '';
  const rank: number | null = body.rank ?? null;
  if (!knownProvider(provider)) {
    return NextResponse.json({ error: `Unknown provider: ${provider || '(empty)'}` }, { status: 400 });
  }
  if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > PROVIDER_ORDER.length)) {
    return NextResponse.json({ error: `rank must be an integer 1–${PROVIDER_ORDER.length} or null` }, { status: 400 });
  }

  const ranks: ProviderRanks = resolveRankConflicts({ ...(await getProviderRanks()) }, PROVIDER_ORDER);
  let displaced: string | null = null;

  if (rank === null) {
    delete ranks[provider]; // back to Auto
  } else {
    // Uniqueness: if another provider holds the requested rank, displace it
    // back to Auto — only one provider can hold a given rank.
    const holder = Object.entries(ranks).find(([p, r]) => p !== provider && r === rank);
    if (holder) {
      displaced = holder[0];
      delete ranks[holder[0]];
    }
    ranks[provider] = rank;
  }

  const saved = await saveProviderRanks(ranks);
  invalidateKeysCache();
  return NextResponse.json({ success: true, ranks: saved, swappedWith: displaced });
}
