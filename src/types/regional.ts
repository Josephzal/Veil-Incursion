import { FactionType } from './game';

export type MacroSectorId = 'PACIFIC' | 'MOUNTAIN' | 'CENTRAL' | 'ATLANTIC' | 'THE_ARCHIPELAGO';

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
  polygon: MapPoint[];
  labelAnchor: MapPoint;
  nodeAnchor: MapPoint;
}

export interface MacroSectorDefinition {
  id: MacroSectorId;
  label: string;
  metropolitanNode: string;
  /** Simulated baseline operative traffic density 0–100. */
  baseTrafficDensity: number;
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
