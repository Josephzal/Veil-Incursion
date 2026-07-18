import type { ResourceDepthIndex, ResourceItemId, ResourceRarity } from './resourceItem';
import type { SectorId } from './worldState';
import type { BreachGradeId } from './progression';

/**
 * Phase 2F — reward packets.
 * Nodes emit typed packets; depth (2E) and sector tables (2D) gate what each packet can roll.
 */

export type ResourceRewardPacketType =
  | 'STABLE'
  | 'SECTOR'
  | 'SECTOR_STABLE'
  | 'INTEL'
  | 'RARE'
  | 'UNSTABLE'
  | 'CONTRABAND'
  | 'CONTRACT'
  | 'OPERATION'
  | 'ECHO'
  | 'ANCHOR'
  | 'APEX';

export type ResourceRewardRarityBias = Extract<
  ResourceRarity,
  'COMMON' | 'UNCOMMON' | 'RARE' | 'APEX'
>;

export type RewardNodeKind =
  | 'NORMAL_COMBAT'
  | 'ELITE_COMBAT'
  | 'RESOURCE_ANOMALY'
  | 'ANCHOR_SIGNAL'
  | 'ECHO_SIGNAL'
  | 'BOSS';

export interface ResourceRewardPacket {
  packetType: ResourceRewardPacketType;
  rolls: number;
  rarityBias: ResourceRewardRarityBias;
  sectorBias?: SectorId | null;
  allowUnstable: boolean;
  allowContraband: boolean;
  minDepth: ResourceDepthIndex;
  /** 0–1 chance the packet fires. Default 1. */
  fireChance?: number;
  note?: string;
}

export interface ExtractedYieldBand {
  id: string;
  label: string;
  stable: readonly [number, number];
  intelRare: readonly [number, number];
  unstable: readonly [number, number];
  contrabandApex: readonly [number, number];
}

export interface BreachGradePacketQuality {
  grade: BreachGradeId;
  /** Credit / value intent — not a pile multiplier. */
  valueMultiplier: number;
  sectorPacketBonusChance: number;
  rarePacketBonusChance: number;
  intelPacketBonusChance: number;
  unstablePacketBonusChance: number;
  contrabandPacketBonusChance: number;
  summary: string;
}

export interface ResourceRewardPacketRollResult {
  resourceIds: ResourceItemId[];
  packetsFired: ResourceRewardPacket[];
  packetsSkipped: ResourceRewardPacket[];
}
