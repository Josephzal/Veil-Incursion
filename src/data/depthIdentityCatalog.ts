import type {
  DeepVeilLawDefinition,
  DeepVeilLawId,
  DepthIdentityScanBias,
  VeilDistortionDefinition,
  VeilDistortionId,
} from '../types/depthIdentity';

const BASE_BIAS: DepthIdentityScanBias = {
  echoSignalMultiplier: 1,
  anchorSignalMultiplier: 1,
  operationSignalMultiplier: 1,
  highRiskMultiplier: 1,
  highValueMultiplier: 1,
  sanctuaryWeightMultiplier: 1,
  extractionUncertainty: 0,
  scannerLabelDegradeChance: 0,
};

export const VEIL_DISTORTION_DEFINITIONS: Record<VeilDistortionId, VeilDistortionDefinition> = {
  BLEEDING_ARCHITECTURE: {
    id: 'BLEEDING_ARCHITECTURE',
    displayName: 'Bleeding Architecture',
    fantasy: 'The sector\'s physical structures are alive and hurting.',
    effectSummary: 'Corrupted sanctuaries and hazards rise. Healing often asks for payment.',
    favoredBiomes: ['NULL_ZONE', 'BLACKLINE_TERMINUS', 'SLAG_WORKS'],
    favoredAnchors: ['ASHEN_HEART', 'RIFT_ENGINE', 'NULL_MONOLITH'],
    favoredOperations: ['ANCHOR_ASSAULT', 'BOSS_SUPPRESSION'],
    favoredEchoActivity: ['LOW', 'ELEVATED'],
    resourceFocusKeywords: ['slag', 'iron', 'combustion', 'ley'],
    scanBias: {
      ...BASE_BIAS,
      highRiskMultiplier: 1.25,
      sanctuaryWeightMultiplier: 1.4,
      highValueMultiplier: 1.1,
    },
    intensifiesToLaw: 'THE_WALLS_ARE_HUNGRY',
  },
  MEMORY_CONTAMINATION: {
    id: 'MEMORY_CONTAMINATION',
    displayName: 'Memory Contamination',
    fantasy: 'The sector is remembering runners, enemies, and events incorrectly.',
    effectSummary: 'Echo signals and mirrored violence rise. Scanner names degrade.',
    favoredBiomes: ['NULL_ZONE', 'BLACKLINE_TERMINUS', 'ABYSSAL_SINK'],
    favoredAnchors: ['CHOIR_SPIRE', 'NULL_MONOLITH'],
    favoredOperations: ['ECHO_RECOVERY', 'ANCHOR_ASSAULT'],
    favoredEchoActivity: ['ELEVATED', 'CRITICAL'],
    resourceFocusKeywords: ['echo', 'sanguine', 'memory'],
    scanBias: {
      ...BASE_BIAS,
      echoSignalMultiplier: 1.55,
      scannerLabelDegradeChance: 0.18,
      operationSignalMultiplier: 1.1,
    },
    intensifiesToLaw: 'THE_VEIL_REMEMBERS',
  },
  PREDATORY_GEOMETRY: {
    id: 'PREDATORY_GEOMETRY',
    displayName: 'Predatory Geometry',
    fantasy: 'Streets, corridors, roads, and rooms fold around the player.',
    effectSummary: 'False extraction pressure and scanner uncertainty rise.',
    favoredBiomes: ['ASHEN_WASTE', 'NULL_ZONE', 'BLACKLINE_TERMINUS'],
    favoredAnchors: ['NULL_MONOLITH', 'RIFT_ENGINE'],
    favoredOperations: ['EXTRACTION_SURGE', 'BOSS_SUPPRESSION'],
    favoredEchoActivity: ['LOW', 'ELEVATED', 'CRITICAL'],
    resourceFocusKeywords: ['rift', 'grid', 'ash'],
    scanBias: {
      ...BASE_BIAS,
      highRiskMultiplier: 1.35,
      extractionUncertainty: 0.28,
      scannerLabelDegradeChance: 0.14,
      highValueMultiplier: 1.05,
    },
    intensifiesToLaw: 'THE_ROADS_ARE_LOOPING',
  },
  UNSTABLE_MATTER: {
    id: 'UNSTABLE_MATTER',
    displayName: 'Unstable Matter',
    fantasy: 'Resources are more valuable, but harder to safely carry.',
    effectSummary: 'Resource blooms and high-value overlays rise with unstable cargo pressure.',
    favoredBiomes: ['SLAG_WORKS', 'ABYSSAL_SINK', 'ASHEN_WASTE'],
    favoredAnchors: ['LEY_NEXUS', 'ASHEN_HEART', 'RIFT_ENGINE'],
    favoredOperations: ['RESOURCE_SURVEY', 'EXTRACTION_SURGE'],
    favoredEchoActivity: ['LOW', 'ELEVATED'],
    resourceFocusKeywords: ['slag', 'ash', 'knot', 'anomalous', 'ley', 'veil'],
    scanBias: {
      ...BASE_BIAS,
      highValueMultiplier: 1.5,
      highRiskMultiplier: 1.15,
      sanctuaryWeightMultiplier: 0.9,
    },
    intensifiesToLaw: 'THE_WALLS_ARE_HUNGRY',
  },
  RITUAL_PRESSURE: {
    id: 'RITUAL_PRESSURE',
    displayName: 'Ritual Pressure',
    fantasy: 'The sector is being pulled into an occult pattern.',
    effectSummary: 'Occult pressure and Anchor veins rise. Sanctuaries and signals tighten.',
    favoredBiomes: ['ABYSSAL_SINK', 'BLACKLINE_TERMINUS', 'NULL_ZONE'],
    favoredAnchors: ['CHOIR_SPIRE', 'ASHEN_HEART', 'LEY_NEXUS'],
    favoredOperations: ['ANCHOR_ASSAULT', 'ECHO_RECOVERY', 'BOSS_SUPPRESSION'],
    favoredEchoActivity: ['ELEVATED', 'CRITICAL'],
    resourceFocusKeywords: ['echo', 'sanguine', 'occult', 'ley'],
    scanBias: {
      ...BASE_BIAS,
      anchorSignalMultiplier: 1.35,
      echoSignalMultiplier: 1.2,
      sanctuaryWeightMultiplier: 1.25,
      operationSignalMultiplier: 1.15,
    },
    intensifiesToLaw: 'THE_MACHINE_IS_PRAYING',
  },
};

export const DEEP_VEIL_LAW_DEFINITIONS: Record<DeepVeilLawId, DeepVeilLawDefinition> = {
  THE_VEIL_REMEMBERS: {
    id: 'THE_VEIL_REMEMBERS',
    displayName: 'The Veil Remembers',
    fantasy: 'The Veil repeats dead actions.',
    effectSummary: 'Echo and mirror pressure intensify. Hostile echoes are more likely.',
    favoredBiomes: ['NULL_ZONE', 'BLACKLINE_TERMINUS', 'ABYSSAL_SINK'],
    favoredAnchors: ['CHOIR_SPIRE', 'NULL_MONOLITH'],
    favoredOperations: ['ECHO_RECOVERY', 'ANCHOR_ASSAULT'],
    scanBias: {
      ...BASE_BIAS,
      echoSignalMultiplier: 1.7,
      scannerLabelDegradeChance: 0.22,
      operationSignalMultiplier: 1.15,
    },
  },
  THE_WALLS_ARE_HUNGRY: {
    id: 'THE_WALLS_ARE_HUNGRY',
    displayName: 'The Walls Are Hungry',
    fantasy: 'The environment consumes health, healing, and safety.',
    effectSummary: 'Sanctuaries harden. Survival rewards rise with starved pressure.',
    favoredBiomes: ['ABYSSAL_SINK', 'BLACKLINE_TERMINUS', 'SLAG_WORKS'],
    favoredAnchors: ['ASHEN_HEART', 'LEY_NEXUS'],
    favoredOperations: ['RESOURCE_SURVEY', 'BOSS_SUPPRESSION'],
    scanBias: {
      ...BASE_BIAS,
      sanctuaryWeightMultiplier: 1.35,
      highValueMultiplier: 1.35,
      highRiskMultiplier: 1.2,
    },
  },
  THE_ROADS_ARE_LOOPING: {
    id: 'THE_ROADS_ARE_LOOPING',
    displayName: 'The Roads Are Looping',
    fantasy: 'The path out is being rewritten.',
    effectSummary: 'Extraction routes contaminate. Successful extraction pays better.',
    favoredBiomes: ['ASHEN_WASTE', 'NULL_ZONE'],
    favoredAnchors: ['NULL_MONOLITH', 'RIFT_ENGINE'],
    favoredOperations: ['EXTRACTION_SURGE', 'BOSS_SUPPRESSION'],
    scanBias: {
      ...BASE_BIAS,
      extractionUncertainty: 0.4,
      scannerLabelDegradeChance: 0.2,
      highRiskMultiplier: 1.25,
    },
  },
  THE_MACHINE_IS_PRAYING: {
    id: 'THE_MACHINE_IS_PRAYING',
    displayName: 'The Machine Is Praying',
    fantasy: 'Industrial systems and occult ritual have become the same thing.',
    effectSummary: 'Anchor and operation overlays rise. Tech and material rewards tilt.',
    favoredBiomes: ['SLAG_WORKS', 'BLACKLINE_TERMINUS'],
    favoredAnchors: ['RIFT_ENGINE', 'LEY_NEXUS', 'CHOIR_SPIRE'],
    favoredOperations: ['ANCHOR_ASSAULT', 'RESOURCE_SURVEY', 'BOSS_SUPPRESSION'],
    scanBias: {
      ...BASE_BIAS,
      anchorSignalMultiplier: 1.45,
      operationSignalMultiplier: 1.4,
      highValueMultiplier: 1.2,
    },
  },
  THE_SKY_IS_UNDERGROUND: {
    id: 'THE_SKY_IS_UNDERGROUND',
    displayName: 'The Sky Is Underground',
    fantasy: 'Spatial logic is fully inverted.',
    effectSummary: 'Scanner labels degrade. Folded geometry and Core events become possible.',
    favoredBiomes: ['NULL_ZONE', 'BLACKLINE_TERMINUS', 'ASHEN_WASTE'],
    favoredAnchors: ['NULL_MONOLITH', 'CHOIR_SPIRE'],
    favoredOperations: ['ANCHOR_ASSAULT', 'ECHO_RECOVERY'],
    scanBias: {
      ...BASE_BIAS,
      scannerLabelDegradeChance: 0.3,
      highRiskMultiplier: 1.3,
      highValueMultiplier: 1.25,
      anchorSignalMultiplier: 1.2,
    },
  },
};

export const ALL_VEIL_DISTORTION_IDS = Object.keys(VEIL_DISTORTION_DEFINITIONS) as VeilDistortionId[];
export const ALL_DEEP_VEIL_LAW_IDS = Object.keys(DEEP_VEIL_LAW_DEFINITIONS) as DeepVeilLawId[];

export function getVeilDistortionDefinition(id: VeilDistortionId): VeilDistortionDefinition {
  return VEIL_DISTORTION_DEFINITIONS[id];
}

export function getDeepVeilLawDefinition(id: DeepVeilLawId): DeepVeilLawDefinition {
  return DEEP_VEIL_LAW_DEFINITIONS[id];
}

export function getDepthIdentityScanBias(
  distortion: VeilDistortionId | null,
  law: DeepVeilLawId | null,
): DepthIdentityScanBias {
  const dBias = distortion ? VEIL_DISTORTION_DEFINITIONS[distortion].scanBias : BASE_BIAS;
  const lBias = law ? DEEP_VEIL_LAW_DEFINITIONS[law].scanBias : BASE_BIAS;
  if (!distortion && !law) return BASE_BIAS;
  if (!law) return dBias;
  if (!distortion) return lBias;
  return {
    echoSignalMultiplier: dBias.echoSignalMultiplier * lBias.echoSignalMultiplier,
    anchorSignalMultiplier: dBias.anchorSignalMultiplier * lBias.anchorSignalMultiplier,
    operationSignalMultiplier: dBias.operationSignalMultiplier * lBias.operationSignalMultiplier,
    highRiskMultiplier: dBias.highRiskMultiplier * lBias.highRiskMultiplier,
    highValueMultiplier: dBias.highValueMultiplier * lBias.highValueMultiplier,
    sanctuaryWeightMultiplier: dBias.sanctuaryWeightMultiplier * lBias.sanctuaryWeightMultiplier,
    extractionUncertainty: Math.min(0.85, dBias.extractionUncertainty + lBias.extractionUncertainty),
    scannerLabelDegradeChance: Math.min(
      0.55,
      dBias.scannerLabelDegradeChance + lBias.scannerLabelDegradeChance,
    ),
  };
}
