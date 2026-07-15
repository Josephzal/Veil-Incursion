import type { ContractObjectiveKind } from '../types/contract';
import type { ContractSourceKind } from '../types/contractProcedural';
import type { EncounterModifierId, DeepVeilLawId, VeilDistortionId } from '../types/depthIdentity';
import type { AnchorInstanceModifier } from '../types/anchorProcedural';
import type { OperationSignalOverlay } from '../types/operationProcedural';
import type { ResourceItemId } from '../types/resourceItem';
import type {
  CabalEmployerId,
  OperationObjectiveKind,
  SectorId,
  VeilAnchorType,
} from '../types/worldState';
import type { CrisisTheme, ThreatPressureTag } from '../types/runWorldBrief';

export interface CrisisThemeDefinition {
  id: CrisisTheme;
  displayName: string;
  summaryTemplate: string;
  baseWeight: number;
  anchorTypeBonus: Partial<Record<VeilAnchorType, number>>;
  anchorModifierBonus: Partial<Record<AnchorInstanceModifier, number>>;
  operationKindBonus: Partial<Record<OperationObjectiveKind, number>>;
  sectorBonus: Partial<Record<SectorId, number>>;
  echoActivityBonus: Partial<Record<'LOW' | 'ELEVATED' | 'CRITICAL', number>>;
  hazardBonus: (hazard: number) => number;
  rewardBonus: (reward: number) => number;
  pressureTags: ThreatPressureTag[];
  resourceIds: ResourceItemId[];
  scannerOverlays: Partial<Record<keyof import('../types/runWorldBrief').RunScannerOverlayBias, number>>;
  encounterModifiers: Partial<Record<EncounterModifierId, number>>;
  twistedTemplates: Partial<Record<string, number>>;
  operationKinds: OperationObjectiveKind[];
  contractSources: Partial<Record<ContractSourceKind, number>>;
  contractKinds: Partial<Record<ContractObjectiveKind, number>>;
  sponsorBoost: Partial<Record<CabalEmployerId, number>>;
  depth2: Partial<Record<VeilDistortionId, number>>;
  depth3: Partial<Record<DeepVeilLawId, number>>;
  nodeOverlays: OperationSignalOverlay[];
  rivalMercBoost: number;
  flavorLine: string;
}

export const CRISIS_THEME_DEFINITIONS: Record<CrisisTheme, CrisisThemeDefinition> = {
  ANCHOR_BREACH: {
    id: 'ANCHOR_BREACH',
    displayName: 'Anchor Breach',
    summaryTemplate: '{anchor} is forcing itself through {sector}. Anchor pressure is rising across the route.',
    baseWeight: 12,
    anchorTypeBonus: { CHOIR_SPIRE: 4, ASHEN_HEART: 3, RIFT_ENGINE: 2 },
    anchorModifierBonus: { FRACTURED: 8, FORTIFIED: 6, OVERFED: 5, RAVENOUS: 4 },
    operationKindBonus: { ANCHOR_ASSAULT: 10, BOSS_SUPPRESSION: 6 },
    sectorBonus: {},
    echoActivityBonus: { ELEVATED: 2 },
    hazardBonus: (h) => (h >= 4 ? 4 : 0),
    rewardBonus: () => 0,
    pressureTags: ['ANCHOR', 'UNSTABLE'],
    resourceIds: ['anchor-marrow'],
    scannerOverlays: { anchorSignal: 1.25, operationTarget: 1.15, highRisk: 1.1 },
    encounterModifiers: { RESONANT: 1.15, CORE_SICK: 1.1 },
    twistedTemplates: { ANCHOR_VEIN: 1.3 },
    operationKinds: ['ANCHOR_ASSAULT', 'BOSS_SUPPRESSION'],
    contractSources: { ANCHOR_ALIGNED: 12, OPERATION_ALIGNED: 8 },
    contractKinds: { CLEAR_OPERATION_TARGET: 4, DEFEAT_ELITE: 3 },
    sponsorBoost: { LEGION: 8, SOLARIS: 4 },
    depth2: { RITUAL_PRESSURE: 10, UNSTABLE_MATTER: 8 },
    depth3: { THE_MACHINE_IS_PRAYING: 10 },
    nodeOverlays: ['ANCHOR_SIGNAL', 'HIGH_RISK_ZONE'],
    rivalMercBoost: 0,
    flavorLine: 'Anchor pressure rising across route.',
  },
  ECHO_OUTBREAK: {
    id: 'ECHO_OUTBREAK',
    displayName: 'Echo Outbreak',
    summaryTemplate: 'Dead signals and runner memories are spreading through {sector}. {anchor} repeats what should have stayed buried.',
    baseWeight: 12,
    anchorTypeBonus: { CHOIR_SPIRE: 10, NULL_MONOLITH: 6 },
    anchorModifierBonus: { ECHOING: 12 },
    operationKindBonus: { ECHO_RECOVERY: 12 },
    sectorBonus: { THE_ABYSSAL_SINK: 4 },
    echoActivityBonus: { ELEVATED: 6, CRITICAL: 10 },
    hazardBonus: () => 0,
    rewardBonus: () => 0,
    pressureTags: ['ECHO', 'MIRROR', 'ANCHOR'],
    resourceIds: ['resonant-filament', 'echo-glass-shard'],
    scannerOverlays: { echoSignal: 1.35, anchorSignal: 1.05 },
    encounterModifiers: { MIRRORED: 1.35, RESONANT: 1.3 },
    twistedTemplates: { MIRROR_COMBAT: 1.35, ECHO_RESIDUE: 1.25 },
    operationKinds: ['ECHO_RECOVERY'],
    contractSources: { ANCHOR_ALIGNED: 6, OPERATION_ALIGNED: 10, WILDCARD: 4 },
    contractKinds: { EXTRACT_UNSTABLE_CARGO: 3, CLEAR_OPERATION_TARGET: 3 },
    sponsorBoost: { SOLARIS: 8, TERRAN_GRID: 4 },
    depth2: { MEMORY_CONTAMINATION: 14, RITUAL_PRESSURE: 8 },
    depth3: { THE_VEIL_REMEMBERS: 12 },
    nodeOverlays: ['ECHO_SIGNAL', 'ANCHOR_SIGNAL'],
    rivalMercBoost: 0,
    flavorLine: 'Dead signal repetition detected.',
  },
  RESOURCE_BLOOM: {
    id: 'RESOURCE_BLOOM',
    displayName: 'Resource Bloom',
    summaryTemplate: '{sector} is producing too much valuable material. {anchor} is feeding a material surge through the veins.',
    baseWeight: 11,
    anchorTypeBonus: { LEY_NEXUS: 12, ASHEN_HEART: 4 },
    anchorModifierBonus: { BLOOMING: 12, OVERFED: 6 },
    operationKindBonus: { RESOURCE_SURVEY: 12 },
    sectorBonus: { THE_NULL_ZONE: 3, THE_SLAG_WORKS: 3 },
    echoActivityBonus: {},
    hazardBonus: () => 0,
    rewardBonus: (r) => (r >= 3 ? 8 : 0),
    pressureTags: ['RESOURCE'],
    resourceIds: ['ley-slag', 'anomalous-core', 'breach-thread'],
    scannerOverlays: { highValueResource: 1.4, operationTarget: 1.1 },
    encounterModifiers: { UNSTABLE: 1.2 },
    twistedTemplates: { RESOURCE_BLOOM: 1.45 },
    operationKinds: ['RESOURCE_SURVEY'],
    contractSources: { SECTOR_RESOURCE: 12, OPERATION_ALIGNED: 6 },
    contractKinds: { EXTRACT_STABLE_RESOURCE: 4, EXTRACT_SPONSOR_RESOURCE: 3 },
    sponsorBoost: { SOLARIS: 4, LEGION: 3 },
    depth2: { UNSTABLE_MATTER: 10, BLEEDING_ARCHITECTURE: 8 },
    depth3: { THE_WALLS_ARE_HUNGRY: 10 },
    nodeOverlays: ['HIGH_VALUE_RESOURCE', 'OPERATION_TARGET'],
    rivalMercBoost: 0,
    flavorLine: 'Material bloom signatures clustering.',
  },
  FALSE_EXTRACTION_WAVE: {
    id: 'FALSE_EXTRACTION_WAVE',
    displayName: 'False Extraction Wave',
    summaryTemplate: 'The Veil is imitating exits and corrupting routes through {sector}. {anchor} distorts evacuation logic.',
    baseWeight: 10,
    anchorTypeBonus: { RIFT_ENGINE: 12, NULL_MONOLITH: 8 },
    anchorModifierBonus: { LEAKING: 10, INVERTED: 8 },
    operationKindBonus: { EXTRACTION_SURGE: 12 },
    sectorBonus: { THE_ASHEN_WASTES: 8, THE_BLACKLINE_TERMINUS: 4 },
    echoActivityBonus: {},
    hazardBonus: (h) => (h >= 3 ? 3 : 0),
    rewardBonus: () => 0,
    pressureTags: ['EXTRACTION', 'MIRROR'],
    resourceIds: ['cinder-wire', 'containment-seal', 'breach-thread'],
    scannerOverlays: { extraction: 1.35, highRisk: 1.15, scannerLabelDegrade: 0.12 },
    encounterModifiers: { FOLDED: 1.25, UNSTABLE: 1.15 },
    twistedTemplates: { FALSE_EXTRACTION_SIGNAL: 1.4 },
    operationKinds: ['EXTRACTION_SURGE'],
    contractSources: { WILDCARD: 8, OPERATION_ALIGNED: 8 },
    contractKinds: { COMPLETE_EMERGENCY_RECALL: 4, REACH_DEPTH_AND_EXTRACT: 3 },
    sponsorBoost: { TERRAN_GRID: 4, LEGION: 3 },
    depth2: { PREDATORY_GEOMETRY: 12, UNSTABLE_MATTER: 8 },
    depth3: { THE_ROADS_ARE_LOOPING: 12 },
    nodeOverlays: ['EXTRACTION', 'HIGH_RISK_ZONE'],
    rivalMercBoost: 0,
    flavorLine: 'Evac signals inconsistent. Verify before commitment.',
  },
  RIVAL_SALVAGE_RUSH: {
    id: 'RIVAL_SALVAGE_RUSH',
    displayName: 'Rival Salvage Rush',
    summaryTemplate: 'Other runners are exploiting the crisis in {sector}. High-value salvage is drawing hostile competition.',
    baseWeight: 9,
    anchorTypeBonus: {},
    anchorModifierBonus: {},
    operationKindBonus: { RESOURCE_SURVEY: 4, BOSS_SUPPRESSION: 3 },
    sectorBonus: { THE_SLAG_WORKS: 3 },
    echoActivityBonus: {},
    hazardBonus: (h) => (h <= 3 ? 6 : 0),
    rewardBonus: (r) => (r >= 3 ? 6 : 0),
    pressureTags: ['RIVAL', 'RESOURCE'],
    resourceIds: ['tarnished-dog-tags', 'transit-scrap'],
    scannerOverlays: { highValueResource: 1.2, highRisk: 1.1 },
    encounterModifiers: {},
    twistedTemplates: {},
    operationKinds: ['RESOURCE_SURVEY', 'BOSS_SUPPRESSION'],
    contractSources: { SPONSOR_PREFERENCE: 8, WILDCARD: 6 },
    contractKinds: { DEFEAT_ELITE: 4, RECOVER_CONTRABAND: 3, EXTRACT_SPONSOR_RESOURCE: 3 },
    sponsorBoost: { LEGION: 10 },
    depth2: {},
    depth3: {},
    nodeOverlays: ['HIGH_VALUE_RESOURCE'],
    rivalMercBoost: 1.45,
    flavorLine: 'Rival salvage signatures on route.',
  },
  CONTAINMENT_FAILURE: {
    id: 'CONTAINMENT_FAILURE',
    displayName: 'Containment Failure',
    summaryTemplate: 'Sealed systems are breaking open in {sector}. {anchor} stress is compromising vault and lab architecture.',
    baseWeight: 10,
    anchorTypeBonus: { NULL_MONOLITH: 8, RIFT_ENGINE: 6 },
    anchorModifierBonus: { LEAKING: 4, FORTIFIED: 3 },
    operationKindBonus: { RESOURCE_SURVEY: 4, BOSS_SUPPRESSION: 3 },
    sectorBonus: { THE_BLACKLINE_TERMINUS: 12 },
    echoActivityBonus: {},
    hazardBonus: () => 0,
    rewardBonus: () => 0,
    pressureTags: ['CONTAINMENT', 'ANCHOR'],
    resourceIds: ['containment-seal', 'blacksite-specimen-jar', 'encrypted-grid-drive'],
    scannerOverlays: { highRisk: 1.12, operationTarget: 1.1 },
    encounterModifiers: { BLEEDING: 1.1 },
    twistedTemplates: { CORRUPTED_SANCTUARY: 1.15 },
    operationKinds: ['RESOURCE_SURVEY'],
    contractSources: { SECTOR_RESOURCE: 8, SPONSOR_PREFERENCE: 6 },
    contractKinds: { RECOVER_INTEL: 4, RECOVER_ECONOMY_INTEL: 3, EXTRACT_SPONSOR_RESOURCE: 3 },
    sponsorBoost: { TERRAN_GRID: 12 },
    depth2: { BLEEDING_ARCHITECTURE: 10 },
    depth3: { THE_SKY_IS_UNDERGROUND: 8 },
    nodeOverlays: ['HIGH_RISK_ZONE', 'OPERATION_TARGET'],
    rivalMercBoost: 0,
    flavorLine: 'Containment breach signatures detected.',
  },
  MIRROR_CONTAMINATION: {
    id: 'MIRROR_CONTAMINATION',
    displayName: 'Mirror Contamination',
    summaryTemplate: '{sector} is reflecting actions, routes, and memories. {anchor} repeats the incursion back at the runners.',
    baseWeight: 9,
    anchorTypeBonus: { CHOIR_SPIRE: 6, NULL_MONOLITH: 10 },
    anchorModifierBonus: { ECHOING: 8, INVERTED: 10 },
    operationKindBonus: { ECHO_RECOVERY: 6 },
    sectorBonus: { THE_NULL_ZONE: 4 },
    echoActivityBonus: { ELEVATED: 4, CRITICAL: 6 },
    hazardBonus: () => 0,
    rewardBonus: () => 0,
    pressureTags: ['MIRROR', 'ECHO'],
    resourceIds: ['resonant-filament', 'echo-glass-shard'],
    scannerOverlays: { echoSignal: 1.2, scannerLabelDegrade: 0.15 },
    encounterModifiers: { MIRRORED: 1.4, RESONANT: 1.2 },
    twistedTemplates: { MIRROR_COMBAT: 1.4 },
    operationKinds: ['ECHO_RECOVERY', 'ANCHOR_ASSAULT'],
    contractSources: { ANCHOR_ALIGNED: 6, WILDCARD: 6 },
    contractKinds: { CLEAR_OPERATION_TARGET: 3, EXTRACT_UNSTABLE_CARGO: 2 },
    sponsorBoost: { SOLARIS: 6, TERRAN_GRID: 4 },
    depth2: { MEMORY_CONTAMINATION: 14, PREDATORY_GEOMETRY: 8 },
    depth3: { THE_VEIL_REMEMBERS: 10 },
    nodeOverlays: ['ECHO_SIGNAL'],
    rivalMercBoost: 0,
    flavorLine: 'Mirrored route contamination likely.',
  },
  UNSTABLE_CARGO_SURGE: {
    id: 'UNSTABLE_CARGO_SURGE',
    displayName: 'Unstable Cargo Surge',
    summaryTemplate: 'Powerful but dangerous material is surfacing through {sector}. {anchor} is bleeding unstable cargo into the route.',
    baseWeight: 10,
    anchorTypeBonus: { LEY_NEXUS: 6, ASHEN_HEART: 6, RIFT_ENGINE: 5 },
    anchorModifierBonus: { LEAKING: 8, BLOOMING: 6, RAVENOUS: 8, OVERFED: 5 },
    operationKindBonus: { RESOURCE_SURVEY: 6, EXTRACTION_SURGE: 4 },
    sectorBonus: {},
    echoActivityBonus: {},
    hazardBonus: (h) => (h >= 4 ? 5 : 0),
    rewardBonus: (r) => (r >= 3 ? 4 : 0),
    pressureTags: ['UNSTABLE', 'RESOURCE'],
    resourceIds: ['veil-ash-canister', 'ossified-ley-knot', 'anchor-marrow', 'breach-thread'],
    scannerOverlays: { highValueResource: 1.2, highRisk: 1.2 },
    encounterModifiers: { UNSTABLE: 1.3, STARVED: 1.15, BLEEDING: 1.1 },
    twistedTemplates: { RESOURCE_BLOOM: 1.2 },
    operationKinds: ['RESOURCE_SURVEY', 'EXTRACTION_SURGE'],
    contractSources: { SECTOR_RESOURCE: 6, WILDCARD: 4 },
    contractKinds: { EXTRACT_UNSTABLE_CARGO: 5, EXTRACT_SPONSOR_RESOURCE: 3 },
    sponsorBoost: { SOLARIS: 8 },
    depth2: { UNSTABLE_MATTER: 12, BLEEDING_ARCHITECTURE: 8 },
    depth3: { THE_WALLS_ARE_HUNGRY: 8 },
    nodeOverlays: ['HIGH_VALUE_RESOURCE', 'HIGH_RISK_ZONE'],
    rivalMercBoost: 0,
    flavorLine: 'Unstable cargo signatures surfacing.',
  },
};

export const ALL_CRISIS_THEMES: CrisisTheme[] = Object.keys(CRISIS_THEME_DEFINITIONS) as CrisisTheme[];

export function getCrisisThemeDefinition(theme: CrisisTheme): CrisisThemeDefinition {
  return CRISIS_THEME_DEFINITIONS[theme];
}

export function fillCrisisSummary(
  template: string,
  sector: string,
  anchor: string,
): string {
  return template
    .replace(/\{sector\}/g, sector)
    .replace(/\{anchor\}/g, anchor);
}
