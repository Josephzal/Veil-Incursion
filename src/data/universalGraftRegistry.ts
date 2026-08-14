import type { ClassType } from '../types/game';
import type {
  UniversalCastPlanOverlay,
  UniversalGraftDefinition,
  UniversalGraftId,
  UniversalGraftSource,
  UniversalUpgradeAxis,
} from '../types/universalGraft';
import { AEGIS_WEAPON_ACTION_CATALOG } from './aegisWeaponActionCatalog';
import { AEGIS_TECHNIQUE_CATALOG } from './aegisTechniqueCatalog';
import {
  HEX_BLACK_DOOR_CATALOG,
  HEX_CARBINE_CATALOG,
  HEX_REVOLVER_CATALOG,
} from './hexWeaponActionCatalog';
import { listEnvoyWeaponActionDefinitions } from './envoyWeaponActionCatalog';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { ENVOY_ABILITY_CATALOG } from './envoyAbilities';

export const CANONICAL_HEX_FLEX_GRAFT_ACTIONS = [
  'ASH_JACKET_SALVO',
  'SINGULARITY_SLUG',
  'PANOPTICON_PROTOCOL',
  'REVENANTS_ECHO',
  'RIFT_SNARE',
  'PHOSPHORUS_HEX',
  'NULL_SPACE_CLOAK',
  'GHOST_GRID_CAMO',
  'ASTRAL_TARGET_LOCK',
  'CINDERLINE_SATURATION',
  'BLACKSITE_TRIAGE',
] as const;

export const CANONICAL_ENVOY_FLEX_GRAFT_ACTIONS = [
  'ASTRAL_LANCE',
  'NECROTIC_BLOOM',
  'FLUX_PURGE',
  'DIMENSIONAL_SHEAR',
  'PHASE_STEP',
  'AETHERIC_TRANSFUSION',
  'SOUL_TETHER',
  'ENTROPY_HEX',
  'FLESH_WARP',
  'PARALYTIC_MIASMA',
  'MIND_SUNDER',
] as const;

const DIRECT_DAMAGE = {
  upgradeAxis: 'DIRECT_DAMAGE' as const,
  baseValue: 100,
  upgradedValue: 110,
  previewCopy: 'Direct damage packets deal about 10% more damage (round nearest, minimum +1).',
};

type AxisSpec = Pick<
  UniversalGraftDefinition,
  'upgradeAxis' | 'baseValue' | 'upgradedValue' | 'previewCopy' | 'specializedExecution'
>;

const HEX_UTILITY: Partial<Record<(typeof CANONICAL_HEX_FLEX_GRAFT_ACTIONS)[number], AxisSpec>> = {
  PHOSPHORUS_HEX: {
    upgradeAxis: 'ACCURACY_PENALTY',
    baseValue: 50,
    upgradedValue: 65,
    previewCopy: 'Accuracy penalty increases from 50 to 65 points.',
  },
  NULL_SPACE_CLOAK: {
    upgradeAxis: 'STAMINA_COST',
    baseValue: 40,
    upgradedValue: 39,
    previewCopy: 'Stamina cost decreases from 40 to 39.',
  },
  GHOST_GRID_CAMO: {
    upgradeAxis: 'DURATION_TURNS',
    baseValue: 1,
    upgradedValue: 2,
    previewCopy: 'Untargetable duration increases from 1 to 2 turns.',
  },
  ASTRAL_TARGET_LOCK: {
    upgradeAxis: 'STAMINA_COST',
    baseValue: 25,
    upgradedValue: 24,
    previewCopy: 'Stamina cost decreases from 25 to 24.',
  },
  CINDERLINE_SATURATION: {
    upgradeAxis: 'HAZARD_TICK_DAMAGE',
    baseValue: 5,
    upgradedValue: 6,
    previewCopy: 'Hazard tick damage increases from 5 to 6.',
  },
  BLACKSITE_TRIAGE: {
    upgradeAxis: 'HEAL_PERCENT',
    baseValue: 20,
    upgradedValue: 22,
    previewCopy: 'Healing increases from 20% to 22% max HP.',
  },
};

const ENVOY_UTILITY: Partial<Record<(typeof CANONICAL_ENVOY_FLEX_GRAFT_ACTIONS)[number], AxisSpec>> = {
  PHASE_STEP: {
    upgradeAxis: 'FLUX_COST',
    baseValue: 15,
    upgradedValue: 14,
    previewCopy: 'Veil-Flux cost decreases from 15% to 14%.',
  },
  AETHERIC_TRANSFUSION: {
    upgradeAxis: 'HEAL_PERCENT',
    baseValue: 25,
    upgradedValue: 28,
    previewCopy: 'Healing increases from 25% to 28% max HP.',
  },
  SOUL_TETHER: {
    upgradeAxis: 'REFLECT_PERCENT',
    baseValue: 50,
    upgradedValue: 55,
    previewCopy: 'Reflected damage increases from 50% to 55%.',
  },
  FLESH_WARP: {
    upgradeAxis: 'MAX_HP_REDUCTION',
    baseValue: 15,
    upgradedValue: 17,
    previewCopy: 'Maximum-HP reduction increases from 15% to 17%.',
  },
  PARALYTIC_MIASMA: {
    upgradeAxis: 'FLUX_COST',
    baseValue: 15,
    upgradedValue: 14,
    previewCopy: 'Veil-Flux cost decreases from 15% to 14%.',
  },
};

const AEGIS_TECHNIQUE_AXES: Record<keyof typeof AEGIS_TECHNIQUE_CATALOG, AxisSpec> = {
  RUIN: DIRECT_DAMAGE,
  VEIL_PIERCER: DIRECT_DAMAGE,
  DEVASTATE: DIRECT_DAMAGE,
  SHADOW_STEP: DIRECT_DAMAGE,
  REAVE: DIRECT_DAMAGE,
  FINAL_MERCY: {
    upgradeAxis: 'HEAL_PERCENT',
    baseValue: 10,
    upgradedValue: 11,
    previewCopy: 'Execution healing increases from 10% to 11% max HP.',
  },
  GRAVE_BIND: {
    upgradeAxis: 'EXPOSED_DEFENSE_REDUCTION',
    baseValue: 50,
    upgradedValue: 55,
    previewCopy: 'Existing Exposed defense reduction increases from 50% to 55%.',
    specializedExecution: true,
  },
  NAIL_TO_GRID: {
    upgradeAxis: 'AP_DRAIN',
    baseValue: 1,
    upgradedValue: 2,
    previewCopy: 'Enemy AP drain increases from 1 to 2.',
  },
  ASHEN_MANTLE: {
    upgradeAxis: 'DURATION_TURNS',
    baseValue: 1,
    upgradedValue: 2,
    previewCopy: 'Mantle duration increases from 1 to 2 enemy phases.',
  },
  RUNEBOUND_CARAPACE: {
    upgradeAxis: 'REFLECT_DAMAGE',
    baseValue: 12,
    upgradedValue: 13,
    previewCopy: 'Reflected True damage increases from 12 to 13.',
  },
  DEMONS_LUNG: {
    upgradeAxis: 'RESERVE_GAIN',
    baseValue: 30,
    upgradedValue: 33,
    previewCopy: 'Abyssal Reserve gain increases from 30% to 33%.',
  },
  CRIMSON_PACT: {
    upgradeAxis: 'HP_COST_PERCENT',
    baseValue: 12,
    upgradedValue: 11,
    previewCopy: 'HP cost decreases from 12% to 11%.',
  },
};

function cleanLabel(label: string): string {
  return label.replace(/^\[\s*/, '').replace(/\s*\]$/, '').trim();
}

function stableId(classId: ClassType, actionId: string): UniversalGraftId {
  return `graft_${classId.toLowerCase()}_${actionId.toLowerCase()}` as UniversalGraftId;
}

function definition(
  classId: ClassType,
  canonicalActionId: string,
  source: UniversalGraftSource,
  label: string,
  axis: AxisSpec,
): UniversalGraftDefinition {
  const actionDisplayLabel = cleanLabel(label);
  return Object.freeze({
    id: stableId(classId, canonicalActionId),
    classId,
    canonicalActionId,
    source,
    ...axis,
    actionDisplayLabel,
    name: `${actionDisplayLabel}+`,
    description: axis.previewCopy,
    cost: 0,
    accentColor: '#c4b5fd',
  });
}

const aegisWeaponDefinitions = Object.values(AEGIS_WEAPON_ACTION_CATALOG).map((action) =>
  definition('AEGIS', action.id, 'AEGIS_WEAPON_ACTION', action.label, DIRECT_DAMAGE));

const hexWeaponCatalog = {
  ...HEX_REVOLVER_CATALOG,
  ...HEX_CARBINE_CATALOG,
  ...HEX_BLACK_DOOR_CATALOG,
};
const hexWeaponDefinitions = Object.values(hexWeaponCatalog).map((action) =>
  definition('HEX_SHOT', action.id, 'HEX_WEAPON_ACTION', action.label, DIRECT_DAMAGE));

const envoyWeaponDefinitions = listEnvoyWeaponActionDefinitions().map((action) =>
  definition(
    'ENVOY',
    action.id,
    'ENVOY_WEAPON_ACTION',
    action.label,
    action.id === 'CRIMSON_VENT'
      ? {
        upgradeAxis: 'RESOURCE_GAIN',
        baseValue: 15,
        upgradedValue: 17,
        previewCopy: 'Veil-Flux gain increases from 15% to 17%.',
      }
      : DIRECT_DAMAGE,
  ));

const techniqueDefinitions = Object.values(AEGIS_TECHNIQUE_CATALOG).map((technique) =>
  definition(
    'AEGIS',
    technique.id,
    'AEGIS_TECHNIQUE',
    technique.label,
    AEGIS_TECHNIQUE_AXES[technique.id],
  ));

const hexFlexDefinitions = CANONICAL_HEX_FLEX_GRAFT_ACTIONS.map((actionId) => {
  const action = HEX_SHOT_ABILITY_CATALOG[actionId];
  return definition(
    'HEX_SHOT',
    actionId,
    'HEX_FLEX',
    action.label,
    HEX_UTILITY[actionId] ?? DIRECT_DAMAGE,
  );
});

const envoyFlexDefinitions = CANONICAL_ENVOY_FLEX_GRAFT_ACTIONS.map((actionId) => {
  const action = ENVOY_ABILITY_CATALOG[actionId];
  return definition(
    'ENVOY',
    actionId,
    'ENVOY_FLEX',
    action.label,
    ENVOY_UTILITY[actionId] ?? DIRECT_DAMAGE,
  );
});

export const UNIVERSAL_GRAFT_DEFINITIONS: readonly UniversalGraftDefinition[] = Object.freeze([
  ...aegisWeaponDefinitions,
  ...hexWeaponDefinitions,
  ...envoyWeaponDefinitions,
  ...techniqueDefinitions,
  ...hexFlexDefinitions,
  ...envoyFlexDefinitions,
]);

export const UNIVERSAL_GRAFT_REGISTRY: Readonly<Record<string, UniversalGraftDefinition>> =
  Object.freeze(Object.fromEntries(UNIVERSAL_GRAFT_DEFINITIONS.map((entry) => [entry.id, entry])));

const BY_CLASS_ACTION = new Map<string, UniversalGraftDefinition>(
  UNIVERSAL_GRAFT_DEFINITIONS.map((entry) => [`${entry.classId}:${entry.canonicalActionId}`, entry]),
);

export function getUniversalGraftDefinition(id: unknown): UniversalGraftDefinition | null {
  return typeof id === 'string' ? UNIVERSAL_GRAFT_REGISTRY[id] ?? null : null;
}

export function getUniversalGraftForAction(
  classId: ClassType,
  canonicalActionId: string,
): UniversalGraftDefinition | null {
  return BY_CLASS_ACTION.get(`${classId}:${canonicalActionId}`) ?? null;
}

export function listUniversalGraftsForClass(classId: ClassType): UniversalGraftDefinition[] {
  return UNIVERSAL_GRAFT_DEFINITIONS.filter((entry) => entry.classId === classId);
}

export interface UniversalGraftCardData {
  id: UniversalGraftId;
  actionName: string;
  currentValue: number;
  upgradedValue: number;
  improvedProperty: string;
  canonicalActionId: string;
}

/** Player-facing Sanctuary card data, sourced only from canonical action identity. */
export function getUniversalGraftCardData(
  classId: ClassType,
  graftId: unknown,
): UniversalGraftCardData | null {
  const graft = getUniversalGraftDefinition(graftId);
  if (!graft || graft.classId !== classId) return null;
  return {
    id: graft.id,
    actionName: graft.name,
    currentValue: graft.baseValue,
    upgradedValue: graft.upgradedValue,
    improvedProperty: graft.previewCopy,
    canonicalActionId: graft.canonicalActionId,
  };
}

export function normalizeUniversalGraftId(input: unknown): UniversalGraftId | null {
  return getUniversalGraftDefinition(input)?.id ?? null;
}

function normalizeClassGraftMap(
  classId: ClassType,
  input: unknown,
  requireEncodedAegisKey: boolean,
): Record<string, UniversalGraftId> | null {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return null;
  const normalized: Record<string, UniversalGraftId> = {};
  for (const [targetKey, rawGraftId] of Object.entries(input as Record<string, unknown>)) {
    if (
      requireEncodedAegisKey
      && !targetKey.startsWith('WA:')
      && !targetKey.startsWith('TECH:')
    ) continue;
    const graftId = normalizeUniversalGraftId(rawGraftId);
    if (!graftId || !universalGraftMatchesTarget(classId, targetKey, graftId)) continue;
    normalized[targetKey] = graftId;
  }
  return normalized;
}

export function normalizeHexShotGraftMap(input: unknown): Record<string, UniversalGraftId> | null {
  return normalizeClassGraftMap('HEX_SHOT', input, false);
}

export function normalizeEnvoyGraftMap(input: unknown): Record<string, UniversalGraftId> | null {
  return normalizeClassGraftMap('ENVOY', input, false);
}

export function normalizeAegisGraftMap(input: unknown): Record<string, UniversalGraftId> | null {
  return normalizeClassGraftMap('AEGIS', input, true);
}

export function normalizeUniversalGraftOffers(
  classId: ClassType,
  input: unknown,
): UniversalGraftId[] | null {
  if (!Array.isArray(input)) return null;
  return [...new Set(input
    .map(normalizeUniversalGraftId)
    .filter((id): id is UniversalGraftId =>
      id != null && getUniversalGraftDefinition(id)?.classId === classId))];
}

export function universalGraftMatchesTarget(
  classId: ClassType,
  targetKeyOrActionId: string,
  graftId: unknown,
): boolean {
  const graft = getUniversalGraftDefinition(graftId);
  if (!graft || graft.classId !== classId) return false;
  const canonicalActionId = targetKeyOrActionId.startsWith('WA:')
    ? targetKeyOrActionId.slice(3)
    : targetKeyOrActionId.startsWith('TECH:')
      ? targetKeyOrActionId.slice(5)
      : targetKeyOrActionId;
  return graft.canonicalActionId === canonicalActionId;
}

export function readUniversalAxisValue(
  overlay: Pick<UniversalCastPlanOverlay, 'currentAxisValue' | 'upgradedAxisValue'>,
  upgraded = true,
): number | null {
  return upgraded ? overlay.upgradedAxisValue : overlay.currentAxisValue;
}

/**
 * Read an upgraded overlay value only for its declared axis. Canonical callers
 * pass their authored value as the fallback, so an absent/replaced graft cannot
 * leak a previous cast's override.
 */
export function readUniversalUpgradeValue(
  overlay: Pick<UniversalCastPlanOverlay, 'upgradeAxis' | 'upgradedAxisValue'> | null | undefined,
  axis: UniversalUpgradeAxis,
  canonicalFallback: number,
): number {
  return overlay?.upgradeAxis === axis && overlay.upgradedAxisValue != null
    ? overlay.upgradedAxisValue
    : canonicalFallback;
}

export function upgradeDamagePacketValue(
  baseDamage: number,
  currentPercent = DIRECT_DAMAGE.baseValue,
  upgradedPercent = DIRECT_DAMAGE.upgradedValue,
): number {
  if (baseDamage <= 0 || currentPercent <= 0 || upgradedPercent <= currentPercent) return baseDamage;
  return baseDamage + Math.max(1, Math.round(baseDamage * upgradedPercent / currentPercent) - baseDamage);
}

export interface UniversalDamagePacket {
  damage: number;
  appliedGraftIds?: readonly UniversalGraftId[];
}

/** Pure overlay helper; carrying the marker makes repeated application idempotent. */
export function applyUniversalDamagePacketUpgrade(
  packet: UniversalDamagePacket,
  graft: UniversalGraftDefinition | null | undefined,
): UniversalDamagePacket {
  if (!graft || graft.upgradeAxis !== 'DIRECT_DAMAGE') return { ...packet };
  if (packet.appliedGraftIds?.includes(graft.id)) return { ...packet };
  return {
    ...packet,
    damage: upgradeDamagePacketValue(packet.damage, graft.baseValue, graft.upgradedValue),
    appliedGraftIds: [...(packet.appliedGraftIds ?? []), graft.id],
  };
}

export function validateUniversalGraftRegistry(): string[] {
  const issues: string[] = [];
  if (UNIVERSAL_GRAFT_DEFINITIONS.length !== 70) {
    issues.push(`expected 70 definitions, got ${UNIVERSAL_GRAFT_DEFINITIONS.length}`);
  }
  const expectedSources: Record<UniversalGraftSource, number> = {
    AEGIS_WEAPON_ACTION: 12,
    HEX_WEAPON_ACTION: 12,
    ENVOY_WEAPON_ACTION: 12,
    AEGIS_TECHNIQUE: 12,
    HEX_FLEX: 11,
    ENVOY_FLEX: 11,
  };
  for (const [source, expected] of Object.entries(expectedSources)) {
    const actual = UNIVERSAL_GRAFT_DEFINITIONS.filter((entry) => entry.source === source).length;
    if (actual !== expected) issues.push(`${source}: expected ${expected}, got ${actual}`);
  }
  const ids = new Set<string>();
  const actions = new Set<string>();
  for (const entry of UNIVERSAL_GRAFT_DEFINITIONS) {
    const expectedId = stableId(entry.classId, entry.canonicalActionId);
    if (entry.id !== expectedId) issues.push(`${entry.id}: unstable id (expected ${expectedId})`);
    if (!entry.id.startsWith('graft_') || /[A-Z]/.test(entry.id)) {
      issues.push(`${entry.id}: legacy or malformed id`);
    }
    if (ids.has(entry.id)) issues.push(`${entry.id}: duplicate id`);
    ids.add(entry.id);
    const actionKey = `${entry.classId}:${entry.canonicalActionId}`;
    if (actions.has(actionKey)) issues.push(`${actionKey}: duplicate canonical action`);
    actions.add(actionKey);
    if (!entry.upgradeAxis) issues.push(`${entry.id}: missing upgrade axis`);
    if (entry.upgradedValue === entry.baseValue) issues.push(`${entry.id}: unchanged upgrade value`);
  }
  return issues;
}

export function assertUniversalGraftRegistry(): void {
  const issues = validateUniversalGraftRegistry();
  if (issues.length > 0) throw new Error(`[Stage V-B graft registry]\n${issues.join('\n')}`);
}

assertUniversalGraftRegistry();

export type { UniversalUpgradeAxis };
