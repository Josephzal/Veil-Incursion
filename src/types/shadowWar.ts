import type { FactionType } from './game';
import type { MapPoint, SectorMapGeometry } from './regional';
import type { ResourceItemId } from './resourceItem';

export type ShadowWarSectorId =
  | 'THE_SLAG_WORKS'
  | 'THE_ABYSSAL_SINK'
  | 'THE_NULL_ZONE'
  | 'THE_BLACKLINE_TERMINUS'
  | 'THE_ASHEN_WASTES';

export type ShadowWarBuffId =
  | 'KINETIC_ARMOR_PLUS_1'
  | 'MAX_HP_PLUS_10'
  | 'RARE_LOOT_PLUS_10'
  | 'BLACK_MARKET_DISCOUNT_15'
  | 'FIRST_TURN_AP_PLUS_1';

export type SectorControlStatus = 'SECURED' | 'CONTESTED';

export type ShadowWarRewardTier = 0 | 1 | 2 | 3;

export interface CabalIpPool {
  TERRAN_GRID: number;
  LEGION: number;
  SOLARIS: number;
}

export interface ShadowWarSectorDefinition {
  id: ShadowWarSectorId;
  label: string;
  buffSummary: string;
  buffId: ShadowWarBuffId;
  mapGeometry: SectorMapGeometry;
  defaultIp: CabalIpPool;
}

export interface SectorControlResult {
  status: SectorControlStatus;
  controllingFaction: FactionType | null;
  displayInfluence: CabalIpPool;
  totalIp: number;
  margin: number;
}

export interface ShadowWarPersistedState {
  sectorIp: Record<ShadowWarSectorId, CabalIpPool>;
  weeklyDonatedIP: number;
  donationLog: string[];
  cycleWeekId: string;
  lastRewardTier: ShadowWarRewardTier;
}

export interface ShadowWarDonationDraft {
  items: Partial<Record<ResourceItemId, number>>;
  /** Veil Residue drawn from the operative vault (not resource stash). */
  veilResidue?: number;
}

export interface ShadowWarCycleReward {
  tier: ShadowWarRewardTier;
  logLines: string[];
  creditGrant: number;
  resourceGrants: Partial<Record<ResourceItemId, number>>;
}
