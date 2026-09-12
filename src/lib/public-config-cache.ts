/**
 * Process-local invalidation signal for the public configuration read model.
 *
 * Kept outside the route module because App Route files may only export HTTP
 * handlers and supported Next.js route configuration values.
 */
let generation = 0;

export function getPublicConfigCacheGeneration(): number {
  return generation;
}

export function invalidateLocalPublicConfig(): void {
  generation += 1;
}
