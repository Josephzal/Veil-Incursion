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
  | 'FLUX_GEN'
  | 'FLUX_DUMP'
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
  fleshWarpUnits: Record<string, boolean>;
  brimstoneBleedTurns: Record<string, number>;
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
    fleshWarpUnits: {},
    brimstoneBleedTurns: {},
  };
}

export function operativeClassForAbility(classId: ClassType): ClassType {
  return classId;
}
