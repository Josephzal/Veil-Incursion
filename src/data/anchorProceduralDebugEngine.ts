import type { AnchorInstanceModifier } from '../types/anchorProcedural';
import type { SectorId, SectorState, VeilAnchorType, WorldStatePersistedState } from '../types/worldState';
import {
  ensureAllSectorAnchorStates,
  getSectorAnchorState,
  rotateAnchorForSector,
  suppressAnchorForSector,
} from './anchorLifecycleEngine';
import { generateProceduralAnchorInstance } from './anchorProceduralEngine';
import { getSectorAnchorPool } from './anchorSectorPools';
import {
  formatAnchorValidationReport,
  validateAllAnchorPools,
  validateProceduralAnchorInstance,
} from './anchorProceduralValidationEngine';
import { getSectorWorldTemplate, SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';
import { buildSectorState } from './worldStateEngine';

function buildSimContext(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  rotationOffset: number,
) {
  const state = getSectorAnchorState(persisted, sectorId);
  const template = getSectorWorldTemplate(sectorId);
  return {
    seed: `sim:${sectorId}:${rotationOffset}:${persisted.deployRunIndex}`,
    deployRunIndex: persisted.deployRunIndex,
    sectorId,
    sectorDisplayName: template.displayName,
    anchorPool: getSectorAnchorPool(sectorId),
    recentAnchorTypes: state?.recentAnchorTypes ?? [],
    recentAnchorModifiers: state?.recentAnchorModifiers ?? [],
    recentDisplayNameHashes: state?.recentDisplayNameHashes ?? [],
    dormantAnchors: state?.dormantAnchors ?? [],
    rotationIndex: (state?.anchorRotationIndex ?? 0) + rotationOffset,
    sectorResourceFocus: template.resourceFocus,
    hazardLevel: template.hazardLevel,
    rewardLevel: template.rewardLevel,
    echoActivity: template.echoActivity,
  };
}

export function devGenerateAnchorInstance(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): string {
  const withState = ensureAllSectorAnchorStates(persisted);
  const ctx = buildSimContext(withState, sectorId, 1);
  const instance = generateProceduralAnchorInstance(ctx);
  const issues = validateProceduralAnchorInstance(instance, ctx.recentDisplayNameHashes);
  return [
    `GENERATED ANCHOR — ${sectorId}`,
    `ID: ${instance.id}`,
    `Type: ${instance.type}`,
    `Modifier: ${instance.modifier ?? 'none'}`,
    `Display: ${instance.displayName}`,
    `Resources: ${instance.resourceBias.join(', ') || 'none'}`,
    `Operations: ${instance.operationBias.join(', ')}`,
    `Pressure: ${instance.pressureTags.join(', ')}`,
  ].concat(issues.length ? ['', formatAnchorValidationReport(issues)] : []).join('\n');
}

export function devSimulateAnchorRotations(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  count = 10,
): string {
  const types: VeilAnchorType[] = [];
  const modifiers: (AnchorInstanceModifier | null)[] = [];
  const names: string[] = [];
  let backToBackTypes = 0;
  let backToBackMods = 0;

  for (let i = 0; i < count; i += 1) {
    const ctx = buildSimContext(persisted, sectorId, i + 1);
    const instance = generateProceduralAnchorInstance(ctx);
    if (types[types.length - 1] === instance.type) backToBackTypes += 1;
    if (modifiers[modifiers.length - 1] === instance.modifier) backToBackMods += 1;
    types.push(instance.type);
    modifiers.push(instance.modifier);
    names.push(instance.displayName);
  }

  const typeDist = new Map<string, number>();
  types.forEach((t) => typeDist.set(t, (typeDist.get(t) ?? 0) + 1));

  return [
    `SIMULATE ${count} ANCHOR ROTATIONS — ${sectorId}`,
    '',
    ...names.map((n, i) => `${i + 1}. ${n} [${types[i]}${modifiers[i] ? ` / ${modifiers[i]}` : ''}]`),
    '',
    `Type distribution: ${[...typeDist.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`,
    `Back-to-back types: ${backToBackTypes}`,
    `Back-to-back modifiers: ${backToBackMods}`,
    `Unique names: ${new Set(names).size}/${count}`,
  ].join('\n');
}

export function devSimulateAllSectorAnchorRotations(
  persisted: WorldStatePersistedState,
  count = 10,
): string {
  return SECTOR_WORLD_TEMPLATES.map((s) => devSimulateAnchorRotations(persisted, s.id, count)).join('\n\n');
}

export function devForceAnchorRotation(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  options?: { forceType?: VeilAnchorType; forceModifier?: AnchorInstanceModifier | null },
): WorldStatePersistedState {
  return rotateAnchorForSector(persisted, sectorId, 'dev-force', options);
}

export function devSuppressCurrentAnchor(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  runs = 3,
): WorldStatePersistedState {
  const state = getSectorAnchorState(persisted, sectorId);
  if (!state) return persisted;
  return suppressAnchorForSector(
    persisted,
    sectorId,
    state.activeAnchorInstance.id,
    runs,
    'dev-suppress',
  );
}

export function formatAnchorProceduralReport(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): string {
  const poolIssues = validateAllAnchorPools();
  const lines = [
    'ANCHOR PROCEDURAL REPORT',
    '',
    'Active anchors by sector:',
  ];

  sectors.forEach((sector) => {
    const state = getSectorAnchorState(persisted, sector.id);
    const anchor = sector.activeAnchor;
    lines.push(`  ${sector.displayName}: ${anchor?.displayName ?? 'none'} [${anchor?.type ?? '?'}${anchor?.modifier ? ` / ${anchor.modifier}` : ''}]`);
    if (state?.dormantAnchors.length) {
      const dormant = state.dormantAnchors
        .filter((d) => d.remainingRuns > 0)
        .map((d) => `${d.displayName} (${d.remainingRuns}r)`)
        .join(', ');
      if (dormant) lines.push(`    Dormant: ${dormant}`);
    }
    if (anchor?.resourceBias?.length) {
      lines.push(`    Resources: ${anchor.resourceBias.join(', ')}`);
    }
  });

  lines.push('');
  lines.push(`Pool validation: ${poolIssues.length} issue(s)`);
  if (poolIssues.length) {
    lines.push(formatAnchorValidationReport(poolIssues));
  }

  const sim = devSimulateAnchorRotations(persisted, persisted.selectedSectorId, 10);
  lines.push('');
  lines.push(sim);

  return lines.join('\n');
}

export function devPrintSectorAnchorMemory(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): string {
  const state = getSectorAnchorState(persisted, sectorId);
  if (!state) return `No anchor state for ${sectorId}`;
  return [
    `ANCHOR MEMORY — ${sectorId}`,
    `Recent types: ${state.recentAnchorTypes.join(', ') || 'none'}`,
    `Recent modifiers: ${state.recentAnchorModifiers.map((m) => m ?? 'none').join(', ') || 'none'}`,
    `Rotation index: ${state.anchorRotationIndex}`,
    `Dormant history: ${state.dormantAnchors.map((d) => `${d.displayName}(${d.remainingRuns})`).join(', ') || 'none'}`,
  ].join('\n');
}

export function buildAllSectorsForAnchorReport(
  persisted: WorldStatePersistedState,
): SectorState[] {
  return SECTOR_WORLD_TEMPLATES.map((t) =>
    buildSectorState(t.id, ensureAllSectorAnchorStates(persisted), persisted.operationProgress),
  );
}
