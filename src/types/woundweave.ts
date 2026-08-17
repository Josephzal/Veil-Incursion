import type { InstinctGrade } from './nineStrain';

export const WOUNDWEAVE_CORE_IDS = {
  SHARED_WOUND: 'WW_CORE_SHARED_WOUND',
  CROSSED_HEX: 'WW_CORE_CROSSED_HEX',
  REFLEXIVE_AGONY: 'WW_CORE_REFLEXIVE_AGONY',
  TIGHTENED_THREAD: 'WW_CORE_TIGHTENED_THREAD',
} as const;

export const WOUNDWEAVE_SUPPORT_IDS = {
  PERSISTENT_STITCH: 'WW_SUPPORT_PERSISTENT_STITCH',
  CASCADING_TEAR: 'WW_SUPPORT_CASCADING_TEAR',
} as const;

export const WOUNDWEAVE_MANIFESTATION_ID = 'WW_MANIFESTATION_ONE_BODY';
export const WOUNDWEAVE_VERDICT_ID = 'WW_VERDICT_COMMON_GRAVE';

export const SELF_LINK_STRENGTH = 0.4;
export const ONE_BODY_SECONDARY_STRENGTH = 0.5;
export const SHARED_WOUND_MIRROR = 0.25;
export const CASCADING_TEAR_BY_DEPTH = { 1: 10, 2: 15, 3: 20 } as const;
export const COMMON_GRAVE_GROUP_SHARE = 0.25;
export const COMMON_GRAVE_LONE_SHARE = 0.12;

export type WoundweavePacketKind = 'MIRROR' | 'PULSE' | 'THREAD' | 'TEAR' | 'GRAVE';

export interface WoundweavePacket {
  targetId: string;
  occultDamage: number;
  kind: WoundweavePacketKind;
  lineage: readonly string[];
  fizzled: boolean;
}

export interface TightenedThreadCharge {
  power: number;
  signal: 'ORDINARY' | 'MAJOR';
  sourceRootId: string;
  linkGeneration: number;
  armedAfterRootId: string;
}

export interface WoundweaveRuntimeState {
  playerTurnIndex: number;
  playerTurnOpen: boolean;
  nextAffectSequence: number;
  linkGeneration: number;
  endpointA: string | null;
  endpointB: string | null;
  selfLink: boolean;
  pendingEndpoint: string | null;
  selfLinkCandidateUnitId: string | null;
  selfLinkCandidateRootId: string | null;
  emptySlotAwaitingRefill: boolean;
  recencyA: number;
  recencyB: number;
  formedPlayerTurn: number;
  expiresAtPlayerTurnStart: number;
  persistent: boolean;
  secondaryEndpointIds: readonly string[];
  tightenedCharge: TightenedThreadCharge | null;
  cascadingUsedThisPlayerTurn: boolean;
  crossedHexUsedThisPlayerTurn: boolean;
  currentGuardUsedThisPlayerTurn: boolean;
  reflexiveUsedThisCombatCycle: boolean;
  phaseSuccessorByUnitId: Record<string, string>;
  lastLog: string | null;
  lastPackets: readonly WoundweavePacket[];
  lastTwofoldFormation: boolean;
  entangledSeededUnitId: string | null;
}

export interface WoundweavePresentation {
  endpointALabel: string | null;
  endpointBLabel: string | null;
  selfLink: boolean;
  durationLabel: string;
  persistent: boolean;
  threadCharge: number | null;
  emptySlot: boolean;
  secondaryCount: number;
  lastLog: string | null;
}
