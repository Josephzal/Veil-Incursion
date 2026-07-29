/**
 * Phase 3L closeout — legacy enemy alias boundary only.
 *
 * `RIOT_VANGUARD` is NOT a live EncounterEnemyKey / registry identity.
 * It exists solely as a string alias for older saves, imports, and debug input.
 * Always canonicalize to `ECHOING_BRUTE` before registry, composition, encounter,
 * audit, matchup, debug, or UI lookup. Player-facing name: ECHOING BRUTE.
 */
import type { EncounterEnemyKey } from './enemyCombatConfig';
import { ENCOUNTER_KEY_TO_ROSTER, isEncounterEnemyKey } from './enemyCombatConfig';
import { ENEMY_ROSTER } from './enemyRoster';

/** Legacy serialized / debug strings — never live registry keys. */
export const LEGACY_ENEMY_ALIAS_KEYS = ['RIOT_VANGUARD'] as const;

export type LegacyEnemyAliasKey = (typeof LEGACY_ENEMY_ALIAS_KEYS)[number];

export const LEGACY_ENEMY_ALIAS_TO_CANONICAL: Record<LegacyEnemyAliasKey, EncounterEnemyKey> = {
  RIOT_VANGUARD: 'ECHOING_BRUTE',
};

export function isLegacyEnemyAliasKey(key: string): key is LegacyEnemyAliasKey {
  return (LEGACY_ENEMY_ALIAS_KEYS as readonly string[]).includes(key);
}

/**
 * Resolve any encounter key string (live or legacy) to the permanent runtime ID.
 * Returns null for unknown strings.
 */
export function canonicalizeEncounterEnemyKey(key: string): EncounterEnemyKey | null {
  if (isLegacyEnemyAliasKey(key)) {
    return LEGACY_ENEMY_ALIAS_TO_CANONICAL[key];
  }
  if (isEncounterEnemyKey(key)) {
    return key;
  }
  return null;
}

/** Display name — always the permanent canonical identity. */
export function playerFacingEnemyDisplayName(key: string): string {
  const canonical = canonicalizeEncounterEnemyKey(key);
  if (!canonical) return key.replace(/_/g, ' ');
  const rosterId = ENCOUNTER_KEY_TO_ROSTER[canonical];
  return ENEMY_ROSTER[rosterId]?.designation ?? canonical.replace(/_/g, ' ');
}

export function listCanonicalEnemyKeys(
  keys: readonly string[],
): EncounterEnemyKey[] {
  const out: EncounterEnemyKey[] = [];
  const seen = new Set<EncounterEnemyKey>();
  for (const key of keys) {
    const canonical = canonicalizeEncounterEnemyKey(key);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

/** @deprecated Prefer listCanonicalEnemyKeys — name kept for Phase 3L call sites. */
export function listPlayerFacingEnemyKeys(
  keys: readonly string[],
): EncounterEnemyKey[] {
  return listCanonicalEnemyKeys(keys);
}

export function assertNoLegacyAliasInLiveKeys(keys: readonly string[]): string[] {
  return keys.filter((k) => isLegacyEnemyAliasKey(k));
}
