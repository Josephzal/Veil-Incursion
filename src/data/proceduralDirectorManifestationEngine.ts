import type { CrisisTheme, RunWorldBrief } from '../types/runWorldBrief';
import type {
  CrisisManifestationResult,
  ProceduralDirectorAdjustment,
  ProceduralManifestation,
} from '../types/proceduralDirector';
import { getCrisisThemeDefinition } from './crisisThemeCatalog';

const REQUIRED_MANIFESTATIONS = 2;

type ManifestationCheck = (brief: RunWorldBrief) => ProceduralManifestation | null;

function overlayManifest(id: string, mult: number, label: string): ProceduralManifestation | null {
  if (mult <= 1.05) return null;
  return { type: 'SCANNER_OVERLAY', id, description: `${label} overlay weighted (${mult.toFixed(2)}x)` };
}

function contractManifest(brief: RunWorldBrief, kinds: string[]): ProceduralManifestation | null {
  const match = brief.contractBoard.find((c) =>
    kinds.some((k) => c.objectiveKind === k || c.title.toUpperCase().includes(k)),
  );
  if (!match) return null;
  return { type: 'CONTRACT', id: match.id, description: `Contract aligned: ${match.title}` };
}

function operationManifest(brief: RunWorldBrief, kinds: string[]): ProceduralManifestation | null {
  const kind = brief.operationInstance.objectiveKind;
  if (!kinds.includes(kind)) return null;
  return {
    type: 'OPERATION_TARGET',
    id: kind,
    description: `Active operation: ${brief.operationInstance.title}`,
  };
}

function rewardManifest(id: string, mult: number, label: string): ProceduralManifestation | null {
  if (mult <= 1.05) return null;
  return { type: 'REWARD_BIAS', id, description: `${label} reward bias (${mult.toFixed(2)}x)` };
}

function modifierManifest(brief: RunWorldBrief, ids: string[]): ProceduralManifestation | null {
  const hit = ids.find((id) => (brief.encounterBias.favoredModifiers[id as keyof typeof brief.encounterBias.favoredModifiers] ?? 1) > 1.05);
  if (!hit) return null;
  return { type: 'ENCOUNTER_MODIFIER', id: hit, description: `${hit} encounter modifier weighted` };
}

function twistedManifest(brief: RunWorldBrief, ids: string[]): ProceduralManifestation | null {
  const hit = ids.find((id) => (brief.encounterBias.twistedTemplateWeights[id] ?? 1) > 1.05);
  if (!hit) return null;
  return { type: 'ENCOUNTER_MODIFIER', id: hit, description: `${hit} twisted template weighted` };
}

function depth2Manifest(brief: RunWorldBrief): ProceduralManifestation | null {
  const entries = Object.entries(brief.depthBias.depth2DistortionWeights)
    .filter(([, w]) => (w ?? 0) > 0);
  if (!entries.length) return null;
  const [id] = entries.sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0]!;
  return { type: 'DEPTH_DISTORTION', id, description: `Depth 2 distortion bias: ${id}` };
}

function resourceStressManifest(brief: RunWorldBrief): ProceduralManifestation | null {
  if (!brief.resourceStress.highDemandResourceIds.length) return null;
  return {
    type: 'RESOURCE_STRESS',
    id: brief.resourceStress.highDemandResourceIds[0]!,
    description: `Resource stress: ${brief.resourceStress.highDemandResourceIds.slice(0, 3).join(', ')}`,
  };
}

function rivalMercManifest(brief: RunWorldBrief): ProceduralManifestation | null {
  if (brief.encounterBias.rivalMercWeight <= 1.05) return null;
  return {
    type: 'ENCOUNTER_MODIFIER',
    id: 'RIVAL_MERC',
    description: `Rival merc weight ${brief.encounterBias.rivalMercWeight.toFixed(2)}x`,
  };
}

function unstableCargoManifest(brief: RunWorldBrief): ProceduralManifestation | null {
  if (brief.encounterBias.unstableCargoWeight <= 1.05) return null;
  return {
    type: 'ENCOUNTER_MODIFIER',
    id: 'UNSTABLE_CARGO',
    description: `Unstable cargo weight ${brief.encounterBias.unstableCargoWeight.toFixed(2)}x`,
  };
}

const THEME_CHECKS: Record<CrisisTheme, ManifestationCheck[]> = {
  ANCHOR_BREACH: [
    (b) => overlayManifest('anchorSignal', b.scannerBias.overlayBias.anchorSignal, 'Anchor Signal'),
    (b) => contractManifest(b, ['CLEAR_OPERATION_TARGET', 'DEFEAT_ELITE', 'ANCHOR']),
    (b) => operationManifest(b, ['ANCHOR_ASSAULT', 'BOSS_SUPPRESSION']),
    (b) => twistedManifest(b, ['ANCHOR_VEIN', 'ANCHOR_CORE_BREACH']),
    (b) => rewardManifest('anchorMarrow', b.rewardBias.anchorMarrowMultiplier, 'Anchor Marrow'),
    (b) => modifierManifest(b, ['RESONANT', 'CORE_SICK']),
    (b) => resourceStressManifest(b),
  ],
  ECHO_OUTBREAK: [
    (b) => overlayManifest('echoSignal', b.scannerBias.overlayBias.echoSignal, 'Echo Signal'),
    (b) => contractManifest(b, ['EXTRACT_UNSTABLE_CARGO', 'CLEAR_OPERATION_TARGET']),
    (b) => operationManifest(b, ['ECHO_RECOVERY']),
    (b) => twistedManifest(b, ['MIRROR_COMBAT', 'ECHO_RESIDUE']),
    (b) => rewardManifest('resonantMaterial', b.rewardBias.resonantMaterialMultiplier, 'Resonant material'),
    (b) => modifierManifest(b, ['MIRRORED', 'RESONANT']),
    (b) => resourceStressManifest(b),
  ],
  RESOURCE_BLOOM: [
    (b) => overlayManifest('highValueResource', b.scannerBias.overlayBias.highValueResource, 'High-Value Resource'),
    (b) => contractManifest(b, ['EXTRACT_RESOURCE', 'SURVEY']),
    (b) => operationManifest(b, ['RESOURCE_SURVEY', 'EXTRACTION_SURGE']),
    (b) => twistedManifest(b, ['RESOURCE_BLOOM', 'VEIL_PROPER_CACHE']),
    (b) => rewardManifest('sectorResource', b.rewardBias.sectorResourceMultiplier, 'Sector resource'),
    (b) => resourceStressManifest(b),
  ],
  FALSE_EXTRACTION_WAVE: [
    (b) => overlayManifest('extraction', b.scannerBias.overlayBias.extraction, 'Extraction'),
    (b) => twistedManifest(b, ['FALSE_EXTRACTION_SIGNAL', 'FINAL_ROUTE_FRACTURE']),
    (b) => contractManifest(b, ['EXTRACT_RESOURCE', 'EXTRACT_UNSTABLE_CARGO', 'WILDCARD']),
    (b) => operationManifest(b, ['EXTRACTION_SURGE', 'STABILIZE_FALSE_EXTRACTION']),
    (b) => rewardManifest('sectorResource', b.rewardBias.sectorResourceMultiplier, 'Extraction cargo'),
    (b) => modifierManifest(b, ['FOLDED', 'UNSTABLE']),
  ],
  RIVAL_SALVAGE_RUSH: [
    rivalMercManifest,
    (b) => contractManifest(b, ['DEFEAT_ELITE', 'EXTRACT_RESOURCE', 'WILDCARD']),
    (b) => overlayManifest('highValueResource', b.scannerBias.overlayBias.highValueResource, 'Contested salvage'),
    (b) => rewardManifest('rareLoot', b.rewardBias.rareLootMultiplier, 'Salvage rare loot'),
    (b) => operationManifest(b, ['EXTRACTION_SURGE', 'RESOURCE_SURVEY']),
  ],
  CONTAINMENT_FAILURE: [
    (b) => rewardManifest('rareLoot', b.rewardBias.rareLootMultiplier, 'Containment salvage'),
    (b) => contractManifest(b, ['EXTRACT_RESOURCE', 'CLEAR_OPERATION_TARGET']),
    (b) => overlayManifest('highRisk', b.scannerBias.overlayBias.highRisk, 'Containment breach'),
    (b) => modifierManifest(b, ['UNSTABLE', 'CORE_SICK']),
    depth2Manifest,
    resourceStressManifest,
  ],
  MIRROR_CONTAMINATION: [
    (b) => twistedManifest(b, ['MIRROR_COMBAT', 'ECHO_RESIDUE']),
    (b) => modifierManifest(b, ['MIRRORED', 'RESONANT']),
    (b) => overlayManifest('echoSignal', b.scannerBias.overlayBias.echoSignal, 'Mirror echo'),
    (b) => rewardManifest('resonantMaterial', b.rewardBias.resonantMaterialMultiplier, 'Resonant material'),
    (b) => contractManifest(b, ['EXTRACT_UNSTABLE_CARGO', 'CLEAR_OPERATION_TARGET']),
    (b) => operationManifest(b, ['ECHO_RECOVERY']),
  ],
  UNSTABLE_CARGO_SURGE: [
    (b) => rewardManifest('unstableCargo', b.rewardBias.unstableCargoMultiplier, 'Unstable cargo'),
    (b) => overlayManifest('highRisk', b.scannerBias.overlayBias.highRisk, 'High-Risk Zone'),
    (b) => overlayManifest('highValueResource', b.scannerBias.overlayBias.highValueResource, 'High-Value pairing'),
    (b) => twistedManifest(b, ['RESOURCE_BLOOM', 'VEIL_PROPER_CACHE']),
    (b) => contractManifest(b, ['EXTRACT_UNSTABLE_CARGO', 'EXTRACT_RESOURCE']),
    unstableCargoManifest,
  ],
};

export function ensureCrisisManifestation(
  brief: RunWorldBrief,
): CrisisManifestationResult {
  const theme = brief.crisisTheme;
  const checks = THEME_CHECKS[theme] ?? [];
  const actualManifestations: ProceduralManifestation[] = [];

  checks.forEach((check) => {
    const result = check(brief);
    if (result && !actualManifestations.some((m) => m.id === result.id && m.type === result.type)) {
      actualManifestations.push(result);
    }
  });

  const themeDef = getCrisisThemeDefinition(theme);
  if (themeDef.flavorLine) {
    actualManifestations.push({
      type: 'DEBRIEF_CALLOUT',
      id: 'flavor',
      description: themeDef.flavorLine,
    });
  }

  const passed = actualManifestations.length >= REQUIRED_MANIFESTATIONS;
  const missingManifestations = passed
    ? []
    : [`Need ${REQUIRED_MANIFESTATIONS - actualManifestations.length} more ${themeDef.displayName} manifestation(s)`];

  return {
    crisisTheme: theme,
    requiredManifestations: REQUIRED_MANIFESTATIONS,
    actualManifestations,
    passed,
    missingManifestations,
    appliedFixes: [],
  };
}

export function applyManifestationFixes(
  brief: RunWorldBrief,
  manifestation: CrisisManifestationResult,
): { brief: RunWorldBrief; adjustments: ProceduralDirectorAdjustment[] } {
  if (manifestation.passed) return { brief, adjustments: [] };

  const adjustments: ProceduralDirectorAdjustment[] = [];
  const themeDef = getCrisisThemeDefinition(brief.crisisTheme);
  const next = {
    ...brief,
    scannerBias: { ...brief.scannerBias, overlayBias: { ...brief.scannerBias.overlayBias } },
    encounterBias: {
      ...brief.encounterBias,
      favoredModifiers: { ...brief.encounterBias.favoredModifiers },
      twistedTemplateWeights: { ...brief.encounterBias.twistedTemplateWeights },
    },
    rewardBias: { ...brief.rewardBias },
  };

  const overlayEntries = Object.entries(themeDef.scannerOverlays);
  if (overlayEntries.length > 0) {
    const [overlayKey, boost] = overlayEntries[0]!;
    const key = overlayKey as keyof typeof next.scannerBias.overlayBias;
    if (next.scannerBias.overlayBias[key] != null && boost) {
      const before = next.scannerBias.overlayBias[key];
      const after = Math.min(1.6, before * 1.12);
      next.scannerBias.overlayBias[key] = after;
      adjustments.push({
        id: 'BOOST_SCANNER_OVERLAY',
        reason: 'Crisis under-manifested — boosted scanner overlay',
        before,
        after,
        applied: true,
      });
    }
  }

  const modKey = Object.keys(themeDef.encounterModifiers)[0];
  if (modKey) {
    const before = next.encounterBias.favoredModifiers[modKey as keyof typeof next.encounterBias.favoredModifiers] ?? 1;
    next.encounterBias.favoredModifiers[modKey as keyof typeof next.encounterBias.favoredModifiers] = Math.min(1.5, before * 1.15);
    adjustments.push({
      id: 'BOOST_ENCOUNTER_MODIFIER',
      reason: 'Crisis under-manifested — boosted encounter modifier',
      before,
      after: next.encounterBias.favoredModifiers[modKey as keyof typeof next.encounterBias.favoredModifiers],
      applied: true,
    });
  }

  return { brief: next, adjustments };
}
