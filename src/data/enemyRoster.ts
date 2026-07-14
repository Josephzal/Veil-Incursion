import { COMBAT_CHANCE } from '../types/combatChance';
import type { CombatGridLane } from '../types/combatGrid';
import type { EnemyClass, EnemyCombatProfile } from '../types/run';
import type { FactionType } from '../types/game';
import { resolveEnemyCombatStats, ENCOUNTER_KEY_TO_ROSTER } from './enemyCombatConfig';
import { applyAlphaToEnemyProfile } from './enemyAlphaConfig';
import { getNodeScale } from './enemyNodeScale';
import { rollEnemyIntent } from './enemyIntentRoll';
import { initEnemyCombatLayers } from './combatFractureEngine';
import { initRosterLifecycleDefaults } from './combatLifecycleEngine';
import { CONCRETE_GARGOYLE_FRACTURE_MAX } from './combatRosterActions';
import { canRosterUseFortify, defaultPostureIntentForRoster } from './enemyPostureConfig';
import type { DistrictId } from './districtPacing';
import { depthFromNodesCleared, localLevelFromDepth } from './districtPacing';
import type { ThreatTier } from './combatEncounterBudget';
import { getEnemyDefinition } from './enemyDefinitions';
import type { EncounterEnemyKey } from './enemyCombatConfig';

export { factionForDistrict } from './districtFactionMap';

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
  | 'rival-hexer'
  | 'rival-veilbinder'
  | 'rival-reaver'
  | 'amalgam'
  | 'wire-ghoul'
  | 'hollow-lung'
  | 'grave-robber'
  | 'weeping-gargoyle'
  | 'phase-scuttler'
  | 'remembering-thrall'
  | 'tar-choir'
  | 'static-caller'
  | 'blood-rusted-golem'
  | 'rootbound-weeper'
  | 'anchor-husk'
  | 'core-sick-amalgam'
  | 'void-lock-memory-leech'
  | 'grave-engine-churn'
  | 'null-crown-shade'
  | 'choir-bound-resonance-caster'
  | 'rift-spike-sniper'
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
  /** Rival merc contractor — spawns under RIVAL_MERC origin (Phase 3). */
  isRivalMerc?: boolean;
  isVeilEntity?: boolean;
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
    isRivalMerc: true,
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
    isRivalMerc: true,
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
    isRivalMerc: true,
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
    isRivalMerc: true,
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
    isRivalMerc: true,
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
    isRivalMerc: true,
    evadeChance: 0,
    critChance: 0,
  },
  'rival-hexer': {
    id: 'rival-hexer',
    designation: 'RIVAL HEXER',
    faction: 'LEGION',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 82,
    damage: 9,
    kineticArmor: 0,
    occultWards: 1,
    threatTier: 2,
    isDisruptor: true,
    isRivalMerc: true,
    evadeChance: 0.10,
    critChance: 0,
  },
  'rival-veilbinder': {
    id: 'rival-veilbinder',
    designation: 'RIVAL VEILBINDER',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 88,
    damage: 8,
    kineticArmor: 0,
    occultWards: 1,
    threatTier: 2,
    isRivalMerc: true,
    evadeChance: 0.10,
    critChance: 0,
  },
  'rival-reaver': {
    id: 'rival-reaver',
    designation: 'RIVAL REAVER',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 120,
    damage: 16,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 3,
    isRivalMerc: true,
    evadeChance: 0,
    critChance: 0.10,
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

  'weeping-gargoyle': {
    id: 'weeping-gargoyle',
    designation: 'WEEPING GARGOYLE',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 145,
    damage: 15,
    kineticArmor: 2,
    occultWards: 0,
    threatTier: 3,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0.05,
  },
  'phase-scuttler': {
    id: 'phase-scuttler',
    designation: 'PHASE SCUTTLER',
    faction: 'LEGION',
    class: 'GREMLIN',
    role: 'FRONTLINE',
    hp: 68,
    damage: 9,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 1,
    isVeilEntity: true,
    evadeChance: 0.28,
    critChance: 0,
  },
  'remembering-thrall': {
    id: 'remembering-thrall',
    designation: 'REMEMBERING THRALL',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 88,
    damage: 11,
    kineticArmor: 3,
    occultWards: 0,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0.05,
  },
  'tar-choir': {
    id: 'tar-choir',
    designation: 'TAR CHOIR',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 90,
    damage: 12,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0,
  },
  'static-caller': {
    id: 'static-caller',
    designation: 'STATIC CALLER',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 102,
    damage: 12,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0,
  },
  'blood-rusted-golem': {
    id: 'blood-rusted-golem',
    designation: 'BLOOD-RUSTED GOLEM',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 150,
    damage: 15,
    kineticArmor: 3,
    occultWards: 0,
    threatTier: 3,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0.05,
  },
  'rootbound-weeper': {
    id: 'rootbound-weeper',
    designation: 'ROOTBOUND WEEPER',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 98,
    damage: 12,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0,
  },
  'anchor-husk': {
    id: 'anchor-husk',
    designation: 'ANCHOR HUSK',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 110,
    damage: 14,
    kineticArmor: 1,
    occultWards: 1,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0.05,
  },
  'core-sick-amalgam': {
    id: 'core-sick-amalgam',
    designation: 'CORE-SICK AMALGAM',
    faction: 'LEGION',
    class: 'ABOMINATION',
    role: 'FRONTLINE',
    hp: 175,
    damage: 18,
    kineticArmor: 3,
    occultWards: 0,
    threatTier: 3,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0.05,
  },
  'void-lock-memory-leech': {
    id: 'void-lock-memory-leech',
    designation: 'VOID-LOCK MEMORY LEECH',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 90,
    damage: 10,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0,
  },
  'grave-engine-churn': {
    id: 'grave-engine-churn',
    designation: 'GRAVE-ENGINE CHURN',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'BACKLINE',
    hp: 95,
    damage: 22,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0,
  },
  'null-crown-shade': {
    id: 'null-crown-shade',
    designation: 'NULL-CROWN SHADE',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 95,
    damage: 15,
    kineticArmor: 1,
    occultWards: 2,
    threatTier: 3,
    isVeilEntity: true,
    evadeChance: 0.1,
    critChance: 0,
  },
  'choir-bound-resonance-caster': {
    id: 'choir-bound-resonance-caster',
    designation: 'CHOIR-BOUND RESONANCE CASTER',
    faction: 'SOLARIS',
    class: 'APPARITION',
    role: 'BACKLINE',
    hp: 92,
    damage: 15,
    kineticArmor: 0,
    occultWards: 1,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0,
  },
  'rift-spike-sniper': {
    id: 'rift-spike-sniper',
    designation: 'RIFT-SPIKE SNIPER',
    faction: 'TERRAN_GRID',
    class: 'ABOMINATION',
    role: 'BACKLINE',
    hp: 84,
    damage: 20,
    kineticArmor: 0,
    occultWards: 0,
    threatTier: 2,
    isVeilEntity: true,
    evadeChance: 0,
    critChance: 0.05,
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
  'rival-hexer',
  'rival-veilbinder',
  'rival-reaver',
  'amalgam',
  'wire-ghoul',
  'hollow-lung',
  'grave-robber',
  'weeping-gargoyle',
  'phase-scuttler',
  'remembering-thrall',
  'tar-choir',
  'static-caller',
  'blood-rusted-golem',
  'rootbound-weeper',
  'anchor-husk',
  'core-sick-amalgam',
  'void-lock-memory-leech',
  'grave-engine-churn',
  'null-crown-shade',
  'choir-bound-resonance-caster',
  'rift-spike-sniper',
];

export const ALLOWED_BOSS_ROSTER_IDS: readonly EnemyRosterId[] = [
  'boss-hollowed-precinct',
  'boss-choir-of-rust',
  'boss-primeval-rift-walker',
];

export function districtBossRosterId(gateDepth: number): EnemyRosterId {
  if (gateDepth >= 45) return 'boss-primeval-rift-walker';
  if (gateDepth === 30) return 'boss-choir-of-rust';
  return 'boss-hollowed-precinct';
}

function encounterKeyForRoster(rosterId: EnemyRosterId): EncounterEnemyKey | null {
  for (const [key, id] of Object.entries(ENCOUNTER_KEY_TO_ROSTER) as Array<[EncounterEnemyKey, EnemyRosterId]>) {
    if (id === rosterId) return key;
  }
  return null;
}

function resolveOriginFlags(
  entry: EnemyRosterEntry,
): Pick<EnemyCombatProfile, 'isRivalMerc' | 'isVeilEntity'> {
  const encounterKey = encounterKeyForRoster(entry.id);
  const def = encounterKey ? getEnemyDefinition(encounterKey) : undefined;
  const isRivalMerc = entry.isRivalMerc ?? def?.origin === 'RIVAL_MERC';
  const isVeilEntity = entry.isVeilEntity ?? def?.origin === 'VEIL';
  return {
    isRivalMerc,
    isVeilEntity,
  };
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
  },
): EnemyCombatProfile {
  const scale = getNodeScale(nodeIndex);
  const depth = depthFromNodesCleared(nodeIndex);
  const resolvedStats = resolveEnemyCombatStats(entry.id, depth, { isAlpha: options?.isAlpha });
  const elite = entry.elite === true || options?.forcedElite === true || options?.isApex === true;
  const maxHp = resolvedStats?.maxHp
    ?? Math.floor(entry.hp * (elite ? 1.15 : 1));
  const baseDamage = resolvedStats?.baseDamage ?? entry.damage;
  const postureIntent = defaultPostureIntentForRoster(entry.id);
  let intent = postureIntent ?? rollEnemyIntent(entry.class, 0, options?.district ?? 1);
  if (!canRosterUseFortify(entry.id) && intent === 'FORTIFY') {
    intent = postureIntent === 'EVADE' ? 'EVADE' : 'STRIKE';
  }
  const originFlags = resolveOriginFlags(entry);
  const base: EnemyCombatProfile = {
    class: entry.class,
    designation: entry.designation,
    maxHp,
    currentHp: maxHp,
    baseDamage,
    intent,
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex,
    scale,
    rosterId: entry.id,
    faction: entry.faction,
    ...originFlags,
    evadeChance: Math.min(entry.evadeChance, COMBAT_CHANCE.ENEMY_MAX_EVADE_CHANCE),
    critChance: entry.critChance,
  };
  const localLevel = localLevelFromDepth(depth);
  const resonancePct = options?.resonancePercent ?? 0;
  let kineticArmor = resolvedStats?.kineticArmor ?? entry.kineticArmor;
  let occultWards = resolvedStats?.occultWards ?? entry.occultWards;
  if (localLevel >= 12 && resonancePct >= 75) {
    kineticArmor += 1;
    occultWards += 1;
  }
  const layered = initEnemyCombatLayers(base, {
    kineticArmor,
    occultWards,
    fractureMax: (entry.id === 'concrete-gargoyle' || entry.id === 'weeping-gargoyle')
      ? CONCRETE_GARGOYLE_FRACTURE_MAX
      : undefined,
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
  }
  if (entry.id === 'amalgam' || entry.id === 'core-sick-amalgam') {
    profile = {
      ...profile,
      gridWidth: 2,
      occupiedSlots: ['FL_0', 'FL_1'],
      fractureImmune: true,
      regeneratesArmor: entry.id === 'core-sick-amalgam' ? true : profile.regeneratesArmor,
    };
  }
  if (entry.id === 'remembering-thrall') {
    profile = {
      ...profile,
      alphaMechanics: {
        ...(profile.alphaMechanics ?? {}),
        reviveTurns: 1,
        reviveHpPercent: 0.45,
      },
    };
  }
  if (entry.id === 'choir-bound-resonance-caster') {
    profile = {
      ...profile,
      resonanceStack: 1,
      alphaMechanics: {
        ...(profile.alphaMechanics ?? {}),
        damageScalingPerTurn: 0.75,
      },
    };
  }
  if (entry.id === 'void-lock-memory-leech') {
    profile = {
      ...profile,
      alphaMechanics: {
        ...(profile.alphaMechanics ?? {}),
        disabledAugmentCount: 1,
        disableDuration: 2,
      },
    };
  }
  if (entry.id === 'null-crown-shade') {
    profile = {
      ...profile,
      occultImmune: true,
      alphaMechanics: {
        ...(profile.alphaMechanics ?? {}),
        immuneToOccult: true,
      },
    };
  }
  if (entry.id === 'rift-spike-sniper') {
    profile = {
      ...profile,
      alphaMechanics: {
        ...(profile.alphaMechanics ?? {}),
        lockOnTurns: 2,
      },
    };
  }
  if (entry.id === 'grave-engine-churn') {
    profile = {
      ...profile,
      alphaMechanics: {
        ...(profile.alphaMechanics ?? {}),
        requiresAllyKillToFire: true,
        consumesOnlyCorpses: false,
      },
    };
  }
  if (entry.id === 'blood-rusted-golem') {
    profile = {
      ...profile,
      golemHeatVentThreshold: 2,
      alphaMechanics: {
        ...(profile.alphaMechanics ?? {}),
        heatThreshold: 2,
      },
    };
  }
  if (entry.id === 'rootbound-weeper') {
    profile = {
      ...profile,
      alphaMechanics: {
        ...(profile.alphaMechanics ?? {}),
        kineticDeathExplosionType: 'TRUE_DAMAGE',
        explosionDamage: 18,
        rootDuration: 1,
      },
    };
  }
  if (options?.isAlpha) {
    profile = applyAlphaToEnemyProfile(profile, entry.id, {
      isAlpha: true,
      baseDesignation: entry.designation,
    });
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
