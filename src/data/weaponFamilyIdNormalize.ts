/**
 * Stage II-C — authoritative legacy → canonical weapon-family ID normalization.
 * Apply at stored-input / authored-reference boundaries before live lookups.
 */

/** Live permanent family IDs after Stage II-C. */
export type CanonicalWeaponFamilyId =
  | 'aegis-longsword'
  | 'aegis-paired-blades'
  | 'aegis-claymore'
  | 'hex-revolver'
  | 'hex-carbine'
  | 'hex-shotgun'
  | 'envoy-vambrace'
  | 'envoy-scythe'
  | 'envoy-sanguine-prism';

/** Pre–Stage II-C permanent IDs (stored-input / migration only). */
export type LegacyWeaponFamilyId =
  | 'aegis-runed-longsword'
  | 'aegis-rift-edge'
  | 'aegis-claymore-blade'
  | 'hex-silver-core-sidearm'
  | 'hex-pulse-rifle'
  | 'hex-void-cannon'
  | 'envoy-echo-lantern'
  | 'envoy-null-conduit'
  | 'envoy-sanguine-prism';

export const CANONICAL_WEAPON_FAMILY_IDS: readonly CanonicalWeaponFamilyId[] = [
  'aegis-longsword',
  'aegis-paired-blades',
  'aegis-claymore',
  'hex-revolver',
  'hex-carbine',
  'hex-shotgun',
  'envoy-vambrace',
  'envoy-scythe',
  'envoy-sanguine-prism',
] as const;

/**
 * Exact legacy permanent ID → canonical permanent ID.
 * Hex mapping is by legacy ID (not former display names):
 *   hex-void-cannon → hex-shotgun (former Nullbreach kit)
 *   hex-pulse-rifle → hex-carbine (former Ash Shotgun kit)
 */
export const LEGACY_WEAPON_FAMILY_ID_MAP: Readonly<Record<LegacyWeaponFamilyId, CanonicalWeaponFamilyId>> = {
  'aegis-runed-longsword': 'aegis-longsword',
  'aegis-rift-edge': 'aegis-paired-blades',
  'aegis-claymore-blade': 'aegis-claymore',
  'hex-silver-core-sidearm': 'hex-revolver',
  'hex-pulse-rifle': 'hex-carbine',
  'hex-void-cannon': 'hex-shotgun',
  'envoy-echo-lantern': 'envoy-vambrace',
  'envoy-null-conduit': 'envoy-scythe',
  'envoy-sanguine-prism': 'envoy-sanguine-prism',
};

const LEGACY_OR_CANONICAL = new Set<string>([
  ...Object.keys(LEGACY_WEAPON_FAMILY_ID_MAP),
  ...CANONICAL_WEAPON_FAMILY_IDS,
]);

export function isCanonicalWeaponFamilyId(id: string): id is CanonicalWeaponFamilyId {
  return (CANONICAL_WEAPON_FAMILY_IDS as readonly string[]).includes(id);
}

export function isLegacyWeaponFamilyId(id: string): id is LegacyWeaponFamilyId {
  return Object.prototype.hasOwnProperty.call(LEGACY_WEAPON_FAMILY_ID_MAP, id);
}

/**
 * Normalize a stored or authored weapon-family ID to the live canonical ID.
 * - Recognized legacy → canonical
 * - Already canonical → unchanged
 * - Unknown → null (fail closed)
 */
export function normalizeWeaponFamilyId(id: unknown): CanonicalWeaponFamilyId | null {
  if (typeof id !== 'string' || id.length === 0) return null;
  if (isCanonicalWeaponFamilyId(id)) return id;
  if (isLegacyWeaponFamilyId(id)) return LEGACY_WEAPON_FAMILY_ID_MAP[id];
  return null;
}

/** True when the raw string is a known legacy or canonical family ID. */
export function isRecognizedWeaponFamilyIdInput(id: unknown): boolean {
  return typeof id === 'string' && LEGACY_OR_CANONICAL.has(id);
}

/**
 * Normalize a list of family IDs, collapsing legacy+canonical duplicates.
 * Unknown entries are dropped (fail closed).
 */
export function normalizeWeaponFamilyIdList(
  ids: readonly unknown[] | null | undefined,
): CanonicalWeaponFamilyId[] {
  const out: CanonicalWeaponFamilyId[] = [];
  const seen = new Set<CanonicalWeaponFamilyId>();
  (ids ?? []).forEach((raw) => {
    const id = normalizeWeaponFamilyId(raw);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}
