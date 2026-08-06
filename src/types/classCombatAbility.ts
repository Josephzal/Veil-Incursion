import type { ClassType } from './game';
import type { AegisAbilityId } from './aegisCombat';
import type { CombatGridSlotId } from './combatGrid';
import type { HexAmmoType } from './hexAmmo';
import type { EnvoyAbilityId, HexShotAbilityId } from './operativeClass';

export type HexShotAbilityTag =
  | 'BALLISTIC'
  | 'VOID_AMMO'
  | 'TACTICAL'
  | 'ULTIMATE'
  | 'TRUE_DAMAGE'
  | 'RANGED'
  | 'KINETIC'
  | 'HEAVY'
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
  /**
   * H.3b — Cinderline Saturation positional hazards keyed by CombatGridSlotId.
   * roundsRemaining counts enemy phases remaining; ticks deal Occult at unit turn start.
   */
  cinderlineHazards: Partial<Record<CombatGridSlotId, { roundsRemaining: number }>>;
  /** Unit IDs already ticked by Cinderline this enemy phase (max one tick / unit / round). */
  cinderlineTickedUnitIdsThisEnemyPhase: Record<string, boolean>;
  /** H.3b — Blacksite Triage once-per-encounter charge. */
  blacksiteTriageUsed: boolean;
  /**
   * W.2 — Slipshot Elusive charges (0–1). Forced evade vs next eligible direct attack.
   * Expires at Hex player-turn start; clears on encounter cleanup.
   */
  hexElusiveCharges: number;
  /** W.2 — Last Word AP refund already used this player turn. */
  lastWordApRefundUsedThisPlayerTurn: boolean;
  /**
   * W.3 — Carbine Firing Solution (accuracy-only). At most one living enemy.
   * Expires at end of firingSolutionExpiresAfterPlayerTurn.
   */
  firingSolutionUnitId: string | null;
  firingSolutionExpiresAfterPlayerTurn: number | null;
  /**
   * W.3 — Carbine Suppressed from SUPPRESSIVE_BARRAGE.
   * Distinct from boon SUPPRESSIVE_FIRE / encounter.suppressiveFireUnits.
   */
  carbineSuppressedUnitId: string | null;
  /** Set while the suppressed enemy's current eligible direct action is applying ×0.70. */
  carbineSuppressedAppliedThisAction: boolean;
  /**
   * W.4 — Deadbolt reload opportunity (Nullbreach-local, encounter-only).
   * Armed only after Phase-Shift Reload restores ≥1 round on hex-void-cannon.
   */
  deadboltReloadOpportunity: boolean;
  /** W.4 — Threshold prepared reaction armed. */
  thresholdArmed: boolean;
  /** Snapshotted ammo type for Threshold reaction delivery. */
  thresholdAmmoType: HexAmmoType | null;
  thresholdNextShotOvercharged: boolean;
  thresholdOverchargeMultiplier: number;
  thresholdFirstShotPenaltyPending: boolean;
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
  /**
   * Phase 3 chamber-bonus flag — retired in H.1a (class-wide +15% removed).
   * Kept on the encounter shape for save/mirror compatibility; always sanitize to false.
   */
  chamberBonusReady: boolean;
  /** Phase 3 — Envoy catalyst state (lightweight). */
  currentCatalyst: 'NULL' | 'ECHO' | 'BLOOD' | 'ASH' | null;
  previousCatalyst: 'NULL' | 'ECHO' | 'BLOOD' | 'ASH' | null;
  catalystPrimedThisTurn: boolean;
  /**
   * E.4 — Heart’s Due sanguineExposure marks (encounter-local; never persisted).
   * Cleared on unit death, encounter end, or end of next enemy turn if unconsumed.
   */
  sanguineExposure: Record<string, boolean>;
  /** E.4 — Smoke Arc accuracy pressure; cleared at end of next enemy turn. */
  smokeArcAccuracyDown: Record<string, boolean>;
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
    cinderlineHazards: {},
    cinderlineTickedUnitIdsThisEnemyPhase: {},
    blacksiteTriageUsed: false,
    hexElusiveCharges: 0,
    lastWordApRefundUsedThisPlayerTurn: false,
    firingSolutionUnitId: null,
    firingSolutionExpiresAfterPlayerTurn: null,
    carbineSuppressedUnitId: null,
    carbineSuppressedAppliedThisAction: false,
    deadboltReloadOpportunity: false,
    thresholdArmed: false,
    thresholdAmmoType: null,
    thresholdNextShotOvercharged: false,
    thresholdOverchargeMultiplier: 0,
    thresholdFirstShotPenaltyPending: false,
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
    sanguineExposure: {},
    smokeArcAccuracyDown: {},
  };
}

export function operativeClassForAbility(classId: ClassType): ClassType {
  return classId;
}
