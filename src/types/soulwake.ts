export const SOULWAKE_CORE_IDS = {
  HOLLOW_EDGE: 'SW_CORE_HOLLOW_EDGE',
  BORROWED_NERVE: 'SW_CORE_BORROWED_NERVE',
  PAIN_REFLEX: 'SW_CORE_PAIN_REFLEX',
  OPEN_CONDUIT: 'SW_CORE_OPEN_CONDUIT',
} as const;

export const SOULWAKE_SUPPORT_IDS = {
  OPEN_NERVE: 'SW_SUPPORT_OPEN_NERVE',
  PAIN_DIVIDEND: 'SW_SUPPORT_PAIN_DIVIDEND',
} as const;

export const SOULWAKE_MANIFESTATION_ID = 'SW_MANIFESTATION_LIVING_BREACH';
export const SOULWAKE_VERDICT_ID = 'SW_VERDICT_LAST_HEARTBEAT';

export const SOULWAKE_IDS = [
  SOULWAKE_CORE_IDS.HOLLOW_EDGE,
  SOULWAKE_CORE_IDS.BORROWED_NERVE,
  SOULWAKE_CORE_IDS.PAIN_REFLEX,
  SOULWAKE_CORE_IDS.OPEN_CONDUIT,
  SOULWAKE_SUPPORT_IDS.OPEN_NERVE,
  SOULWAKE_SUPPORT_IDS.PAIN_DIVIDEND,
  SOULWAKE_MANIFESTATION_ID,
  SOULWAKE_VERDICT_ID,
] as const;

/** Central percentages. Combat math floors from these. */
export const SOULWAKE_PERCENTS = {
  WAKE_CAP: 0.2,
  OVERDRAW: 0.05,
  LAST_HEARTBEAT: 0.1,
  NATIVE_HP_CAP: 0.05,
  PAIN_DIVIDEND_HEAL_CAP: 0.05,
  PAIN_DIVIDEND_RATIO: 0.3,
  OPEN_CONDUIT_GAIN: 0.5,
  OPEN_CONDUIT_SPEND: 0.25,
  PAIN_REFLEX_STANDARD: 0.5,
  PAIN_REFLEX_CLEAN: 0.75,
  LIVING_BREACH_RESIDUAL: 0.5,
  LAST_HEARTBEAT_BUDGET: 1.5,
} as const;

export const HOLLOW_EDGE_DEPTH_CAPS = {
  1: 12,
  2: 18,
  3: 24,
} as const;

export const OPEN_CONDUIT_GAIN_CAP = 10;
export const OPEN_CONDUIT_SPEND_CAP = 5;
export const OPEN_CONDUIT_HEX_RELOAD_CAP = 2;

export type WakeKind = 'NONE' | 'NORMAL' | 'RESIDUAL';

export type HpLossProvenance =
  | 'HOSTILE'
  | 'OVERDRAW'
  | 'VERDICT_OVERDRAW'
  | 'NATIVE_ACTION'
  | 'PRISM_SACRIFICE'
  | 'BARRIER'
  | 'PARRY'
  | 'RIFT_WARD'
  | 'SHARD'
  | 'BOON'
  | 'GRAFT'
  | 'REFLECTION'
  | 'MAX_HP'
  | 'HEALING'
  | 'OTHER';

export type OverdrawKind = 'NONE' | 'NORMAL' | 'LAST_HEARTBEAT';

export interface QualifyingHpLossEvent {
  lossEventId: string;
  rootActionId: string | null;
  actualHpRemoved: number;
  currentHpBefore: number;
  currentHpAfter: number;
  maxHpBefore: number;
  maxHpAfter: number;
  provenance: HpLossProvenance;
  classifiedForWake: boolean;
  playerTurnIndex: number;
  enemyCycleIndex: number;
  overdrawKind: OverdrawKind;
  phase: 'PLAYER_TURN' | 'ENEMY_CYCLE' | 'TURN_INIT';
}

export interface SoulwakePacketResult {
  targetId: string;
  damage: number;
  killed: boolean;
  fizzled: boolean;
  fizzleReason: 'PROTECTED_PHASE' | 'INVULNERABLE' | 'NO_LEGAL_TARGET' | null;
  playerFacingLog: string;
}

export interface SoulwakeRuntimeState {
  playerHp: number;
  playerMaxHp: number;
  recordedWake: number;
  activeWake: number;
  activeWakeKind: WakeKind;
  generationId: number;
  activationEnemyCycleIndex: number;
  expireAtEnemyCycleIndex: number;
  residualCarrySourceGenerationId: number | null;
  freshLossSinceResidualCarry: boolean;
  painDividendPaidGenerationId: number | null;
  overdrawUsedThisPlayerTurn: boolean;
  nativeHpCostUsedThisPlayerTurn: boolean;
  hollowEdgeUsedThisPlayerTurn: boolean;
  borrowedNerveUsedThisPlayerTurn: boolean;
  painReflexUsedThisCombatCycle: boolean;
  openConduitUsedThisPlayerTurn: boolean;
  openConduitGainResolvedThisRoot: boolean;
  openConduitSpendResolvedThisRoot: boolean;
  openConduitRootId: string | null;
  playerTurnIndex: number;
  enemyCycleIndex: number;
  playerTurnOpen: boolean;
  enemyCycleOpen: boolean;
  cycleRecorded: number;
  processedLossIds: readonly string[];
  lastHeartbeatSelected: boolean;
  lastHeartbeatRootId: string | null;
  lastHeartbeatPacketRootId: string | null;
  lastOverdrawPaid: number;
  lastOverdrawRequested: number;
  lastDividendHealed: number;
  lastBarrierGranted: number;
  lastApRefund: number;
  lastCooldownAdvanced: boolean;
  lastPackets: readonly SoulwakePacketResult[];
  lastLog: string | null;
  hpPaidThisEncounter: number;
  hpRestoredThisEncounter: number;
}

export interface SoulwakePreviewDelta {
  requestedHp: number;
  actualHp: number;
  hpBefore: number;
  hpAfter: number;
  recordedBefore: number;
  recordedAfter: number;
  activeBefore: number;
  activeAfter: number;
  wakeCap: number;
  kind: WakeKind;
  overflowLost: number;
  hollowEdgeDamage: number;
  borrowedNerveRefund: number;
  borrowedNerveAdvanceCooldown: boolean;
  painReflexBarrier: number;
  openConduitGain: number;
  openConduitPreserved: number;
  lastHeartbeatBudget: number;
  painDividendProjected: number;
}
