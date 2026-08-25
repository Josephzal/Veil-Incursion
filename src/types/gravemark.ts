import type { CombatGridSlotId } from './combatGrid';

export const GRAVEMARK_CORE_IDS = {
  IMPACT_VECTOR: 'GM_CORE_IMPACT_VECTOR',
  FOLDED_SPACE: 'GM_CORE_FOLDED_SPACE',
  REVERSAL_FIELD: 'GM_CORE_REVERSAL_FIELD',
  MASS_TRANSFER: 'GM_CORE_MASS_TRANSFER',
} as const;

export const GRAVEMARK_SUPPORT_IDS = {
  COLLISION_COURSE: 'GM_SUPPORT_COLLISION_COURSE',
  FALSE_POSITION: 'GM_SUPPORT_FALSE_POSITION',
} as const;

export const GRAVEMARK_MANIFESTATION_ID = 'GM_MANIFESTATION_EVENT_HORIZON';
export const GRAVEMARK_VERDICT_ID = 'GM_VERDICT_WORLD_TURNED_SIDEWAYS';

export const GRAVEMARK_IDS = [
  GRAVEMARK_CORE_IDS.IMPACT_VECTOR,
  GRAVEMARK_CORE_IDS.FOLDED_SPACE,
  GRAVEMARK_CORE_IDS.REVERSAL_FIELD,
  GRAVEMARK_CORE_IDS.MASS_TRANSFER,
  GRAVEMARK_SUPPORT_IDS.COLLISION_COURSE,
  GRAVEMARK_SUPPORT_IDS.FALSE_POSITION,
  GRAVEMARK_MANIFESTATION_ID,
  GRAVEMARK_VERDICT_ID,
] as const;

/** Once-per-target/combat-cycle cap on ordinary (non-bonus) Displacement. */
export const GRAVEMARK_NORMAL_DISPLACEMENT_CAP = 1;

export const GRAVEMARK_COLLISION_COURSE_DAMAGE = {
  1: 8,
  2: 12,
  3: 16,
} as const;

export type GravemarkPolarityId = 'ARMAMENT' | 'DISCIPLINE' | 'INSTINCT' | 'CURRENT';

export type DisplacementKind = 'MOVE' | 'SWAP' | 'IMMOVABLE';

export type DisplacementFizzleReason =
  | 'NO_LEGAL_TARGET'
  | 'NO_LEGAL_SLOT'
  | 'CAP_REACHED'
  | 'DEAD_OR_REMOVED';

export interface GravemarkPolarityRecord {
  rootActionId: string | null;
  targetId: string;
  previous: GravemarkPolarityId | null;
  next: GravemarkPolarityId;
  changed: boolean;
  sourceDefinitionId: string;
}

export interface GravemarkDisplacementRecord {
  rootActionId: string | null;
  sourceEventId: string;
  triggerUnitId: string;
  passengerUnitId: string | null;
  fromSlot: CombatGridSlotId | null;
  toSlot: CombatGridSlotId | null;
  kind: DisplacementKind;
  bonus: boolean;
  fizzleReason: DisplacementFizzleReason | null;
  sourceDefinitionId: string;
  procDepth: number;
}

export interface GravemarkCollisionRecord {
  rootActionId: string | null;
  targetId: string;
  amount: number;
  kinetic: number;
  occult: number;
  sourceDefinitionId: string;
  kind: 'IMPACT_VECTOR' | 'COLLISION_COURSE' | 'WORLD_TURNED_SIDEWAYS';
  killed: boolean;
}

export interface GravemarkCapBlockRecord {
  targetId: string;
  reason: DisplacementFizzleReason;
  sourceDefinitionId: string;
}

export interface GravemarkBossTranslationRecord {
  targetId: string;
  translated: boolean;
  reason: string | null;
}

/** Movement the Hub must apply exactly once to the authoritative live grid. */
export interface GravemarkPendingMovementEffect {
  id: string;
  triggerUnitId: string;
  passengerUnitId: string | null;
  fromSlot: CombatGridSlotId;
  toSlot: CombatGridSlotId;
  kind: 'MOVE' | 'SWAP';
  createdOrder: number;
}

export interface GravemarkRuntimeState {
  polarityByUnitId: Record<string, GravemarkPolarityId>;
  /** Player-turn index at which Unmoored clears (checked at the very start of PLAYER_TURN_STARTED). */
  unmooredExpiryByUnitId: Record<string, number>;
  /** Ordinary Displacement usage this combat cycle, keyed by unit id. */
  displacementCountByUnitId: Record<string, number>;
  /** Event Horizon bonus usage this combat cycle, keyed by unit id. */
  eventHorizonUsedByUnitId: Record<string, boolean>;
  eventHorizonSnapshotRootId: string | null;
  eventHorizonSnapshotUnitIds: readonly string[];
  foldedSpaceUsedThisPlayerTurn: boolean;
  massTransferUsedThisPlayerTurn: boolean;
  reversalFieldUsedThisCombatCycle: boolean;
  /** Guards World Turned Sideways to once per ultimate root commitment. */
  worldTurnedSidewaysRootId: string | null;
  /** Locked targets captured at the pre-native pass, replayed for the post-native 20% packet. */
  worldTurnedSidewaysLockedTargetIds: readonly string[];
  phaseSuccessorByUnitId: Record<string, string>;
  playerTurnIndex: number;
  combatCycleIndex: number;
  activeRootId: string | null;
  pendingMovementEffects: readonly GravemarkPendingMovementEffect[];
  nextPendingMovementOrder: number;
  /** Folded Space AP refund the Hub must apply exactly once, then clear. */
  lastApRefund: number;
  lastPolarity: GravemarkPolarityRecord | null;
  lastDisplacement: GravemarkDisplacementRecord | null;
  lastSwap: GravemarkDisplacementRecord | null;
  lastCollision: GravemarkCollisionRecord | null;
  lastCapBlock: GravemarkCapBlockRecord | null;
  lastBossTranslation: GravemarkBossTranslationRecord | null;
  lastLog: string | null;
}

export interface GravemarkPresentation {
  active: boolean;
  polarityByUnitId: Readonly<Record<string, GravemarkPolarityId>>;
  unmooredUnitIds: readonly string[];
  displacementSpentByUnitId: Readonly<Record<string, number>>;
  displacementCap: number;
  eventHorizonUnitIds: readonly string[];
  lastLog: string | null;
}
