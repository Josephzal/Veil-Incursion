import type { FactionType } from '../types/game';
import type { CombatGridLane } from '../types/combatGrid';
import type { EnemyClass, EnemyCombatProfile } from '../types/run';
import { resolveEnemyCombatStats } from './enemyCombatConfig';
import { getNodeScale } from './enemyNodeScale';
import { rollEnemyIntent } from './enemyIntentRoll';
import { resolveEnemyAffinity } from './combatEnvironmentEngine';
import { applyCorporealHpMultiplier } from './combatEnvironmentEngine';
import { initEnemyCombatLayers } from './combatFractureEngine';
import { initRosterLifecycleDefaults } from './combatLifecycleEngine';
import { CONCRETE_GARGOYLE_FRACTURE_MAX } from './combatRosterActions';
import { defaultPostureIntentForRoster } from './enemyPostureConfig';
import { applyFactionTrait } from './factionTraitEngine';
import type { DistrictId } from './districtPacing';
import { depthFromNodesCleared, localLevelFromDepth } from './districtPacing';
import type { ThreatTier } from './combatEncounterBudget';

export type EnemyRosterId =
  | 'concrete-gargoyle'
  | 'gutter-goliath'
  | 'echoing-brute'
  | 'ley-siren'
  | 'ash-weeper'
  | 'miasma-tick-swarm'
  | 'fracture-hound'
  | 'null-shade'
  | 'spatial-glitch'
  | 'spall'
  | 'scuttler'
  | 'thrall'
  | 'hook-weaver'
  | 'memory-leech'
  | 'smog-caller'
  | 'iron-maiden'
  | 'golem'
  | 'slag-blood'
  | 'sapper'
  | 'coil-spike-sniper'
  | 'resonance-caster'
  | 'tar-spitter'
  | 'churn'
  | 'splinter'
  | 'breacher'
  | 'cutter'
  | 'warden'
  | 'fixer'
  | 'spotter'
  | 'burner'
  | 'amalgam'
  | 'wire-ghoul'
  | 'hollow-lung'
  | 'grave-robber'
  | 'boss-hollowed-precinct'
  | 'boss-choir-of-rust'
  | 'boss-primeval-rift-walker';

export interface EnemyRosterEntry {
  id: EnemyRosterId;
  designation: string;
  faction: FactionType;
  class: EnemyClass;
  role: CombatGridLane;
  hp: number;
  damage: number;
  kineticArmor: number;
  occultWards: number;
  threatTier: ThreatTier;
  isDisruptor?: boolean;
  elite?: boolean;
  evadeChance: number;
  critChance: number;
  isCabalHuman?: boolean;
  isVeilEntity?: boolean;
  cabalClassLabel?: string;
}

export const ENEMY_ROSTER: Record<EnemyRosterId, EnemyRosterEntry> = {
  'concrete-gargoyle': {
    id: 'concrete-gargoyle',
    designation: 'CONCRETE GARGOYLE',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 72,
    damage: 10,
    kineticArmor: 2,
    occultWards: 0,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0.05,
  },
  'gutter-goliath': {
    id: 'gutter-goliath',
    designation: 'GUTTER GOLIATH',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 88,
    damage: 11,
    kineticArmor: 3,
    occultWards: 0,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0.05,
  },
  'echoing-brute': {
    id: 'echoing-brute',
    designation: 'ECHOING BRUTE',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 95,
    damage: 13,
    kineticArmor: 2,
    occultWards: 1,
    threatTier: 2,
    elite: true,
    evadeChance: 0,
    critChance: 0.05,
  },
  'ley-siren': {
    id: 'ley-siren',
    designation: 'LEY-SIREN',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 48,
    damage: 11,
    kineticArmor: 0,
    occultWards: 2,
    threatTier: 2,
    isDisruptor: true,
    evadeChance: 0.10,
    critChance: 0,
  },
  'ash-weeper': {
    id: 'ash-weeper',
    designation: 'ASH WEEPER',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 102,
    damage: 14,
    kineticArmor: 2,
    occultWards: 2,
    threatTier: 1,
    isDisruptor: true,
    evadeChance: 0.10,
    critChance: 0,
  },
  'miasma-tick-swarm': {
    id: 'miasma-tick-swarm',
    designation: 'MIASMA TICK SWARM',
    faction: 'SOLARIS',
    class: 'GREMLIN',
    role: 'FRONTLINE',
    hp: 44,
    damage: 8,
    kineticArmor: 1,
    occultWards: 0,
    threatTier: 1,
    evadeChance: 0.15,
    critChance: 0,
  },
  'fracture-hound': {
    id: 'fracture-hound',
    designation: 'FRACTURE HOUND',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'FRONTLINE',
    hp: 60,
    damage: 11,
    kineticArmor: 1,
    occultWards: 1,
    threatTier: 2,
    evadeChance: 0.15,
    critChance: 0.10,
  },
  'null-shade': {
    id: 'null-shade',
    designation: 'NULL SHADE',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 54,
    damage: 10,
    kineticArmor: 0,
    occultWards: 2,
    threatTier: 3,
    evadeChance: 0.15,
    critChance: 0.10,
  },
  'spatial-glitch': {
    id: 'spatial-glitch',
    designation: 'SPATIAL GLITCH',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'BACKLINE',
    hp: 108,
    damage: 15,
    kineticArmor: 3,
    occultWards: 1,
    threatTier: 3,
    elite: true,
    evadeChance: 0.15,
    critChance: 0.15,
  },
  'spall': {
    id: 'spall',
    designation: 'SPALL',
    faction: 'SOLARIS',
    class: 'GREMLIN',
    role: 'FRONTLINE',
    hp: 72,
    damage: 10,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 1,
    evadeChance: 0.10,
    critChance: 0,
  },
  'scuttler': {
    id: 'scuttler',
    designation: 'SCUTTLER',
    faction: 'SOLARIS',
    class: 'GREMLIN',
    role: 'FRONTLINE',
    hp: 70,
    damage: 9,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 1,
    evadeChance: 0.50,
    critChance: 0,
  },
  'thrall': {
    id: 'thrall',
    designation: 'THRALL',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'FRONTLINE',
    hp: 85,
    damage: 11,
    kineticArmor: 3,
    occultWards: 0,
    threatTier: 2,
    evadeChance: 0,
    critChance: 0,
  },
  'hook-weaver': {
    id: 'hook-weaver',
    designation: 'HOOK WEAVER',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 92,
    damage: 11,
    kineticArmor: 0,
    occultWards: 1,
    threatTier: 2,
    isDisruptor: true,
    evadeChance: 0.10,
    critChance: 0,
  },
  'memory-leech': {
    id: 'memory-leech',
    designation: 'MEMORY LEECH',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 85,
    damage: 10,
    kineticArmor: 0,
    occultWards: 2,
    threatTier: 2,
    isDisruptor: true,
    evadeChance: 0.10,
    critChance: 0,
  },
  'smog-caller': {
    id: 'smog-caller',
    designation: 'SMOG CALLER',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 100,
    damage: 12,
    kineticArmor: 0,
    occultWards: 1,
    threatTier: 2,
    isDisruptor: true,
    evadeChance: 0.05,
    critChance: 0,
  },
  'iron-maiden': {
    id: 'iron-maiden',
    designation: 'IRON MAIDEN',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 135,
    damage: 16,
    kineticArmor: 20,
    occultWards: 0,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0.05,
  },
  'golem': {
    id: 'golem',
    designation: 'GOLEM',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 145,
    damage: 14,
    kineticArmor: 18,
    occultWards: 0,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0.05,
  },
  'slag-blood': {
    id: 'slag-blood',
    designation: 'SLAG BLOOD',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 120,
    damage: 20,
    kineticArmor: 12,
    occultWards: 0,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0.10,
  },
  'sapper': {
    id: 'sapper',
    designation: 'SAPPER',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'BACKLINE',
    hp: 82,
    damage: 22,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    evadeChance: 0,
    critChance: 0.05,
  },
  'coil-spike-sniper': {
    id: 'coil-spike-sniper',
    designation: 'COIL SPIKE SNIPER',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 80,
    damage: 18,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    evadeChance: 0.05,
    critChance: 0.10,
  },
  'resonance-caster': {
    id: 'resonance-caster',
    designation: 'RESONANCE CASTER',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 88,
    damage: 14,
    kineticArmor: 0,
    occultWards: 1,
    threatTier: 2,
    evadeChance: 0.05,
    critChance: 0,
  },
  'tar-spitter': {
    id: 'tar-spitter',
    designation: 'TAR SPITTER',
    faction: 'SOLARIS',
    class: 'GREMLIN',
    role: 'BACKLINE',
    hp: 86,
    damage: 12,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    evadeChance: 0,
    critChance: 0,
  },
  'churn': {
    id: 'churn',
    designation: 'CHURN',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'BACKLINE',
    hp: 90,
    damage: 20,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0.05,
  },
  'splinter': {
    id: 'splinter',
    designation: 'SPLINTER',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 84,
    damage: 13,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    evadeChance: 0,
    critChance: 0.05,
  },
  'breacher': {
    id: 'breacher',
    designation: 'BREACHER',
    faction: 'TERRAN_GRID',
    class: 'APPARITION',
    role: 'FRONTLINE',
    hp: 78,
    damage: 6,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isCabalHuman: true,
    cabalClassLabel: 'BREACHER',
    evadeChance: 0,
    critChance: 0,
  },
  'cutter': {
    id: 'cutter',
    designation: 'CUTTER',
    faction: 'TERRAN_GRID',
    class: 'GREMLIN',
    role: 'FRONTLINE',
    hp: 74,
    damage: 10,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 1,
    isCabalHuman: true,
    cabalClassLabel: 'CUTTER',
    evadeChance: 0.15,
    critChance: 0,
  },
  'warden': {
    id: 'warden',
    designation: 'WARDEN',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 128,
    damage: 14,
    kineticArmor: 8,
    occultWards: 0,
    threatTier: 3,
    isCabalHuman: true,
    cabalClassLabel: 'WARDEN',
    evadeChance: 0,
    critChance: 0.05,
  },
  'fixer': {
    id: 'fixer',
    designation: 'FIXER',
    faction: 'TERRAN_GRID',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 88,
    damage: 8,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isCabalHuman: true,
    cabalClassLabel: 'FIXER',
    evadeChance: 0.10,
    critChance: 0,
  },
  'spotter': {
    id: 'spotter',
    designation: 'SPOTTER',
    faction: 'TERRAN_GRID',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 84,
    damage: 12,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isCabalHuman: true,
    cabalClassLabel: 'SPOTTER',
    evadeChance: 0.10,
    critChance: 0,
  },
  'burner': {
    id: 'burner',
    designation: 'BURNER',
    faction: 'TERRAN_GRID',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 86,
    damage: 9,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isCabalHuman: true,
    cabalClassLabel: 'BURNER',
    evadeChance: 0,
    critChance: 0,
  },
  'amalgam': {
    id: 'amalgam',
    designation: 'AMALGAM',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 160,
    damage: 17,
    kineticArmor: 12,
    occultWards: 0,
    threatTier: 3,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0.05,
  },
  'wire-ghoul': {
    id: 'wire-ghoul',
    designation: 'WIRE GHOUL',
    faction: 'LEGION',
    class: 'GREMLIN',
    role: 'FRONTLINE',
    hp: 72,
    damage: 10,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 1,
    isVeilEntity: true,
    evadeChance: 0.15,
    critChance: 0,
  },
  'hollow-lung': {
    id: 'hollow-lung',
    designation: 'HOLLOW LUNG',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 92,
    damage: 10,
    kineticArmor: 0,
    occultWards: 1,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0,
  },
  'grave-robber': {
    id: 'grave-robber',
    designation: 'GRAVE ROBBER',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 90,
    damage: 11,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0,
  },
  'boss-hollowed-precinct': {
    id: 'boss-hollowed-precinct',
    designation: 'HOLLOWED PRECINCT',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 220,
    damage: 11,
    kineticArmor: 3,
    occultWards: 1,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0,
  },
  'boss-choir-of-rust': {
    id: 'boss-choir-of-rust',
    designation: 'CHOIR OF RUST',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 280,
    damage: 10,
    kineticArmor: 1,
    occultWards: 2,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0,
  },
  'boss-primeval-rift-walker': {
    id: 'boss-primeval-rift-walker',
    designation: 'PRIMEVAL RIFT-WALKER',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 360,
    damage: 16,
    kineticArmor: 2,
    occultWards: 3,
    threatTier: 3,
    evadeChance: 0,
    critChance: 0,
  },
};

/** Grunts eligible for threat-budget encounter drafting. */
export const GRUNT_ROSTER_BY_FACTION: Record<FactionType, EnemyRosterId[]> = {
  TERRAN_GRID: ['concrete-gargoyle', 'gutter-goliath', 'echoing-brute', 'iron-maiden', 'golem', 'slag-blood', 'sapper'],
  SOLARIS: ['ley-siren', 'ash-weeper', 'miasma-tick-swarm', 'spall', 'scuttler', 'smog-caller', 'resonance-caster', 'tar-spitter', 'splinter'],
  LEGION: ['fracture-hound', 'null-shade', 'spatial-glitch', 'thrall', 'hook-weaver', 'memory-leech', 'coil-spike-sniper', 'churn'],
};

export const ALLOWED_GRUNT_ROSTER_IDS: readonly EnemyRosterId[] = [
  'concrete-gargoyle',
  'gutter-goliath',
  'echoing-brute',
  'ley-siren',
  'ash-weeper',
  'miasma-tick-swarm',
  'fracture-hound',
  'null-shade',
  'spatial-glitch',
  'spall',
  'scuttler',
  'thrall',
  'hook-weaver',
  'memory-leech',
  'smog-caller',
  'iron-maiden',
  'golem',
  'slag-blood',
  'sapper',
  'coil-spike-sniper',
  'resonance-caster',
  'tar-spitter',
  'churn',
  'splinter',
  'breacher',
  'cutter',
  'warden',
  'fixer',
  'spotter',
  'burner',
  'amalgam',
  'wire-ghoul',
  'hollow-lung',
  'grave-robber',
];

export const ALLOWED_BOSS_ROSTER_IDS: readonly EnemyRosterId[] = [
  'boss-hollowed-precinct',
  'boss-choir-of-rust',
  'boss-primeval-rift-walker',
];

export function factionForDistrict(district: 1 | 2 | 3): FactionType {
  if (district === 1) return 'TERRAN_GRID';
  if (district === 2) return 'SOLARIS';
  return 'LEGION';
}

export function rosterPoolForFaction(faction: FactionType, isElite: boolean): EnemyRosterEntry[] {
  return GRUNT_ROSTER_BY_FACTION[faction]
    .map((id) => ENEMY_ROSTER[id])
    .filter((entry) => (isElite ? entry.elite === true : !entry.elite));
}

export function pickRosterEntry(
  faction: FactionType,
  role: CombatGridLane,
  isElite: boolean,
  exclude: Set<EnemyRosterId> = new Set(),
): EnemyRosterEntry {
  const pool = rosterPoolForFaction(faction, isElite);
  const roleMatches = pool.filter((e) => e.role === role && !exclude.has(e.id));
  const candidates = roleMatches.length > 0 ? roleMatches : pool.filter((e) => !exclude.has(e.id));
  if (candidates.length === 0) return pool[0];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function districtBossRosterId(gateDepth: number): EnemyRosterId {
  if (gateDepth >= 45) return 'boss-primeval-rift-walker';
  if (gateDepth === 30) return 'boss-choir-of-rust';
  return 'boss-hollowed-precinct';
}

export function spawnRosterUnit(
  entry: EnemyRosterEntry,
  nodeIndex: number,
  options?: {
    resonancePercent?: number;
    forcedElite?: boolean;
    district?: DistrictId;
    isApex?: boolean;
    apexBudget?: number;
    isAlpha?: boolean;
    cabalFaction?: FactionType;
  },
): EnemyCombatProfile {
  const scale = getNodeScale(nodeIndex);
  const depth = depthFromNodesCleared(nodeIndex);
  const resolvedStats = resolveEnemyCombatStats(entry.id, depth, { isAlpha: options?.isAlpha });
  const elite = entry.elite === true || options?.forcedElite === true || options?.isApex === true;
  const maxHp = resolvedStats?.maxHp
    ?? Math.floor(entry.hp * (elite ? 1.15 : 1));
  const baseDamage = resolvedStats?.baseDamage ?? entry.damage;
  const affinity = resolveEnemyAffinity(entry.class, elite, options?.resonancePercent ?? 0);
  const postureIntent = defaultPostureIntentForRoster(entry.id);
  const intent = postureIntent ?? rollEnemyIntent(entry.class, 0, options?.district ?? 1);
  const base: EnemyCombatProfile = {
    class: entry.class,
    designation: entry.designation,
    maxHp,
    currentHp: maxHp,
    baseDamage,
    intent,
    chargeTurns: 0,
    evadeActive: intent === 'EVADE',
    nodeIndex,
    scale,
    rosterId: entry.id,
    faction: entry.faction,
    isCabalHuman: entry.isCabalHuman,
    isVeilEntity: entry.isVeilEntity,
    evadeChance: entry.evadeChance,
    critChance: entry.critChance,
  };
  const withAffinity = applyCorporealHpMultiplier({ ...base, affinity }, affinity);
  const localLevel = localLevelFromDepth(depth);
  const resonancePct = options?.resonancePercent ?? 0;
  let kineticArmor = resolvedStats?.kineticArmor ?? entry.kineticArmor;
  let occultWards = resolvedStats?.occultWards ?? entry.occultWards;
  if (localLevel >= 12 && resonancePct >= 75) {
    kineticArmor += 1;
    occultWards += 1;
  }
  const layered = initEnemyCombatLayers(withAffinity, {
    kineticArmor,
    occultWards,
    fractureMax: entry.id === 'concrete-gargoyle' ? CONCRETE_GARGOYLE_FRACTURE_MAX : undefined,
  });
  const withLifecycle = initRosterLifecycleDefaults(layered, entry.id);
  const withArchetype = {
    ...withLifecycle,
    spawnArchetype: resolvedStats?.archetype,
  };
  let profile: EnemyCombatProfile = withArchetype;
  if (options?.isApex) {
    profile = {
      ...profile,
      isApex: true,
      enemyActionPoints: 2,
      enemyMaxActionPoints: 2,
      designation: `APEX ${entry.designation}`,
    };
  } else if (options?.isAlpha) {
    profile = {
      ...profile,
      enemyActionPoints: 2,
      enemyMaxActionPoints: 2,
    };
  }
  if (entry.isCabalHuman && options?.cabalFaction) {
    profile = applyFactionTrait(profile, options.cabalFaction);
  }
  if (entry.id === 'amalgam') {
    profile = {
      ...profile,
      gridWidth: 2,
      occupiedSlots: ['FL_0', 'FL_1'],
      fractureImmune: true,
    };
  }
  return profile;
}

export function resolveEnemyThreatTier(profile: {
  isBoss?: boolean;
  isApex?: boolean;
  rosterId?: string;
}): 'STANDARD' | 'ELITE' | 'APEX' | 'BOSS' {
  if (profile.isBoss) return 'BOSS';
  if (profile.isApex) return 'APEX';
  if (profile.rosterId && ENEMY_ROSTER[profile.rosterId as EnemyRosterId]?.elite) return 'ELITE';
  return 'STANDARD';
}
