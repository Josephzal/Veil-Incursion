import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth } from './districtPacing';
import type { EnemyRosterId } from './enemyRoster';
import { resolveDefinitionStats } from './enemyDefinitions';

export type EncounterEnemyKey =
  | 'FRACTURE_HOUND'
  | 'ECHOING_BRUTE'
  | 'LEY_SIREN'
  | 'ASH_WEEPER'
  | 'MIASMA_SWARM'
  | 'NULL_SHADE'
  | 'SPATIAL_GLITCH'
  | 'GUTTER_GOLIATH'
  | 'CONCRETE_GARGOYLE'
  | 'RIOT_VANGUARD'
  | 'SPALL'
  | 'SCUTTLER'
  | 'THRALL'
  | 'HOOK_WEAVER'
  | 'MEMORY_LEECH'
  | 'SMOG_CALLER'
  | 'IRON_MAIDEN'
  | 'GOLEM'
  | 'SLAG_BLOOD'
  | 'SAPPER'
  | 'COIL_SPIKE_SNIPER'
  | 'RESONANCE_CASTER'
  | 'TAR_SPITTER'
  | 'CHURN'
  | 'SPLINTER'
  | 'BREACHER'
  | 'CUTTER'
  | 'WARDEN'
  | 'FIXER'
  | 'SPOTTER'
  | 'BURNER'
  | 'RIVAL_HEXER'
  | 'RIVAL_VEILBINDER'
  | 'RIVAL_REAVER'
  | 'AMALGAM'
  | 'WIRE_GHOUL'
  | 'HOLLOW_LUNG'
  | 'GRAVE_ROBBER'
  | 'WEEPING_GARGOYLE'
  | 'PHASE_SCUTTLER'
  | 'REMEMBERING_THRALL'
  | 'TAR_CHOIR'
  | 'STATIC_CALLER'
  | 'BLOOD_RUSTED_GOLEM'
  | 'ROOTBOUND_WEEPER'
  | 'ANCHOR_HUSK'
  | 'CORE_SICK_AMALGAM'
  | 'VOID_LOCK_MEMORY_LEECH'
  | 'GRAVE_ENGINE_CHURN'
  | 'NULL_CROWN_SHADE'
  | 'CHOIR_BOUND_RESONANCE_CASTER'
  | 'RIFT_SPIKE_SNIPER';

export type EnemySpawnArchetype = 'MELEE' | 'SUPPORT' | 'RANGED' | 'HEAVY' | 'ARTILLERY';

export const ENCOUNTER_KEY_TO_ROSTER: Record<EncounterEnemyKey, EnemyRosterId> = {
  FRACTURE_HOUND: 'fracture-hound',
  ECHOING_BRUTE: 'echoing-brute',
  LEY_SIREN: 'ley-siren',
  ASH_WEEPER: 'ash-weeper',
  MIASMA_SWARM: 'miasma-tick-swarm',
  NULL_SHADE: 'null-shade',
  SPATIAL_GLITCH: 'spatial-glitch',
  GUTTER_GOLIATH: 'gutter-goliath',
  CONCRETE_GARGOYLE: 'concrete-gargoyle',
  RIOT_VANGUARD: 'echoing-brute',
  SPALL: 'spall',
  SCUTTLER: 'scuttler',
  THRALL: 'thrall',
  HOOK_WEAVER: 'hook-weaver',
  MEMORY_LEECH: 'memory-leech',
  SMOG_CALLER: 'smog-caller',
  IRON_MAIDEN: 'iron-maiden',
  GOLEM: 'golem',
  SLAG_BLOOD: 'slag-blood',
  SAPPER: 'sapper',
  COIL_SPIKE_SNIPER: 'coil-spike-sniper',
  RESONANCE_CASTER: 'resonance-caster',
  TAR_SPITTER: 'tar-spitter',
  CHURN: 'churn',
  SPLINTER: 'splinter',
  BREACHER: 'breacher',
  CUTTER: 'cutter',
  WARDEN: 'warden',
  FIXER: 'fixer',
  SPOTTER: 'spotter',
  BURNER: 'burner',
  RIVAL_HEXER: 'rival-hexer',
  RIVAL_VEILBINDER: 'rival-veilbinder',
  RIVAL_REAVER: 'rival-reaver',
  AMALGAM: 'amalgam',
  WIRE_GHOUL: 'wire-ghoul',
  HOLLOW_LUNG: 'hollow-lung',
  GRAVE_ROBBER: 'grave-robber',
  WEEPING_GARGOYLE: 'weeping-gargoyle',
  PHASE_SCUTTLER: 'phase-scuttler',
  REMEMBERING_THRALL: 'remembering-thrall',
  TAR_CHOIR: 'tar-choir',
  STATIC_CALLER: 'static-caller',
  BLOOD_RUSTED_GOLEM: 'blood-rusted-golem',
  ROOTBOUND_WEEPER: 'rootbound-weeper',
  ANCHOR_HUSK: 'anchor-husk',
  CORE_SICK_AMALGAM: 'core-sick-amalgam',
  VOID_LOCK_MEMORY_LEECH: 'void-lock-memory-leech',
  GRAVE_ENGINE_CHURN: 'grave-engine-churn',
  NULL_CROWN_SHADE: 'null-crown-shade',
  CHOIR_BOUND_RESONANCE_CASTER: 'choir-bound-resonance-caster',
  RIFT_SPIKE_SNIPER: 'rift-spike-sniper',
};

type StatKey = keyof typeof ENEMY_BASE_STATS;

const ROSTER_STAT_KEY: Record<EnemyRosterId, StatKey | null> = {
  'fracture-hound': 'FRACTURE_HOUND',
  'echoing-brute': 'ECHOING_BRUTE',
  'ley-siren': 'LEY_SIREN',
  'ash-weeper': 'ASH_WEEPER',
  'miasma-tick-swarm': 'MIASMA_SWARM',
  'null-shade': 'NULL_SHADE',
  'spatial-glitch': 'SPATIAL_GLITCH',
  'gutter-goliath': 'GUTTER_GOLIATH',
  'concrete-gargoyle': 'CONCRETE_GARGOYLE',
  'spall': 'SPALL',
  'scuttler': 'SCUTTLER',
  'thrall': 'THRALL',
  'hook-weaver': 'HOOK_WEAVER',
  'memory-leech': 'MEMORY_LEECH',
  'smog-caller': 'SMOG_CALLER',
  'iron-maiden': 'IRON_MAIDEN',
  'golem': 'GOLEM',
  'slag-blood': 'SLAG_BLOOD',
  'sapper': 'SAPPER',
  'coil-spike-sniper': 'COIL_SPIKE_SNIPER',
  'resonance-caster': 'RESONANCE_CASTER',
  'tar-spitter': 'TAR_SPITTER',
  'churn': 'CHURN',
  'splinter': 'SPLINTER',
  'breacher': 'BREACHER',
  'cutter': 'CUTTER',
  'warden': 'WARDEN',
  'fixer': 'FIXER',
  'spotter': 'SPOTTER',
  'burner': 'BURNER',
  'rival-hexer': 'RIVAL_HEXER',
  'rival-veilbinder': 'RIVAL_VEILBINDER',
  'rival-reaver': 'RIVAL_REAVER',
  'amalgam': 'AMALGAM',
  'wire-ghoul': 'WIRE_GHOUL',
  'hollow-lung': 'HOLLOW_LUNG',
  'grave-robber': 'GRAVE_ROBBER',
  'weeping-gargoyle': 'WEEPING_GARGOYLE',
  'phase-scuttler': 'PHASE_SCUTTLER',
  'remembering-thrall': 'REMEMBERING_THRALL',
  'tar-choir': 'TAR_CHOIR',
  'static-caller': 'STATIC_CALLER',
  'blood-rusted-golem': 'BLOOD_RUSTED_GOLEM',
  'rootbound-weeper': 'ROOTBOUND_WEEPER',
  'anchor-husk': 'ANCHOR_HUSK',
  'core-sick-amalgam': 'CORE_SICK_AMALGAM',
  'void-lock-memory-leech': 'VOID_LOCK_MEMORY_LEECH',
  'grave-engine-churn': 'GRAVE_ENGINE_CHURN',
  'null-crown-shade': 'NULL_CROWN_SHADE',
  'choir-bound-resonance-caster': 'CHOIR_BOUND_RESONANCE_CASTER',
  'rift-spike-sniper': 'RIFT_SPIKE_SNIPER',
  'boss-hollowed-precinct': null,
  'boss-choir-of-rust': null,
  'boss-primeval-rift-walker': null,
};

/** Base stats before depth scaling — HP buffed to force ability usage. */
export const ENEMY_BASE_STATS = {
  MIASMA_SWARM: { maxHp: 75, baseDamage: 8, armor: 0 },
  FRACTURE_HOUND: { maxHp: 80, baseDamage: 10, armor: 5 },
  SCUTTLER: { maxHp: 70, baseDamage: 9, armor: 0 },
  SPALL: { maxHp: 72, baseDamage: 10, armor: 0 },
  THRALL: { maxHp: 85, baseDamage: 11, armor: 3 },
  LEY_SIREN: { maxHp: 90, baseDamage: 12, armor: 0 },
  ASH_WEEPER: { maxHp: 95, baseDamage: 12, armor: 0 },
  NULL_SHADE: { maxHp: 88, baseDamage: 14, armor: 5 },
  HOOK_WEAVER: { maxHp: 92, baseDamage: 11, armor: 0 },
  MEMORY_LEECH: { maxHp: 85, baseDamage: 10, armor: 0 },
  SMOG_CALLER: { maxHp: 100, baseDamage: 12, armor: 0 },
  ECHOING_BRUTE: { maxHp: 130, baseDamage: 18, armor: 10 },
  CONCRETE_GARGOYLE: { maxHp: 140, baseDamage: 15, armor: 25 },
  GUTTER_GOLIATH: { maxHp: 150, baseDamage: 22, armor: 15 },
  IRON_MAIDEN: { maxHp: 135, baseDamage: 16, armor: 20 },
  GOLEM: { maxHp: 145, baseDamage: 14, armor: 18 },
  SLAG_BLOOD: { maxHp: 120, baseDamage: 20, armor: 12 },
  SPATIAL_GLITCH: { maxHp: 85, baseDamage: 10, armor: 0 },
  SAPPER: { maxHp: 82, baseDamage: 22, armor: 0 },
  COIL_SPIKE_SNIPER: { maxHp: 80, baseDamage: 18, armor: 0 },
  RESONANCE_CASTER: { maxHp: 88, baseDamage: 14, armor: 0 },
  TAR_SPITTER: { maxHp: 86, baseDamage: 12, armor: 0 },
  CHURN: { maxHp: 90, baseDamage: 20, armor: 0 },
  SPLINTER: { maxHp: 84, baseDamage: 13, armor: 0 },
  BREACHER: { maxHp: 78, baseDamage: 6, armor: 0 },
  CUTTER: { maxHp: 74, baseDamage: 10, armor: 0 },
  WARDEN: { maxHp: 128, baseDamage: 14, armor: 8 },
  FIXER: { maxHp: 88, baseDamage: 8, armor: 0 },
  SPOTTER: { maxHp: 84, baseDamage: 12, armor: 0 },
  BURNER: { maxHp: 86, baseDamage: 9, armor: 0 },
  RIVAL_HEXER: { maxHp: 82, baseDamage: 9, armor: 0 },
  RIVAL_VEILBINDER: { maxHp: 88, baseDamage: 8, armor: 0 },
  RIVAL_REAVER: { maxHp: 120, baseDamage: 16, armor: 0 },
  AMALGAM: { maxHp: 160, baseDamage: 17, armor: 12 },
  WIRE_GHOUL: { maxHp: 72, baseDamage: 10, armor: 0 },
  HOLLOW_LUNG: { maxHp: 92, baseDamage: 10, armor: 0 },
  GRAVE_ROBBER: { maxHp: 90, baseDamage: 11, armor: 0 },
  WEEPING_GARGOYLE: { maxHp: 145, baseDamage: 15, armor: 24 },
  PHASE_SCUTTLER: { maxHp: 68, baseDamage: 9, armor: 0 },
  REMEMBERING_THRALL: { maxHp: 88, baseDamage: 11, armor: 3 },
  TAR_CHOIR: { maxHp: 90, baseDamage: 12, armor: 0 },
  STATIC_CALLER: { maxHp: 102, baseDamage: 12, armor: 0 },
  BLOOD_RUSTED_GOLEM: { maxHp: 150, baseDamage: 15, armor: 18 },
  ROOTBOUND_WEEPER: { maxHp: 98, baseDamage: 12, armor: 0 },
  ANCHOR_HUSK: { maxHp: 110, baseDamage: 14, armor: 4 },
  CORE_SICK_AMALGAM: { maxHp: 175, baseDamage: 18, armor: 12 },
  VOID_LOCK_MEMORY_LEECH: { maxHp: 90, baseDamage: 10, armor: 0 },
  GRAVE_ENGINE_CHURN: { maxHp: 95, baseDamage: 22, armor: 0 },
  NULL_CROWN_SHADE: { maxHp: 95, baseDamage: 15, armor: 5 },
  CHOIR_BOUND_RESONANCE_CASTER: { maxHp: 92, baseDamage: 15, armor: 0 },
  RIFT_SPIKE_SNIPER: { maxHp: 84, baseDamage: 20, armor: 0 },
} as const;

export const DEPTH_SCALING: Record<DistrictId, { hpMult: number; dmgMult: number }> = {
  1: { hpMult: 1.0, dmgMult: 1.0 },
  2: { hpMult: 1.65, dmgMult: 1.8 },
  3: { hpMult: 2.4, dmgMult: 2.6 },
};

export const ALPHA_MODIFIER = { hpMult: 1.3, dmgMult: 1.25, ftMult: 1.5 } as const;

export const ENEMY_ARCHETYPE: Partial<Record<EnemyRosterId, EnemySpawnArchetype>> = {
  'fracture-hound': 'MELEE',
  'echoing-brute': 'MELEE',
  'miasma-tick-swarm': 'MELEE',
  'scuttler': 'MELEE',
  'spall': 'MELEE',
  'thrall': 'MELEE',
  'gutter-goliath': 'HEAVY',
  'concrete-gargoyle': 'HEAVY',
  'iron-maiden': 'HEAVY',
  'golem': 'HEAVY',
  'slag-blood': 'HEAVY',
  'ley-siren': 'SUPPORT',
  'ash-weeper': 'SUPPORT',
  'null-shade': 'SUPPORT',
  'hook-weaver': 'SUPPORT',
  'memory-leech': 'SUPPORT',
  'smog-caller': 'SUPPORT',
  'spatial-glitch': 'ARTILLERY',
  'sapper': 'ARTILLERY',
  'coil-spike-sniper': 'ARTILLERY',
  'resonance-caster': 'ARTILLERY',
  'tar-spitter': 'ARTILLERY',
  'churn': 'ARTILLERY',
  'splinter': 'ARTILLERY',
  'breacher': 'MELEE',
  'cutter': 'MELEE',
  'warden': 'HEAVY',
  'fixer': 'SUPPORT',
  'spotter': 'ARTILLERY',
  'burner': 'SUPPORT',
  'rival-hexer': 'SUPPORT',
  'rival-veilbinder': 'SUPPORT',
  'rival-reaver': 'MELEE',
  'amalgam': 'HEAVY',
  'wire-ghoul': 'MELEE',
  'hollow-lung': 'SUPPORT',
  'grave-robber': 'SUPPORT',
  'weeping-gargoyle': 'HEAVY',
  'phase-scuttler': 'MELEE',
  'remembering-thrall': 'MELEE',
  'tar-choir': 'ARTILLERY',
  'static-caller': 'SUPPORT',
  'blood-rusted-golem': 'HEAVY',
  'rootbound-weeper': 'SUPPORT',
  'anchor-husk': 'MELEE',
  'core-sick-amalgam': 'HEAVY',
  'void-lock-memory-leech': 'SUPPORT',
  'grave-engine-churn': 'ARTILLERY',
  'null-crown-shade': 'SUPPORT',
  'choir-bound-resonance-caster': 'ARTILLERY',
  'rift-spike-sniper': 'ARTILLERY',
};

export const FRAGILE_ROSTER_IDS: readonly EnemyRosterId[] = [
  'miasma-tick-swarm',
  'fracture-hound',
  'scuttler',
  'phase-scuttler',
  'spall',
  'thrall',
  'remembering-thrall',
  'wire-ghoul',
  'anchor-husk',
];

export const HEAVY_ROSTER_IDS: readonly EnemyRosterId[] = [
  'gutter-goliath',
  'concrete-gargoyle',
  'weeping-gargoyle',
  'echoing-brute',
  'iron-maiden',
  'golem',
  'blood-rusted-golem',
  'slag-blood',
  'amalgam',
  'core-sick-amalgam',
  'warden',
  'rival-reaver',
];

export const ARTILLERY_ROSTER_IDS: readonly EnemyRosterId[] = [
  'spatial-glitch',
  'sapper',
  'coil-spike-sniper',
  'rift-spike-sniper',
  'resonance-caster',
  'choir-bound-resonance-caster',
  'tar-spitter',
  'tar-choir',
  'churn',
  'grave-engine-churn',
  'splinter',
];

export interface ResolvedEnemyStats {
  maxHp: number;
  baseDamage: number;
  kineticArmor: number;
  occultWards: number;
  archetype?: EnemySpawnArchetype;
}

export function resolveEnemyCombatStats(
  rosterId: EnemyRosterId,
  depth: number,
  options?: { isAlpha?: boolean },
): ResolvedEnemyStats | null {
  const statKey = ROSTER_STAT_KEY[rosterId];
  if (!statKey) return null;

  const district = getDistrictFromDepth(depth);
  const definitionStats = resolveDefinitionStats(statKey, district);

  let maxHp = definitionStats?.maxHp ?? Math.floor(ENEMY_BASE_STATS[statKey].maxHp * DEPTH_SCALING[district].hpMult);
  let baseDamage = definitionStats?.baseDamage ?? Math.floor(ENEMY_BASE_STATS[statKey].baseDamage * DEPTH_SCALING[district].dmgMult);
  const kineticArmor = definitionStats?.kineticArmor ?? ENEMY_BASE_STATS[statKey].armor;
  const occultWards = definitionStats?.occultArmor
    ?? (rosterId === 'ley-siren' ? 2 : rosterId === 'null-shade' ? 0 : 0);

  if (options?.isAlpha) {
    maxHp = Math.floor(maxHp * ALPHA_MODIFIER.hpMult);
    baseDamage = Math.floor(baseDamage * ALPHA_MODIFIER.dmgMult);
  }

  return {
    maxHp,
    baseDamage,
    kineticArmor,
    occultWards,
    archetype: ENEMY_ARCHETYPE[rosterId],
  };
}

export function isHeavyArchetype(rosterId?: string): boolean {
  return rosterId != null && (HEAVY_ROSTER_IDS as readonly string[]).includes(rosterId);
}

export function isFragileArchetype(rosterId?: string): boolean {
  return rosterId != null && (FRAGILE_ROSTER_IDS as readonly string[]).includes(rosterId);
}

export function isArtilleryArchetype(rosterId?: string): boolean {
  return rosterId != null && (ARTILLERY_ROSTER_IDS as readonly string[]).includes(rosterId);
}

export const ENEMY_ARCHETYPE_FOR_KEY: Record<EncounterEnemyKey, EnemySpawnArchetype> = {
  FRACTURE_HOUND: 'MELEE',
  ECHOING_BRUTE: 'MELEE',
  MIASMA_SWARM: 'MELEE',
  SCUTTLER: 'MELEE',
  SPALL: 'MELEE',
  THRALL: 'MELEE',
  GUTTER_GOLIATH: 'HEAVY',
  CONCRETE_GARGOYLE: 'HEAVY',
  IRON_MAIDEN: 'HEAVY',
  GOLEM: 'HEAVY',
  SLAG_BLOOD: 'HEAVY',
  LEY_SIREN: 'SUPPORT',
  ASH_WEEPER: 'SUPPORT',
  NULL_SHADE: 'SUPPORT',
  HOOK_WEAVER: 'SUPPORT',
  MEMORY_LEECH: 'SUPPORT',
  SMOG_CALLER: 'SUPPORT',
  SPATIAL_GLITCH: 'ARTILLERY',
  SAPPER: 'ARTILLERY',
  COIL_SPIKE_SNIPER: 'ARTILLERY',
  RESONANCE_CASTER: 'ARTILLERY',
  TAR_SPITTER: 'ARTILLERY',
  CHURN: 'ARTILLERY',
  SPLINTER: 'ARTILLERY',
  BREACHER: 'MELEE',
  CUTTER: 'MELEE',
  WARDEN: 'HEAVY',
  FIXER: 'SUPPORT',
  SPOTTER: 'ARTILLERY',
  BURNER: 'SUPPORT',
  RIVAL_HEXER: 'SUPPORT',
  RIVAL_VEILBINDER: 'SUPPORT',
  RIVAL_REAVER: 'MELEE',
  AMALGAM: 'HEAVY',
  WIRE_GHOUL: 'MELEE',
  HOLLOW_LUNG: 'SUPPORT',
  GRAVE_ROBBER: 'SUPPORT',
  WEEPING_GARGOYLE: 'HEAVY',
  PHASE_SCUTTLER: 'MELEE',
  REMEMBERING_THRALL: 'MELEE',
  TAR_CHOIR: 'ARTILLERY',
  STATIC_CALLER: 'SUPPORT',
  BLOOD_RUSTED_GOLEM: 'HEAVY',
  ROOTBOUND_WEEPER: 'SUPPORT',
  ANCHOR_HUSK: 'MELEE',
  CORE_SICK_AMALGAM: 'HEAVY',
  VOID_LOCK_MEMORY_LEECH: 'SUPPORT',
  GRAVE_ENGINE_CHURN: 'ARTILLERY',
  NULL_CROWN_SHADE: 'SUPPORT',
  CHOIR_BOUND_RESONANCE_CASTER: 'ARTILLERY',
  RIFT_SPIKE_SNIPER: 'ARTILLERY',
  RIOT_VANGUARD: 'MELEE',
};
