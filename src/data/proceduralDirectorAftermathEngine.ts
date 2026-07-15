/** Re-exports procedural aftermath v1 — Phase 5 integration surface. */
export {
  getSectorAftermathModifiers,
  generateAftermathFromRun,
  generateSectorAftermath,
  mergeSectorAftermath,
  tickSectorAftermathForSector,
  tickSectorAftermathModifiers,
  applySectorAftermathToBrief,
  applyAftermathFromRun,
  applyAftermathFromDebrief,
  expireAllSectorAftermath,
  buildAftermathDebriefLines,
  formatAftermathDebriefStrings,
  formatActiveAftermathChips,
} from './proceduralAftermathEngine';

export { buildRunAftermathInputFromDebrief, buildRunAftermathInputFromIncursion } from './proceduralAftermathDebriefAdapter';

export {
  validateSectorAftermathModifier,
  validateSectorAftermathState,
  validateAllSectorAftermath,
  formatAftermathValidationReport,
} from './proceduralAftermathValidationEngine';

export {
  devForceSectorAftermath,
  devSimulateAftermathFromPayload,
  devSimulateAftermathCreation,
  devSimulate10RunAftermathCycle,
  devAftermathValidationReport,
} from './proceduralAftermathDebugEngine';
