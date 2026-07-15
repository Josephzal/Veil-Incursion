import type {
  RunEncounterBias,
  RunRewardBias,
  RunScannerBias,
  RunScannerOverlayBias,
  RunWorldBriefDepthBias,
} from '../types/runWorldBrief';
import type { AnchorScannerBias } from '../types/anchorProcedural';
import type { ScannerSignalBias } from '../types/worldState';
import type { CrisisThemeDefinition } from './crisisThemeCatalog';

const OVERLAY_CLAMP = { min: 0.5, max: 1.6 };
const MULT_CLAMP = { min: 0.6, max: 1.5 };

export function clampMultiplier(value: number, min = MULT_CLAMP.min, max = MULT_CLAMP.max): number {
  return Math.min(max, Math.max(min, value));
}

export function clampOverlayWeight(value: number): number {
  return Math.min(OVERLAY_CLAMP.max, Math.max(OVERLAY_CLAMP.min, value));
}

export function combineOverlayBias(
  base: RunScannerOverlayBias,
  theme: Partial<RunScannerOverlayBias>,
): RunScannerOverlayBias {
  return {
    anchorSignal: clampOverlayWeight(base.anchorSignal * (theme.anchorSignal ?? 1)),
    echoSignal: clampOverlayWeight(base.echoSignal * (theme.echoSignal ?? 1)),
    operationTarget: clampOverlayWeight(base.operationTarget * (theme.operationTarget ?? 1)),
    highRisk: clampOverlayWeight(base.highRisk * (theme.highRisk ?? 1)),
    highValueResource: clampOverlayWeight(base.highValueResource * (theme.highValueResource ?? 1)),
    extraction: clampOverlayWeight(base.extraction * (theme.extraction ?? 1)),
    scannerLabelDegrade: Math.min(0.35, base.scannerLabelDegrade + (theme.scannerLabelDegrade ?? 0)),
    extractionUncertainty: Math.min(0.35, base.extractionUncertainty + (theme.extractionUncertainty ?? 0)),
  };
}

export function defaultRunScannerOverlayBias(): RunScannerOverlayBias {
  return {
    anchorSignal: 1,
    echoSignal: 1,
    operationTarget: 1,
    highRisk: 1,
    highValueResource: 1,
    extraction: 1,
    scannerLabelDegrade: 0,
    extractionUncertainty: 0,
  };
}

export function combineScannerBias(
  sectorBaseline: ScannerSignalBias,
  anchorScanner?: AnchorScannerBias | null,
  themeDef?: CrisisThemeDefinition,
  operationOverlayBoost?: Partial<RunScannerOverlayBias>,
): RunScannerBias {
  const anchorMult = anchorScanner ?? {
    anchorSignalMultiplier: sectorBaseline.anchorSignalMultiplier,
    echoSignalMultiplier: sectorBaseline.echoSignalMultiplier,
    operationSignalMultiplier: sectorBaseline.operationSignalMultiplier,
    highRiskMultiplier: sectorBaseline.highRiskMultiplier,
    highValueResourceMultiplier: 1,
    extractionUncertainty: 0,
    scannerLabelDegradeChance: 0,
  };

  let overlay = defaultRunScannerOverlayBias();
  if (themeDef?.scannerOverlays) {
    overlay = combineOverlayBias(overlay, themeDef.scannerOverlays as Partial<RunScannerOverlayBias>);
  }
  if (operationOverlayBoost) {
    overlay = combineOverlayBias(overlay, operationOverlayBoost);
  }

  return {
    anchorSignalMultiplier: clampMultiplier(anchorMult.anchorSignalMultiplier),
    echoSignalMultiplier: clampMultiplier(anchorMult.echoSignalMultiplier),
    operationSignalMultiplier: clampMultiplier(anchorMult.operationSignalMultiplier),
    highRiskMultiplier: clampMultiplier(anchorMult.highRiskMultiplier),
    highValueResourceMultiplier: clampMultiplier(anchorMult.highValueResourceMultiplier ?? 1),
    overlayBias: overlay,
  };
}

export function combineEncounterBias(
  anchorFavored: RunEncounterBias['favoredModifiers'],
  anchorTwisted: RunEncounterBias['twistedTemplateWeights'],
  themeDef?: CrisisThemeDefinition,
  rivalBoost = 0,
): RunEncounterBias {
  const favoredModifiers: RunEncounterBias['favoredModifiers'] = { ...anchorFavored };
  if (themeDef) {
    Object.entries(themeDef.encounterModifiers).forEach(([id, mult]) => {
      const key = id as keyof typeof favoredModifiers;
      favoredModifiers[key] = clampMultiplier((favoredModifiers[key] ?? 1) * mult);
    });
  }
  const twistedTemplateWeights: RunEncounterBias['twistedTemplateWeights'] = { ...anchorTwisted };
  if (themeDef) {
    Object.entries(themeDef.twistedTemplates).forEach(([id, mult]) => {
      twistedTemplateWeights[id] = clampMultiplier((twistedTemplateWeights[id] ?? 1) * (mult ?? 1));
    });
  }
  return {
    favoredModifiers,
    twistedTemplateWeights,
    rivalMercWeight: clampMultiplier(1 + rivalBoost),
    eliteWeight: themeDef?.pressureTags.includes('ANCHOR') ? 1.12 : 1,
    unstableCargoWeight: themeDef?.id === 'UNSTABLE_CARGO_SURGE' ? 1.25 : 1,
  };
}

export function combineDepthBias(
  anchorDepth2: RunWorldBriefDepthBias['depth2DistortionWeights'],
  anchorDepth3: RunWorldBriefDepthBias['depth3LawWeights'],
  themeDef?: CrisisThemeDefinition,
): RunWorldBriefDepthBias {
  const depth2DistortionWeights = { ...anchorDepth2 };
  const depth3LawWeights = { ...anchorDepth3 };
  if (themeDef) {
    Object.entries(themeDef.depth2).forEach(([id, w]) => {
      const key = id as keyof typeof depth2DistortionWeights;
      depth2DistortionWeights[key] = (depth2DistortionWeights[key] ?? 0) + w;
    });
    Object.entries(themeDef.depth3).forEach(([id, w]) => {
      const key = id as keyof typeof depth3LawWeights;
      depth3LawWeights[key] = (depth3LawWeights[key] ?? 0) + w;
    });
  }
  return { depth2DistortionWeights, depth3LawWeights };
}

export function buildRewardBiasFromTheme(themeDef?: CrisisThemeDefinition): RunRewardBias {
  const id = themeDef?.id;
  return {
    rareLootMultiplier: id === 'RESOURCE_BLOOM' || id === 'RIVAL_SALVAGE_RUSH' ? 1.12 : 1,
    sectorResourceMultiplier: id === 'RESOURCE_BLOOM' ? 1.2 : 1,
    unstableCargoMultiplier: id === 'UNSTABLE_CARGO_SURGE' ? 1.25 : 1,
    anchorMarrowMultiplier: id === 'ANCHOR_BREACH' ? 1.15 : 1,
    resonantMaterialMultiplier: id === 'ECHO_OUTBREAK' || id === 'MIRROR_CONTAMINATION' ? 1.15 : 1,
  };
}

export function applyBriefOverlayToRoll(baseChance: number, overlayKey: keyof RunScannerOverlayBias, brief?: RunScannerBias | null): number {
  if (!brief) return baseChance;
  const mult = brief.overlayBias[overlayKey] ?? 1;
  return Math.min(0.95, baseChance * mult);
}

export function applyBriefEncounterModifierWeight(
  baseWeight: number,
  modifierId: string,
  brief?: { encounterBias?: RunEncounterBias | null } | null,
): number {
  const mult = brief?.encounterBias?.favoredModifiers[modifierId as keyof RunEncounterBias['favoredModifiers']] ?? 1;
  return baseWeight * mult;
}

/** Rival merc origin weight from brief — suppressed at Depth 3 per existing rules. */
export function resolveBriefRivalMercWeightMultiplier(
  brief?: { encounterBias?: RunEncounterBias | null } | null,
  districtDepth?: 1 | 2 | 3,
): number {
  if (!brief?.encounterBias || districtDepth === 3) return 1;
  return clampMultiplier(brief.encounterBias.rivalMercWeight);
}

/** Extra rare-loot roll chance (%) derived from brief reward bias. */
export function resolveBriefRareLootBonusPct(
  brief?: { rewardBias?: RunRewardBias | null } | null,
): number {
  if (!brief?.rewardBias) return 0;
  const mult = brief.rewardBias.rareLootMultiplier;
  if (mult <= 1) return 0;
  return Math.min(18, Math.round((mult - 1) * 100));
}

/** Bias combat salvage pool toward brief-stressed resources. */
export function applyBriefResourceStressToPool<T extends string>(
  pool: readonly T[],
  brief?: { resourceStress?: { primaryResourceIds: string[]; highDemandResourceIds: string[] } | null } | null,
): T[] {
  if (!brief?.resourceStress) return [...pool];
  const stress = new Set([
    ...brief.resourceStress.primaryResourceIds,
    ...brief.resourceStress.highDemandResourceIds,
  ]);
  const stressed = pool.filter((id) => stress.has(id));
  if (stressed.length === 0) return [...pool];
  return [...stressed, ...pool.filter((id) => !stress.has(id))];
}
