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
  | 'ARMOR_BREAK'
  | 'WARD_BREAK'
  | 'WARD_PIERCE'
  | 'EXECUTION'
  | 'TRAP'
  | 'DEBUFF'
  | 'DEFENSIVE'
  | 'BUFF'
  | 'CONTROL'
  | 'RESTORE'
  | 'RELOAD'
  | 'OCCULT'
  /** Phase 2 — intent counterplay tags */
  | 'INTERRUPT'
  | 'BLIND'
  | 'GUARD_BREAK'
  | 'BLOCK'
  | 'SILENCE';

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
  | 'CONTROL'
  | 'FRACTURE'
  | 'WARD_BREAK'
  | 'ARMOR_PIERCE'
  /** Phase 2 — intent counterplay tags */
  | 'INTERRUPT'
  | 'SILENCE'
  | 'BLOCK'
  | 'GUARD_BREAK'
  | 'BLIND'
  | 'DECOY';

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
  /** Aegis — Riposte stored Strike bonus (Perfect Parry). See aegisRiposteEngine. */
  riposteReady: boolean;
  /** Player-turn number after which Riposte expires (end of that turn). */
  riposteExpiresAfterPlayerTurn: number | null;
  riposteGrantedBy: 'PERFECT_PARRY' | 'BOON' | 'GRAFT' | 'OTHER' | null;
  riposteGrantId: string | null;
  /** Phase 3 — Hex Shot chamber bonus after tactical reload. */
  chamberBonusReady: boolean;
  /** Phase 3 — Envoy catalyst state (lightweight). */
  currentCatalyst: 'NULL' | 'ECHO' | 'BLOOD' | 'ASH' | null;
  previousCatalyst: 'NULL' | 'ECHO' | 'BLOOD' | 'ASH' | null;
  catalystPrimedThisTurn: boolean;
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
    riposteReady: false,
    riposteExpiresAfterPlayerTurn: null,
    riposteGrantedBy: null,
    riposteGrantId: null,
    chamberBonusReady: false,
    currentCatalyst: null,
    previousCatalyst: null,
    catalystPrimedThisTurn: false,
  };
}

export function operativeClassForAbility(classId: ClassType): ClassType {
  return classId;
}
