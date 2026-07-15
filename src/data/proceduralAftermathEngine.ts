import type { SectorId, WorldStatePersistedState } from '../types/worldState';
import type { RunWorldBrief } from '../types/runWorldBrief';
import type {
  AftermathDebriefLine,
  AftermathGenerationResult,
  RunAftermathInput,
  SectorAftermathModifier,
} from '../types/proceduralAftermath';
import { MAX_SECTOR_AFTERMATH_MODIFIERS } from '../types/proceduralAftermath';
import { AFTERMATH_RULES, buildModifierFromRule } from './proceduralAftermathCatalog';
import { clampMultiplier } from './runWorldBriefBiasEngine';

const LEGACY_SOURCE_STACK: Record<string, string> = {
  ECHO_CLEARED: 'echo_activity_quieted',
  RESOURCE_OVERHARVESTED: 'resource_veins_exposed',
};

function normalizeLegacyModifier(mod: SectorAftermathModifier): SectorAftermathModifier {
  const stackKey = mod.stackKey
    ?? LEGACY_SOURCE_STACK[mod.source]
    ?? mod.type?.toLowerCase()
    ?? mod.source.toLowerCase();
  const rule = AFTERMATH_RULES.find((r) => r.stackKey === stackKey || r.type === mod.type);
  return {
    ...mod,
    type: mod.type ?? rule?.type ?? 'SECTOR_FATIGUE',
    stackKey,
    stackMode: mod.stackMode ?? rule?.stackMode ?? 'refresh',
    intensity: mod.intensity ?? 1,
    createdAtRunIndex: mod.createdAtRunIndex ?? 0,
    tags: mod.tags?.length ? mod.tags : rule?.tags ?? [],
  };
}

export function getSectorAftermathModifiers(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): SectorAftermathModifier[] {
  return (persisted.sectorAftermathModifiersBySector?.[sectorId] ?? []).map(normalizeLegacyModifier);
}

export function generateAftermathFromRun(input: RunAftermathInput): AftermathGenerationResult {
  const created: SectorAftermathModifier[] = [];
  const seenStackKeys = new Set<string>();

  AFTERMATH_RULES.forEach((rule) => {
    if (seenStackKeys.has(rule.stackKey)) return;
    const mod = buildModifierFromRule(rule, input);
    if (!mod) return;
    seenStackKeys.add(rule.stackKey);
    created.push(mod);
  });

  return {
    created,
    refreshed: [],
    removedByCap: [],
    runId: input.runId,
  };
}

/** @deprecated Use generateAftermathFromRun */
export function generateSectorAftermath(input: RunAftermathInput): SectorAftermathModifier[] {
  return generateAftermathFromRun(input).created;
}

function intensifyModifier(
  existing: SectorAftermathModifier,
  incoming: SectorAftermathModifier,
): SectorAftermathModifier {
  const nextIntensity = Math.min(3, existing.intensity + 1) as 1 | 2 | 3;
  return {
    ...incoming,
    id: existing.id,
    intensity: nextIntensity,
    remainingRuns: Math.max(existing.remainingRuns, incoming.durationRuns),
    durationRuns: Math.max(existing.durationRuns, incoming.durationRuns),
    generationDebug: {
      triggeringEvents: [
        ...(existing.generationDebug?.triggeringEvents ?? []),
        ...(incoming.generationDebug?.triggeringEvents ?? []),
      ],
      appliedRules: [
        ...(existing.generationDebug?.appliedRules ?? []),
        ...(incoming.generationDebug?.appliedRules ?? []),
      ],
    },
  };
}

export function mergeSectorAftermath(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  incoming: SectorAftermathModifier[],
): { persisted: WorldStatePersistedState; refreshed: SectorAftermathModifier[]; removedByCap: SectorAftermathModifier[] } {
  if (!incoming.length) {
    return { persisted, refreshed: [], removedByCap: [] };
  }

  const existing = getSectorAftermathModifiers(persisted, sectorId);
  const refreshed: SectorAftermathModifier[] = [];

  incoming.forEach((mod) => {
    const dupIdx = existing.findIndex((e) => e.stackKey === mod.stackKey);
    if (dupIdx >= 0) {
      const prev = existing[dupIdx]!;
      const merged = mod.stackMode === 'intensify'
        ? intensifyModifier(prev, mod)
        : { ...mod, id: prev.id, remainingRuns: mod.durationRuns };
      existing[dupIdx] = merged;
      refreshed.push(merged);
    } else {
      existing.push(mod);
    }
  });

  const removedByCap: SectorAftermathModifier[] = [];
  while (existing.length > MAX_SECTOR_AFTERMATH_MODIFIERS) {
    const removed = existing.shift();
    if (removed) removedByCap.push(removed);
  }

  return {
    persisted: {
      ...persisted,
      sectorAftermathModifiersBySector: {
        ...persisted.sectorAftermathModifiersBySector,
        [sectorId]: existing,
      },
    },
    refreshed,
    removedByCap,
  };
}

/** Tick aftermath for the sector that just completed a run — not all sectors. */
export function tickSectorAftermathForSector(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): WorldStatePersistedState {
  const current = persisted.sectorAftermathModifiersBySector?.[sectorId];
  if (!current?.length) return persisted;

  const next = current
    .map((m) => ({ ...m, remainingRuns: m.remainingRuns - 1 }))
    .filter((m) => m.remainingRuns > 0);

  const bySector = { ...persisted.sectorAftermathModifiersBySector };
  if (next.length) {
    bySector[sectorId] = next;
  } else {
    delete bySector[sectorId];
  }

  return { ...persisted, sectorAftermathModifiersBySector: bySector };
}

/** @deprecated Prefer tickSectorAftermathForSector — global tick expires inactive sectors early. */
export function tickSectorAftermathModifiers(
  persisted: WorldStatePersistedState,
): WorldStatePersistedState {
  return tickSectorAftermathForSector(persisted, persisted.selectedSectorId);
}

export function applySectorAftermathToBrief(
  brief: RunWorldBrief,
  aftermathModifiers: SectorAftermathModifier[],
): RunWorldBrief {
  const active = aftermathModifiers.filter((m) => m.remainingRuns > 0);
  if (!active.length) return brief;

  let next: RunWorldBrief = {
    ...brief,
    scannerBias: {
      ...brief.scannerBias,
      overlayBias: { ...brief.scannerBias.overlayBias },
      anchorSignalMultiplier: brief.scannerBias.anchorSignalMultiplier,
      echoSignalMultiplier: brief.scannerBias.echoSignalMultiplier,
      operationSignalMultiplier: brief.scannerBias.operationSignalMultiplier,
      highRiskMultiplier: brief.scannerBias.highRiskMultiplier,
      highValueResourceMultiplier: brief.scannerBias.highValueResourceMultiplier,
    },
    encounterBias: {
      ...brief.encounterBias,
      favoredModifiers: { ...brief.encounterBias.favoredModifiers },
      twistedTemplateWeights: { ...brief.encounterBias.twistedTemplateWeights },
      rivalMercWeight: brief.encounterBias.rivalMercWeight,
      eliteWeight: brief.encounterBias.eliteWeight,
      unstableCargoWeight: brief.encounterBias.unstableCargoWeight,
    },
    rewardBias: { ...brief.rewardBias },
    contractBias: { ...brief.contractBias },
    operationBias: {
      ...brief.operationBias,
      preferredObjectiveKinds: [...(brief.operationBias.preferredObjectiveKinds ?? [])],
    },
    threatProfile: { ...brief.threatProfile },
    generationDebug: {
      ...brief.generationDebug,
      appliedAftermathIds: active.map((m) => m.id),
    },
  };

  active.forEach((mod) => {
    if (mod.scannerBiasDelta?.anchorSignalMultiplier) {
      next.scannerBias.anchorSignalMultiplier = clampMultiplier(
        next.scannerBias.anchorSignalMultiplier * mod.scannerBiasDelta.anchorSignalMultiplier,
      );
    }
    if (mod.scannerBiasDelta?.echoSignalMultiplier) {
      next.scannerBias.echoSignalMultiplier = clampMultiplier(
        next.scannerBias.echoSignalMultiplier * mod.scannerBiasDelta.echoSignalMultiplier,
      );
    }
    if (mod.scannerBiasDelta?.overlayBias) {
      Object.entries(mod.scannerBiasDelta.overlayBias).forEach(([k, v]) => {
        const key = k as keyof typeof next.scannerBias.overlayBias;
        if (typeof v !== 'number') return;
        if (key === 'extractionUncertainty' || key === 'scannerLabelDegrade') {
          next.scannerBias.overlayBias[key] = Math.min(0.35, Math.max(0, next.scannerBias.overlayBias[key] + v));
        } else if (next.scannerBias.overlayBias[key] != null) {
          next.scannerBias.overlayBias[key] = clampMultiplier(next.scannerBias.overlayBias[key] * v);
        }
      });
    }
    if (mod.encounterBiasDelta?.rivalMercWeight) {
      next.encounterBias.rivalMercWeight = clampMultiplier(
        next.encounterBias.rivalMercWeight * mod.encounterBiasDelta.rivalMercWeight,
      );
    }
    if (mod.encounterBiasDelta?.eliteWeight) {
      next.encounterBias.eliteWeight = clampMultiplier(
        next.encounterBias.eliteWeight * mod.encounterBiasDelta.eliteWeight,
      );
    }
    if (mod.encounterBiasDelta?.unstableCargoWeight) {
      next.encounterBias.unstableCargoWeight = clampMultiplier(
        next.encounterBias.unstableCargoWeight * mod.encounterBiasDelta.unstableCargoWeight,
      );
    }
    if (mod.encounterBiasDelta?.favoredModifiers) {
      Object.entries(mod.encounterBiasDelta.favoredModifiers).forEach(([id, mult]) => {
        const key = id as keyof typeof next.encounterBias.favoredModifiers;
        const cur = next.encounterBias.favoredModifiers[key] ?? 1;
        next.encounterBias.favoredModifiers[key] = clampMultiplier(cur * (mult ?? 1));
      });
    }
    if (mod.rewardBiasDelta) {
      Object.entries(mod.rewardBiasDelta).forEach(([k, v]) => {
        const key = k as keyof typeof next.rewardBias;
        if (typeof v === 'number') {
          next.rewardBias[key] = clampMultiplier(next.rewardBias[key] * v);
        }
      });
    }
    if (mod.threatProfileDelta) {
      const numericKeys = [
        'rivalPressure', 'echoPressure', 'anchorPressure', 'extractionPressure',
        'resourcePressure', 'containmentPressure', 'mirrorPressure', 'unstablePressure',
      ] as const;
      numericKeys.forEach((k) => {
        const v = mod.threatProfileDelta?.[k];
        if (typeof v === 'number') {
          next.threatProfile[k] = Math.min(100, Math.max(0, next.threatProfile[k] + v));
        }
      });
    }
    if (mod.operationBiasDelta?.preferredObjectiveKinds?.length) {
      const kinds = mod.operationBiasDelta.preferredObjectiveKinds;
      next.operationBias = {
        ...next.operationBias,
        preferredObjectiveKinds: [
          ...kinds,
          ...(next.operationBias.preferredObjectiveKinds ?? []).filter((k) => !kinds.includes(k)),
        ],
      };
    }
  });

  return next;
}

export function buildAftermathDebriefLines(
  result: AftermathGenerationResult,
): AftermathDebriefLine[] {
  const lines: AftermathDebriefLine[] = [];
  result.created.forEach((m) => {
    lines.push({
      kind: 'new',
      displayName: m.displayName,
      description: m.description,
      remainingRuns: m.remainingRuns,
      intensity: m.intensity,
    });
  });
  result.refreshed.forEach((m) => {
    if (result.created.some((c) => c.stackKey === m.stackKey)) return;
    lines.push({
      kind: 'refreshed',
      displayName: m.displayName,
      description: m.description,
      remainingRuns: m.remainingRuns,
      intensity: m.intensity,
    });
  });
  result.removedByCap.forEach((m) => {
    lines.push({
      kind: 'expired',
      displayName: m.displayName,
      description: `${m.displayName} displaced by newer sector aftermath.`,
      remainingRuns: 0,
      intensity: m.intensity,
    });
  });
  return lines;
}

export function formatActiveAftermathChips(modifiers: SectorAftermathModifier[]): string[] {
  return modifiers
    .filter((m) => m.remainingRuns > 0)
    .map((m) => {
      const intensity = m.intensity > 1 ? ` (intensity ${m.intensity})` : '';
      return `${m.displayName}${intensity} — ${m.remainingRuns} run${m.remainingRuns === 1 ? '' : 's'} remaining`;
    });
}

export function formatAftermathDebriefStrings(lines: AftermathDebriefLine[]): string[] {
  return lines.map((line) => {
    const tag = line.kind === 'new' ? 'New'
      : line.kind === 'refreshed' ? 'Refreshed'
        : 'Expired';
    const intensity = line.intensity > 1 ? ` (intensity ${line.intensity})` : '';
    const duration = line.remainingRuns > 0 ? ` — ${line.remainingRuns} run(s)` : '';
    return `${tag}: ${line.displayName}${intensity}${duration}`;
  });
}

export function applyAftermathFromRun(
  persisted: WorldStatePersistedState,
  input: RunAftermathInput,
): { persisted: WorldStatePersistedState; result: AftermathGenerationResult } {
  if (persisted.aftermathMeta?.lastAftermathRunId === input.runId) {
    return {
      persisted,
      result: { created: [], refreshed: [], removedByCap: [], runId: input.runId },
    };
  }

  const generation = generateAftermathFromRun(input);
  if (!generation.created.length) {
    return {
      persisted: {
        ...persisted,
        aftermathMeta: { lastAftermathRunId: input.runId },
      },
      result: generation,
    };
  }

  const merged = mergeSectorAftermath(persisted, input.sectorId, generation.created);
  return {
    persisted: {
      ...merged.persisted,
      aftermathMeta: { lastAftermathRunId: input.runId },
    },
    result: {
      ...generation,
      refreshed: merged.refreshed,
      removedByCap: merged.removedByCap,
    },
  };
}

/** @deprecated Use applyAftermathFromRun with RunAftermathInput */
export function applyAftermathFromDebrief(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  opts: Partial<RunAftermathInput>,
): { persisted: WorldStatePersistedState; created: SectorAftermathModifier[] } {
  const input: RunAftermathInput = {
    sectorId,
    deployRunIndex: persisted.deployRunIndex,
    runId: `legacy-${sectorId}-${persisted.deployRunIndex}`,
    runCompleted: true,
    extracted: true,
    died: false,
    ...opts,
  };
  const { persisted: next, result } = applyAftermathFromRun(persisted, input);
  return { persisted: next, created: result.created };
}

export function expireAllSectorAftermath(
  persisted: WorldStatePersistedState,
): WorldStatePersistedState {
  return {
    ...persisted,
    sectorAftermathModifiersBySector: {},
    aftermathMeta: {},
  };
}
