/**
 * Phase 3I live-boon synergy inventory — derived from catalogs + explicit overlays.
 * Does not invent new boon IDs.
 */
import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import type { WeaponAffinityTag } from '../../types/weaponIdentity';
import type { WeaponAbilityInteractionHook } from '../../types/weaponLoadoutRecommendation';
import type { LeyLineMutationId } from '../../types/leyLineMutation';
import type { EnvoyBoonId, HexShotBoonId } from '../../types/classBoon';
import { BOON_RULES } from '../boonEngine';
import { LEY_LINE_MUTATION_CATALOG } from '../leyLineMutations';
import { HEX_SHOT_BOON_CATALOG } from '../hexShotBoons';
import { ENVOY_BOON_CATALOG } from '../envoyBoons';
import type {
  BoonCategoryKind,
  BoonOfferPool,
  BoonSynergyClass,
} from './boonOfferTypes';

export type LiveBoonAuditEntry = {
  id: string;
  pool: BoonOfferPool;
  classId: ClassType;
  category: BoonCategoryKind;
  tier: string;
  baseOfferWeight: number;
  hardRequiredTags: readonly string[];
  preferredTags: readonly string[];
  preferredAffinityTags: readonly WeaponAffinityTag[];
  requiredHooks: readonly WeaponAbilityInteractionHook[];
  requiredAbilityIds: readonly string[];
  requiredPriorBoons: readonly string[];
  weaponFamilyExclusive: WeaponFamilyId | null;
  /** Explicit mechanical conflicts (soft penalty only). */
  mechanicalConflicts: readonly {
    weaponFamilyId?: WeaponFamilyId;
    reason: string;
  }[];
  engineFamily: string | null;
  stackable: boolean;
  runtimeImplemented: boolean;
  descriptionRuntimeConsistent: boolean;
  deprecatedDependency: string | null;
  classification: BoonSynergyClass;
  live: boolean;
};

const DEPRECATED_HEX_AMMO_ABILITY_IDS = [
  'WRAITH_PIERCER_ROUND',
  'BLOOD_TRACER_ROUND',
  'STASIS_LOCK_SLUG',
  'BLEEDING_PAYLOAD',
  'BRIMSTONE_PAYLOAD',
] as const;

function tierToCategory(tier: string): BoonCategoryKind {
  if (tier === 'TIER_1' || tier === 'COMMON') return 'COMMON';
  if (tier === 'TIER_2' || tier === 'RARE') return 'ENGINE';
  if (tier === 'TIER_3' || tier === 'OCCULT') return 'KEYSTONE';
  if (tier === 'TIER_4' || tier === 'SYNAPTIC') return 'CORRUPTED';
  return 'TIER_EQUIVALENT';
}

function inferEngineFamily(id: string, tags: readonly string[]): string | null {
  if (tags.includes('VOID_AMMO')) return 'VOID_AMMO';
  if (tags.includes('BALLISTIC')) return 'BALLISTIC';
  if (tags.includes('RELOAD')) return 'RELOAD';
  if (tags.includes('SPELL')) return 'SPELL';
  if (tags.includes('CURSE')) return 'CURSE';
  if (tags.includes('FRACTURE') || tags.includes('MELEE')) return 'MELEE_FRACTURE';
  if (tags.includes('DEFENSIVE')) return 'DEFENSIVE';
  if (id.includes('FLUX') || tags.includes('RESTORE')) return 'FLUX';
  return null;
}

function classifyFromTags(
  tags: readonly string[],
  hook: string,
  preferredAffinity: readonly WeaponAffinityTag[],
): BoonSynergyClass {
  if (hook === 'passive' && tags.length === 0) return 'GENERAL_FLEX';
  if (preferredAffinity.length > 0) return 'STRENGTH_AMPLIFICATION';
  if (tags.includes('RELOAD') || tags.includes('VOID_AMMO')) return 'CLASS_METER_SUPPORT';
  if (tags.length > 0) return 'LOADOUT_SUPPORT';
  return 'GENERAL_FLEX';
}

function affinityFromTags(tags: readonly string[]): WeaponAffinityTag[] {
  const out: WeaponAffinityTag[] = [];
  const map: Record<string, WeaponAffinityTag> = {
    FRACTURE: 'FRACTURE',
    RELOAD: 'RELOAD',
    BALLISTIC: 'BALLISTIC',
    AOE: 'AOE',
    CONTROL: 'CONTROL',
    CURSE: 'CURSE',
    MELEE: 'MELEE',
    OCCULT: 'OCCULT',
    SACRIFICE: 'SACRIFICE',
    TRAP: 'TRAP',
    ARMOR_PIERCE: 'ARMOR_PIERCE',
    EXECUTION: 'EXECUTION',
    FLUX: 'FLUX',
    RESERVE: 'RESERVE',
    PARRY: 'PARRY',
    EVADE: 'EVADE',
    HIGH_RISK: 'HIGH_RISK',
    CLEAN_CYCLE: 'CLEAN_CYCLE',
    INTERRUPT: 'INTERRUPT',
  };
  tags.forEach((t) => {
    const a = map[t];
    if (a && !out.includes(a)) out.push(a);
  });
  return out;
}

function hooksFromTags(classId: ClassType, tags: readonly string[]): WeaponAbilityInteractionHook[] {
  const hooks: WeaponAbilityInteractionHook[] = [];
  if (classId === 'AEGIS') {
    if (tags.includes('MELEE') || tags.includes('KINETIC')) hooks.push('WEAPON_BASIC', 'FRACTURE_SETUP');
    if (tags.includes('DEFENSIVE')) hooks.push('RESERVE_FLOW');
  }
  if (classId === 'HEX_SHOT') {
    if (tags.includes('BALLISTIC') || tags.includes('VOID_AMMO')) hooks.push('WEAPON_BASIC');
    if (tags.includes('RELOAD')) hooks.push('RELOAD_PROTOCOL', 'PROTOCOL_CHARGE');
    if (tags.includes('AOE')) hooks.push('SPREAD_CLUSTER');
  }
  if (classId === 'ENVOY') {
    if (tags.includes('SPELL')) hooks.push('WEAPON_BASIC', 'FLUX_CYCLE');
    if (tags.includes('CURSE') || tags.includes('DEBUFF')) hooks.push('ROT_SETUP');
    if (tags.includes('RESTORE')) hooks.push('FLUX_CYCLE');
  }
  return [...new Set(hooks)];
}

/** Explicit mechanical conflicts — advisory soft penalty only. */
const EXPLICIT_CONFLICTS: Record<string, LiveBoonAuditEntry['mechanicalConflicts']> = {
  EMERGENCY_VENT: [
    { weaponFamilyId: 'envoy-sanguine-prism', reason: 'Vents Flux away from Brink window' },
  ],
  ETHEREAL_MAGAZINES: [
    {
      weaponFamilyId: 'hex-silver-core-sidearm',
      reason: 'Reduces reload cadence that feeds Protocol Charge',
    },
  ],
  EXTENDED_MAGS: [
    {
      weaponFamilyId: 'hex-silver-core-sidearm',
      reason: 'Larger mag softens Perfect Reload frequency',
    },
  ],
};

/** Weapon-family exclusive keystones (hard). Empty by default — reserved for true exclusives. */
const WEAPON_EXCLUSIVE: Partial<Record<string, WeaponFamilyId>> = {};

/** Required ability for ability-specific boons (rare). */
const REQUIRED_ABILITIES: Partial<Record<string, readonly string[]>> = {
  // ASH_SALVO path — no dedicated boon ID yet; reserved
};

function buildAegisEntries(): LiveBoonAuditEntry[] {
  return (Object.keys(LEY_LINE_MUTATION_CATALOG) as LeyLineMutationId[]).map((id) => {
    const def = LEY_LINE_MUTATION_CATALOG[id];
    const rule = BOON_RULES[id];
    const tags = [...(rule?.tagAll ?? []), ...(rule?.tagAny ?? [])];
    const preferredAffinity = affinityFromTags(tags);
    const conflicts = EXPLICIT_CONFLICTS[id] ?? [];
    return {
      id,
      pool: 'AEGIS',
      classId: 'AEGIS',
      category: tierToCategory(def.tier),
      tier: def.tier,
      baseOfferWeight: 1,
      hardRequiredTags: rule?.hook === 'passive' || rule?.hook === 'onEncounterStart' ? [] : tags,
      preferredTags: tags,
      preferredAffinityTags: preferredAffinity,
      requiredHooks: hooksFromTags('AEGIS', tags),
      requiredAbilityIds: REQUIRED_ABILITIES[id] ?? [],
      requiredPriorBoons: [],
      weaponFamilyExclusive: WEAPON_EXCLUSIVE[id] ?? null,
      mechanicalConflicts: conflicts,
      engineFamily: inferEngineFamily(id, tags),
      stackable: false,
      runtimeImplemented: Boolean(rule),
      descriptionRuntimeConsistent: Boolean(rule),
      deprecatedDependency: null,
      classification: conflicts.length
        ? 'EXPLICIT_CONFLICT'
        : classifyFromTags(tags, rule?.hook ?? 'passive', preferredAffinity),
      live: true,
    };
  });
}

function buildHexEntries(): LiveBoonAuditEntry[] {
  return (Object.keys(HEX_SHOT_BOON_CATALOG) as HexShotBoonId[]).map((id) => {
    const def = HEX_SHOT_BOON_CATALOG[id];
    const tags = [...(def.tagAll ?? []), ...(def.tagAny ?? [])];
    const preferredAffinity = affinityFromTags(tags);
    const conflicts = EXPLICIT_CONFLICTS[id] ?? [];
    const desc = `${def.description} ${def.effect}`;
    const legacy =
      DEPRECATED_HEX_AMMO_ABILITY_IDS.find((d) => desc.includes(d)) ?? null;
    return {
      id,
      pool: 'HEX_SHOT',
      classId: 'HEX_SHOT',
      category: tierToCategory(def.tier),
      tier: def.tier,
      baseOfferWeight: 1,
      hardRequiredTags: def.hook === 'passive' || def.hook === 'onEncounterStart' ? [] : tags,
      preferredTags: tags,
      preferredAffinityTags: preferredAffinity,
      requiredHooks: hooksFromTags('HEX_SHOT', tags),
      requiredAbilityIds: REQUIRED_ABILITIES[id] ?? [],
      requiredPriorBoons: [],
      weaponFamilyExclusive: WEAPON_EXCLUSIVE[id] ?? null,
      mechanicalConflicts: conflicts,
      engineFamily: inferEngineFamily(id, tags),
      stackable: false,
      runtimeImplemented: true,
      descriptionRuntimeConsistent: !legacy,
      deprecatedDependency: legacy,
      classification: legacy
        ? 'UNSUPPORTED_OBSOLETE'
        : conflicts.length
          ? 'EXPLICIT_CONFLICT'
          : classifyFromTags(tags, def.hook, preferredAffinity),
      live: !legacy,
    };
  });
}

function buildEnvoyEntries(): LiveBoonAuditEntry[] {
  return (Object.keys(ENVOY_BOON_CATALOG) as EnvoyBoonId[]).map((id) => {
    const def = ENVOY_BOON_CATALOG[id];
    const tags = [...(def.tagAll ?? []), ...(def.tagAny ?? [])];
    const preferredAffinity = affinityFromTags(tags);
    const conflicts = EXPLICIT_CONFLICTS[id] ?? [];
    return {
      id,
      pool: 'ENVOY',
      classId: 'ENVOY',
      category: tierToCategory(def.tier),
      tier: def.tier,
      baseOfferWeight: 1,
      hardRequiredTags: def.hook === 'passive' || def.hook === 'onEncounterStart' ? [] : tags,
      preferredTags: tags,
      preferredAffinityTags: preferredAffinity,
      requiredHooks: hooksFromTags('ENVOY', tags),
      requiredAbilityIds: REQUIRED_ABILITIES[id] ?? [],
      requiredPriorBoons: [],
      weaponFamilyExclusive: WEAPON_EXCLUSIVE[id] ?? null,
      mechanicalConflicts: conflicts,
      engineFamily: inferEngineFamily(id, tags),
      stackable: false,
      runtimeImplemented: true,
      descriptionRuntimeConsistent: true,
      deprecatedDependency: null,
      classification: conflicts.length
        ? 'EXPLICIT_CONFLICT'
        : classifyFromTags(tags, def.hook, preferredAffinity),
      live: true,
    };
  });
}

let _cache: LiveBoonAuditEntry[] | null = null;

export function listLiveBoonAuditEntries(): LiveBoonAuditEntry[] {
  if (!_cache) {
    _cache = [...buildAegisEntries(), ...buildHexEntries(), ...buildEnvoyEntries()];
  }
  return _cache;
}

export function getLiveBoonAuditEntry(id: string): LiveBoonAuditEntry | undefined {
  return listLiveBoonAuditEntries().find((e) => e.id === id);
}

export function listLiveBoonsForClass(classId: ClassType): LiveBoonAuditEntry[] {
  return listLiveBoonAuditEntries().filter((e) => e.classId === classId && e.live);
}

export { DEPRECATED_HEX_AMMO_ABILITY_IDS };
