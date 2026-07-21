/**
 * @deprecated Prefer veilFrontMapGeometry — Figma-traced paths + 1672×941 map base.
 * Compatibility re-exports for existing imports.
 */
export {
  SHOW_SECTOR_DEBUG,
  MAP_PATH_DEBUG,
  VEIL_FRONT_MAP_VIEWBOX,
  VEIL_FRONT_CONTINENT_VIEWBOX,
  VEIL_FRONT_SECTOR_PATHS,
  VEIL_FRONT_MAP_SECTORS,
  VEIL_FRONT_SECTOR_ORDER as CONTINENT_SECTOR_ORDER,
  getVeilFrontMapSector,
  veilFrontClipId,
  pointsToClosedPath,
  continentKeyForSectorId,
  type MapPoint,
  type VeilFrontMapSectorDef,
  type VeilFrontSectorKey as ContinentSectorKey,
} from './veilFrontMapGeometry';
