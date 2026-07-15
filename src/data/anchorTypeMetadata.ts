import type {
  AnchorEncounterBias,
  AnchorInstanceModifier,
  AnchorPressureTag,
  AnchorScannerBias,
} from '../types/anchorProcedural';
import type { DeepVeilLawId, VeilDistortionId } from '../types/depthIdentity';
import type { OperationObjectiveKind, VeilAnchorType } from '../types/worldState';

export const ANCHOR_TYPE_ALIASES: Record<VeilAnchorType, readonly string[]> = {
  CHOIR_SPIRE: ['Choir Spire', 'Resonance Spire', 'Harmonic Pylon', 'Dead Choir', 'Canticle Tower'],
  LEY_NEXUS: ['Ley Nexus', 'Ley-Knot Core', 'Rooted Nexus', 'Leystone Heart', 'Vein Nexus'],
  ASHEN_HEART: ['Ashen Heart', 'Sanguine Heart', 'Cinder Heart', 'Hunger Altar', 'Blood Furnace'],
  RIFT_ENGINE: ['Rift Engine', 'Breach Engine', 'Evacuation Engine', 'Route Furnace', 'Transit Maw'],
  NULL_MONOLITH: ['Null Monolith', 'Geometry Monolith', 'Black Meridian', 'Inverted Obelisk', 'Silent Axis'],
};

export const MODIFIER_ADJECTIVES: Record<AnchorInstanceModifier, string> = {
  FRACTURED: 'Fractured',
  ECHOING: 'Echoing',
  BLOOMING: 'Blooming',
  LEAKING: 'Leaking',
  INVERTED: 'Inverted',
  STARVED: 'Starved',
  OVERFED: 'Overfed',
  FORTIFIED: 'Fortified',
  RAVENOUS: 'Ravenous',
};

export const ALL_ANCHOR_MODIFIERS: readonly AnchorInstanceModifier[] = [
  'FRACTURED',
  'ECHOING',
  'BLOOMING',
  'LEAKING',
  'INVERTED',
  'STARVED',
  'OVERFED',
  'FORTIFIED',
  'RAVENOUS',
];

export const ANCHOR_TYPE_OPERATION_BIAS: Record<VeilAnchorType, OperationObjectiveKind[]> = {
  CHOIR_SPIRE: ['ECHO_RECOVERY', 'ANCHOR_ASSAULT', 'BOSS_SUPPRESSION'],
  LEY_NEXUS: ['RESOURCE_SURVEY', 'ANCHOR_ASSAULT'],
  ASHEN_HEART: ['ANCHOR_ASSAULT', 'RESOURCE_SURVEY', 'BOSS_SUPPRESSION'],
  RIFT_ENGINE: ['EXTRACTION_SURGE', 'RESOURCE_SURVEY', 'ANCHOR_ASSAULT'],
  NULL_MONOLITH: ['ANCHOR_ASSAULT', 'BOSS_SUPPRESSION', 'ECHO_RECOVERY', 'EXTRACTION_SURGE'],
};

export const ANCHOR_TYPE_PRESSURE_TAGS: Record<VeilAnchorType, AnchorPressureTag[]> = {
  CHOIR_SPIRE: ['ECHO_CONTAMINATION', 'ANCHOR_SIGNALS', 'RESONANT_MATERIALS'],
  LEY_NEXUS: ['RESOURCE_BLOOM', 'HIGH_VALUE_CARGO', 'ANCHOR_SIGNALS'],
  ASHEN_HEART: ['RITUAL_PRESSURE', 'ELITE_PRESSURE', 'ANCHOR_SIGNALS'],
  RIFT_ENGINE: ['EXTRACTION_INSTABILITY', 'ANCHOR_SIGNALS', 'HIGH_VALUE_CARGO'],
  NULL_MONOLITH: ['SCANNER_DEGRADATION', 'GEOMETRY_FOLD', 'ECHO_CONTAMINATION'],
};

export const ANCHOR_TYPE_DEPTH2_BIAS: Record<VeilAnchorType, Partial<Record<VeilDistortionId, number>>> = {
  CHOIR_SPIRE: { MEMORY_CONTAMINATION: 18, RITUAL_PRESSURE: 14 },
  LEY_NEXUS: { UNSTABLE_MATTER: 18, BLEEDING_ARCHITECTURE: 14 },
  ASHEN_HEART: { RITUAL_PRESSURE: 18, BLEEDING_ARCHITECTURE: 14, UNSTABLE_MATTER: 10 },
  RIFT_ENGINE: { PREDATORY_GEOMETRY: 18, UNSTABLE_MATTER: 14 },
  NULL_MONOLITH: { PREDATORY_GEOMETRY: 18, MEMORY_CONTAMINATION: 14 },
};

export const ANCHOR_TYPE_DEPTH3_BIAS: Record<VeilAnchorType, Partial<Record<DeepVeilLawId, number>>> = {
  CHOIR_SPIRE: { THE_VEIL_REMEMBERS: 18, THE_MACHINE_IS_PRAYING: 14 },
  LEY_NEXUS: { THE_WALLS_ARE_HUNGRY: 18, THE_MACHINE_IS_PRAYING: 14 },
  ASHEN_HEART: { THE_WALLS_ARE_HUNGRY: 18, THE_VEIL_REMEMBERS: 14 },
  RIFT_ENGINE: { THE_ROADS_ARE_LOOPING: 18, THE_MACHINE_IS_PRAYING: 14 },
  NULL_MONOLITH: {
    THE_SKY_IS_UNDERGROUND: 18,
    THE_ROADS_ARE_LOOPING: 14,
    THE_VEIL_REMEMBERS: 10,
  },
};

export const ANCHOR_TYPE_ENCOUNTER_BIAS: Record<VeilAnchorType, AnchorEncounterBias> = {
  CHOIR_SPIRE: {
    favoredModifiers: { MIRRORED: 1.4, RESONANT: 1.35 },
    twistedTemplateWeights: { MIRROR_COMBAT: 1.3, ECHO_RESIDUE: 1.2 },
  },
  LEY_NEXUS: {
    favoredModifiers: { UNSTABLE: 1.35 },
    twistedTemplateWeights: { RESOURCE_BLOOM: 1.4, ANCHOR_VEIN: 1.25 },
  },
  ASHEN_HEART: {
    favoredModifiers: { BLEEDING: 1.35, STARVED: 1.3 },
    twistedTemplateWeights: { CORRUPTED_SANCTUARY: 1.35 },
  },
  RIFT_ENGINE: {
    favoredModifiers: { FOLDED: 1.35, UNSTABLE: 1.25 },
    twistedTemplateWeights: { FALSE_EXTRACTION_SIGNAL: 1.35 },
  },
  NULL_MONOLITH: {
    favoredModifiers: { FOLDED: 1.4, MIRRORED: 1.25 },
    twistedTemplateWeights: { FALSE_EXTRACTION_SIGNAL: 1.2 },
  },
};

/** Base scanner bias multipliers layered on ANCHOR_REGISTRY. */
export function buildBaseAnchorScannerBias(type: VeilAnchorType): AnchorScannerBias {
  switch (type) {
    case 'CHOIR_SPIRE':
      return {
        anchorSignalMultiplier: 1.25,
        echoSignalMultiplier: 1.35,
        operationSignalMultiplier: 1.05,
        highRiskMultiplier: 1.05,
        highValueResourceMultiplier: 1,
        extractionUncertainty: 0,
        scannerLabelDegradeChance: 0,
      };
    case 'LEY_NEXUS':
      return {
        anchorSignalMultiplier: 0.95,
        echoSignalMultiplier: 0.85,
        operationSignalMultiplier: 1.15,
        highRiskMultiplier: 1,
        highValueResourceMultiplier: 1.45,
        extractionUncertainty: 0,
        scannerLabelDegradeChance: 0,
      };
    case 'ASHEN_HEART':
      return {
        anchorSignalMultiplier: 1.05,
        echoSignalMultiplier: 1.2,
        operationSignalMultiplier: 1.15,
        highRiskMultiplier: 1.25,
        highValueResourceMultiplier: 1.05,
        extractionUncertainty: 0.05,
        scannerLabelDegradeChance: 0,
      };
    case 'RIFT_ENGINE':
      return {
        anchorSignalMultiplier: 1.2,
        echoSignalMultiplier: 0.95,
        operationSignalMultiplier: 1.1,
        highRiskMultiplier: 1.15,
        highValueResourceMultiplier: 1.1,
        extractionUncertainty: 0.12,
        scannerLabelDegradeChance: 0.05,
      };
    case 'NULL_MONOLITH':
      return {
        anchorSignalMultiplier: 1.1,
        echoSignalMultiplier: 1.1,
        operationSignalMultiplier: 1.2,
        highRiskMultiplier: 1.1,
        highValueResourceMultiplier: 1,
        extractionUncertainty: 0.1,
        scannerLabelDegradeChance: 0.15,
      };
    default:
      return {
        anchorSignalMultiplier: 1,
        echoSignalMultiplier: 1,
        operationSignalMultiplier: 1,
        highRiskMultiplier: 1,
        highValueResourceMultiplier: 1,
        extractionUncertainty: 0,
        scannerLabelDegradeChance: 0,
      };
  }
}

export const MODIFIER_SCANNER_MULTIPLIERS: Record<
  AnchorInstanceModifier,
  Partial<AnchorScannerBias>
> = {
  FRACTURED: { highRiskMultiplier: 1.1, anchorSignalMultiplier: 1.08 },
  ECHOING: { echoSignalMultiplier: 1.25 },
  BLOOMING: { highValueResourceMultiplier: 1.3 },
  LEAKING: { highRiskMultiplier: 1.12, extractionUncertainty: 0.08 },
  INVERTED: { scannerLabelDegradeChance: 0.12, extractionUncertainty: 0.1 },
  STARVED: { highRiskMultiplier: 1.15 },
  OVERFED: { highValueResourceMultiplier: 1.15, highRiskMultiplier: 1.08 },
  FORTIFIED: { anchorSignalMultiplier: 1.12 },
  RAVENOUS: { highRiskMultiplier: 1.2, highValueResourceMultiplier: 1.1 },
};

export const MODIFIER_OPERATION_WEIGHT_BOOST: Partial<
  Record<AnchorInstanceModifier, Partial<Record<OperationObjectiveKind, number>>>
> = {
  FRACTURED: { ANCHOR_ASSAULT: 1.3, BOSS_SUPPRESSION: 1.2 },
  ECHOING: { ECHO_RECOVERY: 1.35 },
  BLOOMING: { RESOURCE_SURVEY: 1.35 },
  LEAKING: { EXTRACTION_SURGE: 1.2, RESOURCE_SURVEY: 1.1 },
  FORTIFIED: { BOSS_SUPPRESSION: 1.3, ANCHOR_ASSAULT: 1.25 },
};

/** Modifier compatibility weights by anchor type — higher = more likely. */
export const MODIFIER_COMPATIBILITY: Record<
  VeilAnchorType,
  Partial<Record<AnchorInstanceModifier, number>>
> = {
  CHOIR_SPIRE: { ECHOING: 3, FRACTURED: 2, FORTIFIED: 2, OVERFED: 1 },
  LEY_NEXUS: { BLOOMING: 3, LEAKING: 2, STARVED: 2, RAVENOUS: 1 },
  ASHEN_HEART: { STARVED: 3, RAVENOUS: 2, BLOOMING: 1, FRACTURED: 1 },
  RIFT_ENGINE: { LEAKING: 3, INVERTED: 2, FRACTURED: 2, FORTIFIED: 1 },
  NULL_MONOLITH: { INVERTED: 3, ECHOING: 2, LEAKING: 2, FORTIFIED: 1 },
};

export function mergeScannerBias(
  base: AnchorScannerBias,
  modifier: AnchorInstanceModifier | null,
): AnchorScannerBias {
  if (!modifier) return base;
  const mult = MODIFIER_SCANNER_MULTIPLIERS[modifier];
  return {
    anchorSignalMultiplier: base.anchorSignalMultiplier * (mult.anchorSignalMultiplier ?? 1),
    echoSignalMultiplier: base.echoSignalMultiplier * (mult.echoSignalMultiplier ?? 1),
    operationSignalMultiplier: base.operationSignalMultiplier * (mult.operationSignalMultiplier ?? 1),
    highRiskMultiplier: base.highRiskMultiplier * (mult.highRiskMultiplier ?? 1),
    highValueResourceMultiplier: base.highValueResourceMultiplier * (mult.highValueResourceMultiplier ?? 1),
    extractionUncertainty: base.extractionUncertainty + (mult.extractionUncertainty ?? 0),
    scannerLabelDegradeChance: base.scannerLabelDegradeChance + (mult.scannerLabelDegradeChance ?? 0),
  };
}
