import type { SectorGraphLayoutPoint } from '../utils/sectorGraphLayout';

export const MAX_LEY_MUTATIONS = 5;
export const LEY_BOON_SWAP_HP_COST_PCT = 10;
export const RAW_LEY_BOON_RESONANCE_COST = 20;
export const RAW_LEY_BOON_HP_DEBUFF_PCT = 15;
export const RAW_LEY_BOONS_PER_DISTRICT = 2;
export const RAW_LEY_BOON_MIN_LOCAL_DEPTH = 3;
export const RAW_LEY_BOON_MAX_LOCAL_DEPTH = 7;
export const VEIL_ECHO_PICKUP_RADIUS = 52;
export const RESONANCE_POCKET_RADIUS = 110;
export const RESONANCE_POCKET_RATE_PER_SEC = 2;
export const DIRECTED_PING_RESONANCE_COST = 2;
export const DIRECTED_PING_RANGE = 520;
export const DIRECTED_PING_CONE_RAD = Math.PI / 3;
export const GRID_HOUND_VISION_RANGE = 300;
export const GRID_HOUND_CATCH_RADIUS = 60;
export const GRID_HOUND_SPEED = 260;
export const GRID_HOUND_VISION_CONE_RAD = Math.PI / 2.4;

export type VeilEchoRewardType = 'CREDITS' | 'RESOURCE';

export interface VeilEchoPickup {
  id: string;
  world: SectorGraphLayoutPoint;
  rewardType: VeilEchoRewardType;
  amount: number;
  collected: boolean;
}

export interface ResonancePocket {
  id: string;
  world: SectorGraphLayoutPoint;
  radius: number;
}

export interface RawLeyBoonNode {
  id: string;
  world: SectorGraphLayoutPoint;
  /** Class boon id — LeyLineMutationId, HexShotBoonId, or EnvoyBoonId depending on operative class. */
  boonId: string;
  claimed: boolean;
}

export interface GridHoundState {
  active: boolean;
  world: SectorGraphLayoutPoint;
  facingRad: number;
  caught: boolean;
}

export interface OverworldFeatureSession {
  veilEchoes: VeilEchoPickup[];
  resonancePockets: ResonancePocket[];
  rawLeyBoons: RawLeyBoonNode[];
  gridHound: GridHoundState | null;
  /** Raw boons already claimed this district (max 2 on local depths 3–7). */
  rawBoonsClaimedThisDistrict: number;
}

export function createEmptyOverworldSession(): OverworldFeatureSession {
  return {
    veilEchoes: [],
    resonancePockets: [],
    rawLeyBoons: [],
    gridHound: null,
    rawBoonsClaimedThisDistrict: 0,
  };
}

export interface PendingLeyBoonSwap {
  incomingMutationId: import('./leyLineMutation').LeyLineMutationId;
}

export interface PendingClassBoonSwap {
  classId: import('./game').ClassType;
  incomingBoonId: string;
}
