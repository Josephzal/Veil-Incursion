import type { SectorId, SectorState, WorldStatePersistedState } from '../types/worldState';
import type { ContractSourceKind } from '../types/contractProcedural';
import {
  buildContractGenerationContext,
  generateContractBoardV2,
  getContractMemory,
  resolveContractSourceWeights,
} from './contractProceduralEngine';
import {
  validateContractBoard,
  formatContractProceduralValidationReport,
} from './contractProceduralValidationEngine';
import { SOURCE_REASON_LABELS } from './contractTemplateVariants';

export function devGenerateContractBoardReport(
  persisted: WorldStatePersistedState,
  sector: SectorState,
): string {
  const { contracts, memory } = generateContractBoardV2({
    deployRunIndex: persisted.deployRunIndex,
    sectorId: sector.id,
    activeOperation: sector.activeOperation,
    activeAnchor: sector.activeAnchor,
    sectorResourceFocus: sector.resourceFocus,
    hazardLevel: sector.hazardLevel,
    rewardLevel: sector.rewardLevel,
    echoActivity: sector.echoActivity,
    recentContractMemory: getContractMemory(persisted),
  });
  const ctx = buildContractGenerationContext({
    deployRunIndex: persisted.deployRunIndex,
    sectorId: sector.id,
    activeOperation: sector.activeOperation,
    activeAnchor: sector.activeAnchor,
    sectorResourceFocus: sector.resourceFocus,
    hazardLevel: sector.hazardLevel,
    rewardLevel: sector.rewardLevel,
    echoActivity: sector.echoActivity,
    recentContractMemory: memory,
  });
  const weights = resolveContractSourceWeights(ctx);
  const lines = [
    `CONTRACT BOARD — ${sector.displayName}`,
    `Operation: ${sector.activeOperation.title} [${sector.activeOperation.objectiveKind}]`,
    `Anchor: ${sector.activeAnchor?.displayName ?? 'none'}`,
    '',
    'SOURCE WEIGHTS',
    ...Object.entries(weights).map(([k, v]) => `  ${SOURCE_REASON_LABELS[k] ?? k}: ${v}`),
    '',
    'CONTRACTS',
  ];
  contracts.forEach((c, i) => {
    lines.push(`${i + 1}. [${c.boundContext?.reason ?? '?'}] ${c.sponsorId} — ${c.title}`);
    lines.push(`   ${c.objectiveText}`);
    lines.push(`   Reward: ${c.reward.credits} CR / ${c.reward.reputation} REP`);
  });
  lines.push('');
  lines.push(formatContractProceduralValidationReport(validateContractBoard(contracts, ctx, sector.id)));
  return lines.join('\n');
}

export function devSimulate20ContractBoards(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  sector: SectorState,
): string {
  const sourceCounts = new Map<ContractSourceKind, number>();
  const kindCounts = new Map<string, number>();
  const titleHashes = new Set<string>();
  let duplicateTitles = 0;

  for (let i = 0; i < 20; i += 1) {
    const { contracts } = generateContractBoardV2({
      deployRunIndex: persisted.deployRunIndex + i,
      sectorId,
      activeOperation: sector.activeOperation,
      activeAnchor: sector.activeAnchor,
      sectorResourceFocus: sector.resourceFocus,
      hazardLevel: sector.hazardLevel,
      rewardLevel: sector.rewardLevel,
      echoActivity: sector.echoActivity,
    });
    contracts.forEach((c) => {
      const reason = c.boundContext?.reason ?? 'WILDCARD';
      sourceCounts.set(reason, (sourceCounts.get(reason) ?? 0) + 1);
      kindCounts.set(c.objectiveKind, (kindCounts.get(c.objectiveKind) ?? 0) + 1);
      if (c.titleHash) {
        if (titleHashes.has(c.titleHash)) duplicateTitles += 1;
        titleHashes.add(c.titleHash);
      }
    });
  }

  const lines = [
    `SIMULATE 20 BOARDS — ${sectorId}`,
    `Total contracts: ${20 * 6}`,
    `Unique title hashes: ${titleHashes.size}`,
    `Duplicate titles across sim: ${duplicateTitles}`,
    '',
    'SOURCE DISTRIBUTION',
    ...[...sourceCounts.entries()].map(([k, n]) => `  ${SOURCE_REASON_LABELS[k] ?? k}: ${n}`),
    '',
    'OBJECTIVE KINDS',
    ...[...kindCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${k}: ${n}`),
  ];
  return lines.join('\n');
}

export function formatContractProceduralReport(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): string {
  const selected = sectors.find((s) => s.id === persisted.selectedSectorId) ?? sectors[0];
  if (!selected) return 'No sector state available.';
  const memory = getContractMemory(persisted);
  const lines = [
    'CONTRACT PROCEDURAL REPORT',
    `Deploy run: ${persisted.deployRunIndex}`,
    `Selected sector: ${selected.displayName}`,
    `Board contracts: ${persisted.contractBoard.contracts.length}`,
    `Memory sponsors tracked: ${Object.keys(memory.recentContractKindsBySponsor).length}`,
    '',
    devGenerateContractBoardReport(persisted, selected),
  ];
  return lines.join('\n');
}
