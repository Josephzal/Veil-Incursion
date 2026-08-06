/**
 * Envoy historical / compatibility ID sets — shared by flex sanitize and combat compatibility.
 * Kept separate to avoid circular imports between flex and surface modules.
 */

const HISTORICAL_ANCHOR_IDS = new Set<string>([
  'GRAVEWEAVE',
  'NULL_ARC',
  'BLOOD_REFRACTION',
  'BLACK_WICK',
]);

const COMPATIBILITY_ONLY_IDS = new Set<string>([
  'VEIL_SPLINTER',
  'BLACK_WICK',
  'CATACLYSM_SIGIL',
]);

export function isEnvoyHistoricalAnchorId(id: string): boolean {
  return HISTORICAL_ANCHOR_IDS.has(id);
}

export function isEnvoyCompatibilityOnlyId(id: string): boolean {
  return COMPATIBILITY_ONLY_IDS.has(id);
}
