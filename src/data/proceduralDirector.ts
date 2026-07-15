/** Procedural Director v1 — public API surface. */
export type {
  CrisisManifestationResult,
  DirectedRunWorldBriefResult,
  PostRunAftermathInput,
  ProceduralDirectorAdjustment,
  ProceduralDirectorContext,
  ProceduralDirectorIssue,
  ProceduralDirectorResult,
  ProceduralExplainabilitySummary,
  ProceduralManifestation,
  ProceduralRepeatReport,
  RunPressureLabel,
  RunPressureScore,
  SectorAftermathModifier,
  SectorAftermathSource,
} from '../types/proceduralDirector';

export {
  MAX_DIRECTOR_PASSES,
  MAX_SECTOR_AFTERMATH_MODIFIERS,
} from '../types/proceduralDirector';

export {
  directRunWorldBrief,
  validateRunWorldBriefDirector,
  scoreRunPressure,
  ensureCrisisManifestation,
  applyProceduralSafetyCaps,
  buildProceduralExplainabilityText,
  generateSectorAftermath,
  generateAftermathFromRun,
  mergeSectorAftermath,
  tickSectorAftermathForSector,
  tickSectorAftermathModifiers,
  applySectorAftermathToBrief,
  getSectorAftermathModifiers,
  applyAftermathFromRun,
  applyAftermathFromDebrief,
  expireAllSectorAftermath,
  buildAftermathDebriefLines,
  formatAftermathDebriefStrings,
} from './proceduralDirectorEngine';
