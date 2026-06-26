import type { ClassType } from './game';
import type { AegisAbilityId } from './aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from './operativeClass';

export type HexShotAbilityTag =
  | 'BALLISTIC'
  | 'VOID_AMMO'
  | 'TACTICAL'
  | 'ULTIMATE'
  | 'TRUE_DAMAGE'
  | 'RANGED'
  | 'KINETIC'
  | 'AOE'
  | 'FRACTURE'
  | 'ARMOR_PIERCE'
  | 'EXECUTION'
  | 'TRAP'
  | 'DEBUFF'
  | 'DEFENSIVE'
  | 'BUFF'
  | 'CONTROL'
  | 'RESTORE'
  | 'RELOAD'
  | 'OCCULT';

export type EnvoyAbilityTag =
  | 'SPELL'
  | 'CURSE'
  | 'ULTIMATE'
  | 'TRUE_DAMAGE'
  | 'RANGED'
  | 'MELEE'
  | 'OCCULT'
  | 'AOE'
  | 'DEFENSIVE'
  | 'MOBILITY'
  | 'BUFF'
  | 'RESTORE'
  | 'DEBUFF'
  | 'CONTROL';

export type OperativeAbilityId = AegisAbilityId | HexShotAbilityId | EnvoyAbilityId;

export type OperativeLoadout = readonly [string, string, string, string];

export interface ClassCombatEncounterState {
  riftSnareUnits: Record<string, number>;
  panopticonActive: boolean;
  astralLockUnitId: string | null;
  soulTetherUnitId: string | null;
  ghostCamoTurnsRemaining: number;
  enemyApDrainNextTurn: Record<string, number>;
  entropyHexTurns: Record<string, number>;
  /** Envoy — Veil Rot stacks (0–4) per hostile unitId. */
  veilRotStacks: Record<string, number>;
  /** Envoy — Paralytic Miasma doubles next Veil Rot tick. */
  paralyticMiasmaDoubleRotNextTurn: Record<string, boolean>;
  fleshWarpUnits: Record<string, boolean>;
  bleedingPayloadTurns: Record<string, number>;
  /** Hex Reactive Camo — once per encounter. */
  reactiveCamoUsed: boolean;
  /** Hex Shot — successful parries toward Eviscerate proc. */
  successfulParryCount: number;
  /** Aegis — Runic Brands imprinted on the action layer. */
  runicBrands: number;
  /** Envoy — Cataclysm sigil ready when total Veil Rot stacks ≥ gate. */
  cataclysmReady: boolean;
}

export function createDefaultClassCombatEncounterState(): ClassCombatEncounterState {
  return {
    riftSnareUnits: {},
    panopticonActive: false,
    astralLockUnitId: null,
    soulTetherUnitId: null,
    ghostCamoTurnsRemaining: 0,
    enemyApDrainNextTurn: {},
    entropyHexTurns: {},
    veilRotStacks: {},
    paralyticMiasmaDoubleRotNextTurn: {},
    fleshWarpUnits: {},
    bleedingPayloadTurns: {},
    reactiveCamoUsed: false,
    successfulParryCount: 0,
    runicBrands: 0,
    cataclysmReady: false,
  };
}

export function operativeClassForAbility(classId: ClassType): ClassType {
  return classId;
}
