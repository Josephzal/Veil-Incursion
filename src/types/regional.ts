import { FactionType } from './game';

export type ContinentCode = 'NA' | 'SA' | 'EU' | 'AF' | 'AS' | 'OC';

export type MacroSectorId =
  | 'PACIFIC'
  | 'CASCADIA'
  | 'HEARTLAND'
  | 'ATLANTIC'
  | 'NEO-MEX'
  | 'AMAZONIA'
  | 'ANDEAN CORDON'
  | 'PATAGONIA'
  | 'NORDIC SPRAWL'
  | 'WESTERN BLOC'
  | 'SLAVIC GRID'
  | 'SAHARA EXPANSE'
  | 'CONGO BASIN'
  | 'CAPE SECTOR'
  | 'SIBERIAN WASTES'
  | 'SINO-GRID'
  | 'DUNE SEA'
  | 'INDO-TRACT'
  | 'PACIFIC RIM'
  | 'OUTBACK CORDON';

export interface CabalInfluenceBalance {
  TERRAN_GRID: number;
  LEGION: number;
  SOLARIS: number;
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface SectorMapGeometry {
  path: string;
  polygon: MapPoint[];
  labelAnchor: MapPoint;
  nodeAnchor: MapPoint;
}

export interface MacroSectorDefinition {
  id: MacroSectorId;
  label: string;
  continent: ContinentCode;
  metropolitanNode: string;
  /** Simulated baseline operative traffic density 0–100. */
  baseTrafficDensity: number;
  defaultFaction: FactionType;
  influence: CabalInfluenceBalance;
  mapGeometry: SectorMapGeometry;
}

export interface RegionalPresenceState {
  homeMacroSector: MacroSectorId;
  metropolitanNode: string;
  /** Exclusive localized weapon coating purchase slots unlocked by Shatter victories. */
  weaponCoatingUnlocks: string[];
}

export interface MagnetismState {
  sectorId: MacroSectorId;
  localTrafficDensity: number;
  isWeakLocalSignal: boolean;
  proxyMetropolitanNode: string | null;
  influence: CabalInfluenceBalance;
  isInfluenceFrozen: boolean;
}

export interface ShatterSectorResult {
  sectorId: MacroSectorId;
  frozenInfluence: CabalInfluenceBalance;
  victoriousFaction: FactionType;
}
