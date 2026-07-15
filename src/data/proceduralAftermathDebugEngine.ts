import type { SectorId, WorldStatePersistedState } from '../types/worldState';
import type { SectorAftermathType } from '../types/proceduralAftermath';
import { forceAftermathModifier } from './proceduralAftermathCatalog';
import {
  applyAftermathFromRun,
  generateAftermathFromRun,
  getSectorAftermathModifiers,
  mergeSectorAftermath,
  tickSectorAftermathForSector,
} from './proceduralAftermathEngine';
import { buildRunAftermathInputFromDebrief } from './proceduralAftermathDebriefAdapter';
import type { OperationDebriefPayload } from './runDebriefEngine';
import { formatAftermathValidationReport, validateAllSectorAftermath } from './proceduralAftermathValidationEngine';

export function devForceSectorAftermath(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  type: SectorAftermathType,
): { persisted: WorldStatePersistedState; report: string } {
  const mod = forceAftermathModifier(sectorId, type, persisted.deployRunIndex);
  if (!mod) {
    return { persisted, report: `Unknown aftermath type: ${type}` };
  }
  const merged = mergeSectorAftermath(persisted, sectorId, [mod]);
  return {
    persisted: merged.persisted,
    report: `Forced ${mod.displayName} on ${sectorId} (${mod.durationRuns} runs, intensity ${mod.intensity}).`,
  };
}

export function devSimulateAftermathFromPayload(
  persisted: WorldStatePersistedState,
  payload: OperationDebriefPayload,
): string {
  const input = buildRunAftermathInputFromDebrief(payload, persisted);
  const result = generateAftermathFromRun(input);
  return [
    'AFTERMATH FROM DEBRIEF SIM',
    `Run: ${input.runId}`,
    `Matched rules: ${result.created.length}`,
    ...result.created.map((m) => `  • [${m.type}] ${m.displayName} (${m.durationRuns}r, i${m.intensity})`),
    '',
    formatAftermathValidationReport(validateAllSectorAftermath(persisted)),
  ].join('\n');
}

export function devSimulateAftermathCreation(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): { persisted: WorldStatePersistedState; report: string } {
  const input = {
    sectorId,
    deployRunIndex: persisted.deployRunIndex,
    runId: `sim-${sectorId}-${Date.now()}`,
    runCompleted: true,
    extracted: true,
    died: false,
    echoNodesResolved: 3,
    anchorSuppressed: true,
    operationCompleted: true,
    dirtyExtractionsUsed: 2,
    unstableCargoExtracted: 1,
    resourceStressMatched: true,
    falseExtractionsStabilized: 1,
    contrabandExtracted: 1,
    appraisableCargoExtracted: 1,
    elitesDefeated: 2,
    bossesDefeated: 1,
    completedOperationKind: 'RESOURCE_SURVEY' as const,
  };
  const { persisted: next, result } = applyAftermathFromRun(persisted, input);
  const active = getSectorAftermathModifiers(next, sectorId);
  const report = [
    'AFTERMATH SIMULATION',
    `Created ${result.created.length} modifier(s):`,
    ...result.created.map((m) => `  • [${m.type}] ${m.displayName} (${m.durationRuns} runs, i${m.intensity})`),
    `Refreshed: ${result.refreshed.length}`,
    `Removed by cap: ${result.removedByCap.length}`,
    `Active on sector after merge: ${active.length}`,
    '',
    formatAftermathValidationReport(validateAllSectorAftermath(next)),
  ].join('\n');
  return { persisted: next, report };
}

export function devSimulate10RunAftermathCycle(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): string {
  let state = persisted;
  const log: string[] = ['10-RUN AFTERMATH CYCLE', `Sector: ${sectorId}`, ''];

  for (let i = 0; i < 10; i += 1) {
    const input = {
      sectorId,
      deployRunIndex: state.deployRunIndex + i,
      runId: `cycle-${sectorId}-${i}`,
      runCompleted: true,
      extracted: i % 3 !== 2,
      died: i % 3 === 2,
      dirtyExtractionsUsed: i % 4 === 0 ? 1 : 0,
      echoNodesResolved: i % 2,
      operationCompleted: i % 5 === 0,
      unstableCargoExtracted: i % 3 === 1 ? 1 : 0,
    };
    const applied = applyAftermathFromRun(state, input);
    state = applied.persisted;
    state = tickSectorAftermathForSector({ ...state, selectedSectorId: sectorId }, sectorId);
    const active = getSectorAftermathModifiers(state, sectorId);
    log.push(`Run ${i + 1}: +${applied.result.created.length} created, ${active.length} active`);
  }

  log.push('', formatAftermathValidationReport(validateAllSectorAftermath(state)));
  return log.join('\n');
}

export function devAftermathValidationReport(persisted: WorldStatePersistedState): string {
  return formatAftermathValidationReport(validateAllSectorAftermath(persisted));
}
