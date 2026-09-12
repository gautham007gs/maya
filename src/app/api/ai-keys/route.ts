// Consolidation shim — delegate to canonical admin/api-keys handlers
// This file previously duplicated admin API-key logic and risked drift. The
// admin routes under /api/admin/api-keys are the canonical implementation and
// are used by the admin UI. Re-export their handlers here so both URLs work
// while keeping code in a single place.

export { GET, POST } from '@/app/api/admin/api-keys/route';
