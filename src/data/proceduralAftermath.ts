/** Procedural Sector Aftermath v1 — public API surface. */
export type {
  AftermathDebriefLine,
  AftermathGenerationResult,
  AftermathScannerBiasDelta,
  AftermathStackMode,
  RunAftermathInput,
  SectorAftermathModifier,
  SectorAftermathSource,
  SectorAftermathTag,
  SectorAftermathType,
  WorldStateAftermathMeta,
} from '../types/proceduralAftermath';

export { MAX_SECTOR_AFTERMATH_MODIFIERS } from '../types/proceduralAftermath';

export {
  applyAftermathFromRun,
  applySectorAftermathToBrief,
  buildAftermathDebriefLines,
  expireAllSectorAftermath,
  formatActiveAftermathChips,
  formatAftermathDebriefStrings,
  generateAftermathFromRun,
  getSectorAftermathModifiers,
  mergeSectorAftermath,
  tickSectorAftermathForSector,
} from './proceduralAftermathEngine';

export { AFTERMATH_RULES, buildModifierFromRule, forceAftermathModifier } from './proceduralAftermathCatalog';

export { buildRunAftermathInputFromDebrief, buildRunAftermathInputFromIncursion } from './proceduralAftermathDebriefAdapter';

export {
  formatAftermathValidationReport,
  validateAllSectorAftermath,
  validateSectorAftermathModifier,
  validateSectorAftermathState,
} from './proceduralAftermathValidationEngine';

export {
  devAftermathValidationReport,
  devForceSectorAftermath,
  devSimulate10RunAftermathCycle,
  devSimulateAftermathCreation,
  devSimulateAftermathFromPayload,
} from './proceduralAftermathDebugEngine';
