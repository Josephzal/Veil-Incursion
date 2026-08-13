/**
 * Phase D — discriminated Aegis graft target identity.
 * Encoded keys: WA:<weaponActionId> | TECH:<techniqueId>
 */
import type {
  AegisTechniqueId,
  AegisTechniqueLoadout,
  AegisWeaponActionId,
} from '../types/aegisCombat';
import { isAegisTechniqueId } from './aegisTechniqueCatalog';
import {
  deriveAegisWeaponActions,
  isAegisWeaponFamilyId,
  type AegisWeaponFamilyId,
} from './aegisWeaponActionRegistry';
import { isAegisWeaponActionCatalogId } from './aegisWeaponActionCatalog';
import type { WeaponFamilyId } from '../types/weapon';
import type { VeilGraftId } from '../types/veilGraft';

export type AegisGraftTargetKind = 'WEAPON_ACTION' | 'TECHNIQUE';

export type AegisGraftTarget =
  | { kind: 'WEAPON_ACTION'; actionId: AegisWeaponActionId }
  | { kind: 'TECHNIQUE'; techniqueId: AegisTechniqueId };

/** Stable serialization key for ActiveIncursion.abilityGrafts. */
export type AegisGraftTargetKey = `WA:${AegisWeaponActionId}` | `TECH:${AegisTechniqueId}`;

export type AegisAbilityGraftMap = Partial<Record<string, VeilGraftId>>;

const LEGACY_DROP_IDS = new Set([
  'STRIKE',
  'EVISCERATE',
  'THREEFOLD_BRAND',
  'WRAITH_PARRY',
  'ABYSSAL_VERDICT',
  'REND_THE_VEIL',
  'GRAVEFALL',
  'BLOOD_TITHE',
  'ABYSSAL_FAULT',
  'BLOOD_BOUND_CARAPACE',
]);

const AEGIS_FIXED_BASIC_STRIKES = new Set<AegisWeaponActionId>([
  'WARDENS_STRIKE',
  'PAIRED_BLADES_STRIKE',
  'UNMAKER_STRIKE',
]);

export function encodeAegisGraftTargetKey(target: AegisGraftTarget): AegisGraftTargetKey {
  return target.kind === 'WEAPON_ACTION'
    ? `WA:${target.actionId}`
    : `TECH:${target.techniqueId}`;
}

export function parseAegisGraftTargetKey(key: string): AegisGraftTarget | null {
  if (key.startsWith('WA:')) {
    const actionId = key.slice(3);
    if (isAegisWeaponActionCatalogId(actionId)) {
      return { kind: 'WEAPON_ACTION', actionId };
    }
    return null;
  }
  if (key.startsWith('TECH:')) {
    const techniqueId = key.slice(5);
    if (isAegisTechniqueId(techniqueId)) {
      return { kind: 'TECHNIQUE', techniqueId };
    }
    return null;
  }
  return null;
}

/** Migrate bare technique IDs; never redirect legacy aliases. */
export function coerceLegacyAegisGraftKey(key: string): AegisGraftTargetKey | null {
  const parsed = parseAegisGraftTargetKey(key);
  if (parsed) return encodeAegisGraftTargetKey(parsed);
  if (LEGACY_DROP_IDS.has(key)) return null;
  if (isAegisTechniqueId(key)) {
    return encodeAegisGraftTargetKey({ kind: 'TECHNIQUE', techniqueId: key });
  }
  if (isAegisWeaponActionCatalogId(key)) {
    return encodeAegisGraftTargetKey({ kind: 'WEAPON_ACTION', actionId: key });
  }
  return null;
}

export function isAegisFixedBasicStrike(actionId: string): boolean {
  return AEGIS_FIXED_BASIC_STRIKES.has(actionId as AegisWeaponActionId);
}

export function isAegisGraftableUltimateId(id: string): boolean {
  return id === 'ABYSSAL_VERDICT'
    || id === 'REND_THE_VEIL'
    || id === 'GRAVEFALL'
    || id === 'EVISCERATE'
    || id === 'WRAITH_PARRY'
    || id === 'THREEFOLD_BRAND';
}

export interface AegisGraftSurfaceRow {
  key: AegisGraftTargetKey;
  target: AegisGraftTarget;
  actionId: string;
  group: 'WEAPON_ACTION' | 'TECHNIQUE';
  isFixedBasic: boolean;
}

/** Sanctuary / combat graft surface: 4 family actions + 3 snapshotted techniques. */
export function buildAegisGraftSurface(args: {
  weaponFamilyId: WeaponFamilyId | AegisWeaponFamilyId | null | undefined;
  techniques: AegisTechniqueLoadout | readonly string[] | null | undefined;
}): readonly AegisGraftSurfaceRow[] {
  const familyId = (args.weaponFamilyId ?? 'aegis-longsword') as AegisWeaponFamilyId;
  const actions = deriveAegisWeaponActions(
    isAegisWeaponFamilyId(familyId) ? familyId : 'aegis-longsword',
  ) ?? deriveAegisWeaponActions('aegis-longsword')!;
  // Only the run's snapshotted techniques — never pad from account/catalog pool.
  const techs = (args.techniques ?? []).filter(isAegisTechniqueId).slice(0, 3) as AegisTechniqueId[];

  const rows: AegisGraftSurfaceRow[] = [];
  for (const actionId of actions) {
    const target: AegisGraftTarget = { kind: 'WEAPON_ACTION', actionId };
    rows.push({
      key: encodeAegisGraftTargetKey(target),
      target,
      actionId,
      group: 'WEAPON_ACTION',
      isFixedBasic: isAegisFixedBasicStrike(actionId),
    });
  }
  for (const techniqueId of techs) {
    const target: AegisGraftTarget = { kind: 'TECHNIQUE', techniqueId };
    rows.push({
      key: encodeAegisGraftTargetKey(target),
      target,
      actionId: techniqueId,
      group: 'TECHNIQUE',
      isFixedBasic: false,
    });
  }
  return rows;
}

export function familyOwnsWeaponAction(
  weaponFamilyId: WeaponFamilyId | AegisWeaponFamilyId | null | undefined,
  actionId: AegisWeaponActionId,
): boolean {
  const actions = deriveAegisWeaponActions(weaponFamilyId);
  return !!actions?.includes(actionId);
}

/**
 * Drop unknown / other-family / legacy / Parry / Ultimate keys.
 * Never redirects a stale assignment to another action.
 */
export function sanitizeAegisAbilityGraftMap(
  map: Readonly<Record<string, string>> | null | undefined,
  args: {
    weaponFamilyId: WeaponFamilyId | AegisWeaponFamilyId | null | undefined;
    techniques: AegisTechniqueLoadout | readonly string[] | null | undefined;
  },
): AegisAbilityGraftMap {
  const enforceSurface = args.techniques != null;
  const allowed = enforceSurface
    ? new Set(buildAegisGraftSurface(args).map((row) => row.key))
    : null;
  const next: AegisAbilityGraftMap = {};
  const usedGrafts = new Set<string>();
  if (!map) return next;
  for (const [rawKey, graftId] of Object.entries(map)) {
    if (!graftId || typeof graftId !== 'string') continue;
    const key = coerceLegacyAegisGraftKey(rawKey);
    if (!key) continue;
    if (allowed && !allowed.has(key)) continue;
    // Other-family weapon actions: drop when family is known.
    if (key.startsWith('WA:') && args.weaponFamilyId) {
      const actionId = key.slice(3) as AegisWeaponActionId;
      if (!familyOwnsWeaponAction(args.weaponFamilyId, actionId)) continue;
    }
    if (usedGrafts.has(graftId)) continue;
    usedGrafts.add(graftId);
    next[key] = graftId as VeilGraftId;
  }
  return next;
}

export function lookupAegisGraft(
  map: AegisAbilityGraftMap | null | undefined,
  target: AegisGraftTarget,
): VeilGraftId | undefined {
  if (!map) return undefined;
  return map[encodeAegisGraftTargetKey(target)];
}

export function lookupWeaponActionGraft(
  map: AegisAbilityGraftMap | null | undefined,
  actionId: AegisWeaponActionId,
): VeilGraftId | undefined {
  return lookupAegisGraft(map, { kind: 'WEAPON_ACTION', actionId });
}

export function lookupTechniqueGraft(
  map: AegisAbilityGraftMap | null | undefined,
  techniqueId: AegisTechniqueId,
): VeilGraftId | undefined {
  return lookupAegisGraft(map, { kind: 'TECHNIQUE', techniqueId });
}

/**
 * Resolve graft for a bare combat ability/action id (weapon action or technique).
 * Prefers encoded keys; falls back to legacy bare keys during hydration windows.
 */
export function resolveAegisAbilityGraftId(
  map: AegisAbilityGraftMap | null | undefined,
  abilityId: string,
): VeilGraftId | undefined {
  if (!map) return undefined;
  if (isAegisWeaponActionCatalogId(abilityId)) {
    return lookupWeaponActionGraft(map, abilityId) ?? (map[abilityId] as VeilGraftId | undefined);
  }
  if (isAegisTechniqueId(abilityId)) {
    return lookupTechniqueGraft(map, abilityId) ?? (map[abilityId] as VeilGraftId | undefined);
  }
  const coerced = coerceLegacyAegisGraftKey(abilityId);
  if (coerced) return map[coerced];
  return map[abilityId] as VeilGraftId | undefined;
}

/** Normalize an incoming Sanctuary ability key to encoded form, or null if invalid. */
export function normalizeAegisGraftAssignmentKey(
  rawAbilityId: string,
  args: {
    weaponFamilyId: WeaponFamilyId | AegisWeaponFamilyId | null | undefined;
    techniques: AegisTechniqueLoadout | readonly string[] | null | undefined;
  },
): AegisGraftTargetKey | null {
  const key = coerceLegacyAegisGraftKey(rawAbilityId);
  if (!key) return null;
  // When a snapshotted technique list is provided, enforce the 4+3 surface.
  // When omitted (null/undefined), accept any coerced canonical key (unit helpers).
  if (args.techniques == null) return key;
  const surface = buildAegisGraftSurface(args);
  return surface.some((row) => row.key === key) ? key : null;
}
