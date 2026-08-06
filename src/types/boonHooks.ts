import type { AegisAbilityId, AbilityTag } from './aegisCombat';
import type { DamageChannel } from './aegisCombat';
import type { EnemyCombatProfile } from './run';
import type { LeyLineMutationId } from './leyLineMutation';
import type { HitAbsorbProtectionSource } from '../data/hitAbsorbProtectionEngine';

/** Lifecycle hooks the boon engine listens on. */
export type BoonHook =
  | 'passive'
  | 'onDamageDeal'
  | 'onAbilityResolve'
  | 'onTakeDamage'
  | 'onCriticalHit'
  | 'onEvadeSuccess'
  | 'onKill'
  | 'onEncounterStart'
  | 'onReceiveDebuff'
  | 'onReserveGenerate'
  | 'onTurnStart'
  | 'onTurnEnd'
  | 'onDefensiveFail'
  | 'onDefensiveSuccess'
  | 'onDefensiveParryPerfect'
  | 'onDefensiveParryFail';

export interface BoonRule {
  id: LeyLineMutationId;
  hook: BoonHook;
  /** Every tag must be present on the originating action. */
  tagAll?: readonly AbilityTag[];
  /** At least one tag must be present. */
  tagAny?: readonly AbilityTag[];
  /** UI / catalog trigger summary. */
  trigger: string;
}

export interface BoonActionContext {
  abilityId?: AegisAbilityId;
  actionTags: readonly AbilityTag[];
  channel?: DamageChannel;
  damage?: number;
  target?: EnemyCombatProfile;
  targetFractured?: boolean;
  targetExposed?: boolean;
}

export interface BoonEncounterState {
  adrenalineSpikeUsed: boolean;
  executionerHighUsed: boolean;
  executionerStrideUsed: boolean;
  flawlessConduitPending: boolean;
  gridGhostPending: boolean;
  momentumShiftPending: boolean;
  momentumTransferPending: boolean;
  damageTakenThisTurn: boolean;
  secondWindUsed: boolean;
  unstoppableFractureUsed: boolean;
  masochistBuff: boolean;
  /**
   * Remaining incoming-hit absorbs (Martyr graft = 2; Juggernaut Plating boon = 1).
   * Legacy boolean `juggernautShield` was one-hit; Phase D uses a counter.
   */
  juggernautShieldHits: number;
  /**
   * Provenance for the active hit-absorb counter.
   * Null when inactive, or when hydrated from incomplete legacy state with hits > 0.
   */
  hitAbsorbProtectionSource: HitAbsorbProtectionSource | null;
  spallWeaveActive: boolean;
  spallShatterPending: number;
  bloodTitheCooldown: number;
  ashenMantleCooldown: number;
  venomousRuinUnits: Set<string>;
  corruptedBloodUnits: Set<string>;
  bloodForTimeUsed: boolean;
  nextKineticApDiscount: number;
  lastActionTags: readonly AbilityTag[];
  voidResonanceOccultBonus: boolean;
  /** VOID_RESONANCE — last resolved action carried KINETIC. */
  voidResonanceKineticPrimed: boolean;
  tarTrappedUnits: Record<string, number>;
  reaveBleedUnits: Record<string, number>;
  veilTarTurnsRemaining: number;
  voidsTollApBonus: number;
}

export function createDefaultBoonEncounterState(): BoonEncounterState {
  return {
    adrenalineSpikeUsed: false,
    executionerHighUsed: false,
    executionerStrideUsed: false,
    flawlessConduitPending: false,
    gridGhostPending: false,
    momentumShiftPending: false,
    momentumTransferPending: false,
    damageTakenThisTurn: false,
    secondWindUsed: false,
    unstoppableFractureUsed: false,
    masochistBuff: false,
    juggernautShieldHits: 0,
    hitAbsorbProtectionSource: null,
    spallWeaveActive: false,
    spallShatterPending: 0,
    bloodTitheCooldown: 0,
    ashenMantleCooldown: 0,
    venomousRuinUnits: new Set<string>(),
    corruptedBloodUnits: new Set<string>(),
    bloodForTimeUsed: false,
    nextKineticApDiscount: 0,
    lastActionTags: [],
    voidResonanceOccultBonus: false,
    voidResonanceKineticPrimed: false,
    tarTrappedUnits: {},
    reaveBleedUnits: {},
    veilTarTurnsRemaining: 0,
    voidsTollApBonus: 0,
  };
}
