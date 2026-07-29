import type { EncounterEnemyKey } from './enemyCombatConfig';
import type { CompositionEnemyRole } from '../types/encounterComposition';
import { allDefinedEnemyKeys, getEnemyDefinition } from './enemyDefinitions';

export interface EnemyCompositionRoleMeta {
  primaryRole: CompositionEnemyRole;
  secondaryRoles: readonly CompositionEnemyRole[];
  abilityDisable?: boolean;
  artilleryThreat?: boolean;
  trueDamage?: boolean;
  echoSpecialOnly?: boolean;
}

/**
 * Composition taxonomy (player-facing roles). Spatial EncounterRole
 * (FRONTLINE/BACKLINE) remains separate for deck placement.
 */
export const ENEMY_COMPOSITION_ROLES: Record<EncounterEnemyKey, EnemyCompositionRoleMeta> = {
  BREACHER: { primaryRole: 'BRUISER', secondaryRoles: ['RIVAL_MERC'] },
  CUTTER: { primaryRole: 'ASSASSIN', secondaryRoles: ['RIVAL_MERC'] },
  WARDEN: { primaryRole: 'BRUISER', secondaryRoles: ['RIVAL_MERC'] },
  FIXER: { primaryRole: 'SUPPORT', secondaryRoles: ['RIVAL_MERC'] },
  SPOTTER: { primaryRole: 'ARTILLERY', secondaryRoles: ['RIVAL_MERC'], artilleryThreat: true },
  BURNER: { primaryRole: 'ARTILLERY', secondaryRoles: ['RIVAL_MERC'], artilleryThreat: true },
  RIVAL_HEXER: {
    primaryRole: 'DISRUPTOR',
    secondaryRoles: ['RIVAL_MERC'],
    abilityDisable: true,
  },
  RIVAL_VEILBINDER: { primaryRole: 'SUPPORT', secondaryRoles: ['RIVAL_MERC'] },
  RIVAL_REAVER: { primaryRole: 'BRUISER', secondaryRoles: ['RIVAL_MERC', 'ASSASSIN'] },

  MIASMA_SWARM: { primaryRole: 'SWARM', secondaryRoles: [] },
  SCUTTLER: { primaryRole: 'ASSASSIN', secondaryRoles: ['SWARM'] },
  FRACTURE_HOUND: { primaryRole: 'ASSASSIN', secondaryRoles: [] },
  SPALL: { primaryRole: 'SWARM', secondaryRoles: [] },
  THRALL: { primaryRole: 'SWARM', secondaryRoles: [] },
  LEY_SIREN: { primaryRole: 'SUPPORT', secondaryRoles: [] },
  ASH_WEEPER: { primaryRole: 'SUPPORT', secondaryRoles: ['DISRUPTOR'] },
  HOOK_WEAVER: { primaryRole: 'DISRUPTOR', secondaryRoles: [], abilityDisable: true },
  ECHOING_BRUTE: { primaryRole: 'BRUISER', secondaryRoles: [] },
  CONCRETE_GARGOYLE: { primaryRole: 'BRUISER', secondaryRoles: [] },
  GUTTER_GOLIATH: { primaryRole: 'BRUISER', secondaryRoles: [] },
  IRON_MAIDEN: { primaryRole: 'BRUISER', secondaryRoles: [] },
  GOLEM: { primaryRole: 'BRUISER', secondaryRoles: [] },
  SLAG_BLOOD: { primaryRole: 'BRUISER', secondaryRoles: [] },
  SAPPER: { primaryRole: 'ARTILLERY', secondaryRoles: [], artilleryThreat: true },
  WIRE_GHOUL: { primaryRole: 'DISRUPTOR', secondaryRoles: [], abilityDisable: true },
  SPATIAL_GLITCH: {
    primaryRole: 'DISRUPTOR',
    secondaryRoles: ['ASSASSIN'],
    abilityDisable: true,
  },
  NULL_SHADE: { primaryRole: 'ASSASSIN', secondaryRoles: [] },
  MEMORY_LEECH: {
    primaryRole: 'DISRUPTOR',
    secondaryRoles: [],
    abilityDisable: true,
  },
  SMOG_CALLER: { primaryRole: 'DISRUPTOR', secondaryRoles: [] },
  COIL_SPIKE_SNIPER: {
    primaryRole: 'ARTILLERY',
    secondaryRoles: [],
    artilleryThreat: true,
  },
  RESONANCE_CASTER: {
    primaryRole: 'ARTILLERY',
    secondaryRoles: ['SUPPORT'],
    artilleryThreat: true,
  },
  TAR_SPITTER: { primaryRole: 'DISRUPTOR', secondaryRoles: [] },
  CHURN: { primaryRole: 'ARTILLERY', secondaryRoles: ['SWARM'], artilleryThreat: true },
  SPLINTER: { primaryRole: 'ARTILLERY', secondaryRoles: [], artilleryThreat: true },
  AMALGAM: {
    primaryRole: 'BRUISER',
    secondaryRoles: ['ANCHOR_LINKED'],
    trueDamage: true,
  },
  HOLLOW_LUNG: { primaryRole: 'SUPPORT', secondaryRoles: ['DISRUPTOR'] },
  GRAVE_ROBBER: { primaryRole: 'SUPPORT', secondaryRoles: [] },

  WEEPING_GARGOYLE: { primaryRole: 'BRUISER', secondaryRoles: [] },
  PHASE_SCUTTLER: { primaryRole: 'ASSASSIN', secondaryRoles: [] },
  REMEMBERING_THRALL: { primaryRole: 'SWARM', secondaryRoles: [] },
  TAR_CHOIR: { primaryRole: 'DISRUPTOR', secondaryRoles: [] },
  STATIC_CALLER: {
    primaryRole: 'DISRUPTOR',
    secondaryRoles: [],
    abilityDisable: true,
  },
  BLOOD_RUSTED_GOLEM: { primaryRole: 'BRUISER', secondaryRoles: [] },
  ROOTBOUND_WEEPER: { primaryRole: 'SUPPORT', secondaryRoles: [] },
  ANCHOR_HUSK: {
    primaryRole: 'ANCHOR_LINKED',
    secondaryRoles: ['SUPPORT', 'BRUISER'],
  },
  CORE_SICK_AMALGAM: {
    primaryRole: 'BRUISER',
    secondaryRoles: ['ANCHOR_LINKED'],
    trueDamage: true,
  },
  VOID_LOCK_MEMORY_LEECH: {
    primaryRole: 'DISRUPTOR',
    secondaryRoles: [],
    abilityDisable: true,
  },
  GRAVE_ENGINE_CHURN: {
    primaryRole: 'ARTILLERY',
    secondaryRoles: ['SWARM'],
    artilleryThreat: true,
  },
  NULL_CROWN_SHADE: { primaryRole: 'ASSASSIN', secondaryRoles: [] },
  CHOIR_BOUND_RESONANCE_CASTER: {
    primaryRole: 'ARTILLERY',
    secondaryRoles: ['ANCHOR_LINKED'],
    artilleryThreat: true,
  },
  RIFT_SPIKE_SNIPER: {
    primaryRole: 'ARTILLERY',
    secondaryRoles: [],
    artilleryThreat: true,
    trueDamage: true,
  },
};

export function getEnemyCompositionRole(
  key: EncounterEnemyKey,
): EnemyCompositionRoleMeta | undefined {
  return ENEMY_COMPOSITION_ROLES[key];
}

export function enemyMatchesCompositionRole(
  key: EncounterEnemyKey,
  role: CompositionEnemyRole,
): boolean {
  const meta = ENEMY_COMPOSITION_ROLES[key];
  if (!meta) return false;
  if (meta.primaryRole === role) return true;
  return meta.secondaryRoles.includes(role);
}

export function enemyIsAbilityDisabler(key: EncounterEnemyKey): boolean {
  return ENEMY_COMPOSITION_ROLES[key]?.abilityDisable === true;
}

export function enemyIsArtilleryThreat(key: EncounterEnemyKey): boolean {
  return ENEMY_COMPOSITION_ROLES[key]?.artilleryThreat === true;
}

export function enemyIsTrueDamageThreat(key: EncounterEnemyKey): boolean {
  const meta = ENEMY_COMPOSITION_ROLES[key];
  if (!meta) return false;
  if (meta.trueDamage) return true;
  return getEnemyDefinition(key)?.mechanicTags.includes('TRUE_DAMAGE') === true;
}

export function enemyIsEchoSpecialOnly(key: EncounterEnemyKey): boolean {
  return ENEMY_COMPOSITION_ROLES[key]?.echoSpecialOnly === true
    || ENEMY_COMPOSITION_ROLES[key]?.primaryRole === 'ECHO_SPECIAL';
}

export function countEnemiesByCompositionRole(): Record<CompositionEnemyRole, number> {
  const counts: Record<CompositionEnemyRole, number> = {
    BRUISER: 0,
    DISRUPTOR: 0,
    ASSASSIN: 0,
    SUPPORT: 0,
    ARTILLERY: 0,
    SWARM: 0,
    ANCHOR_LINKED: 0,
    ECHO_SPECIAL: 0,
    RIVAL_MERC: 0,
    BOSS: 0,
  };
  for (const key of allDefinedEnemyKeys()) {
    const meta = ENEMY_COMPOSITION_ROLES[key];
    if (!meta) continue;
    counts[meta.primaryRole] += 1;
    for (const role of meta.secondaryRoles) {
      if (role === 'RIVAL_MERC' || role === 'ANCHOR_LINKED' || role === 'ECHO_SPECIAL') {
        counts[role] += 1;
      }
    }
  }
  return counts;
}

export function listRivalMercCompositionKeys(): EncounterEnemyKey[] {
  return allDefinedEnemyKeys().filter((key) => getEnemyDefinition(key)?.origin === 'RIVAL_MERC');
}