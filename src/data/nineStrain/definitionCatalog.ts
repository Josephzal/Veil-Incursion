import type { UniversalBoonDefinition } from '../../types/nineStrain';
import { COUNTERFATE_DEFINITIONS } from './counterfateDefinitions';
import { RITUAL_CADENCE_DEFINITIONS } from './ritualCadenceDefinitions';
import { AFTERIMAGE_DEFINITIONS } from './afterimageDefinitions';
import { SECTOR_1_CONVERGENCE_DEFINITIONS, SECTOR_2_CONVERGENCE_DEFINITIONS } from './convergenceDefinitions';
import { STILLPOINT_DEFINITIONS } from './stillpointDefinitions';
import { WOUNDWEAVE_DEFINITIONS } from './woundweaveDefinitions';
import { FAULTLINE_DEFINITIONS } from './faultlineDefinitions';
import { SOULWAKE_DEFINITIONS } from './soulwakeDefinitions';
import { CORE_IMPRINTS } from './strainRegistry';

const LIVE_DEFINITIONS: UniversalBoonDefinition[] = [
  ...COUNTERFATE_DEFINITIONS,
  ...RITUAL_CADENCE_DEFINITIONS,
  ...AFTERIMAGE_DEFINITIONS,
  ...SECTOR_1_CONVERGENCE_DEFINITIONS,
  ...STILLPOINT_DEFINITIONS,
  ...WOUNDWEAVE_DEFINITIONS,
  ...SECTOR_2_CONVERGENCE_DEFINITIONS,
  ...FAULTLINE_DEFINITIONS,
  ...SOULWAKE_DEFINITIONS,
];

export function definitionAcquisitionWave(def: UniversalBoonDefinition): 1 | 2 | 3 {
  if (def.acquisitionWave === 2 || def.acquisitionWave === 3) return def.acquisitionWave;
  if (def.strainId === 'FAULTLINE' || def.strainId === 'SOULWAKE') return 3;
  if (def.strainId === 'STILLPOINT' || def.strainId === 'WOUNDWEAVE') return 2;
  return 1;
}

/** Full authored runtime catalog, including Sector 2 families not yet on production offers. */
export function getLiveUniversalBoonDefinitions(): readonly UniversalBoonDefinition[] {
  return LIVE_DEFINITIONS;
}

/** Ordinary Contacts / Omen / elite / boss production pool. */
export function getSector1ProductionDefinitions(): readonly UniversalBoonDefinition[] {
  return LIVE_DEFINITIONS.filter((row) => definitionAcquisitionWave(row) === 1 && !row.testOnly);
}

export function getProductionOfferDefinitions(maxWave: 1 | 2 | 3 = 1): readonly UniversalBoonDefinition[] {
  return LIVE_DEFINITIONS.filter((row) => !row.testOnly && definitionAcquisitionWave(row) <= maxWave);
}

export function assertUniqueDefinitionIds(definitions: readonly UniversalBoonDefinition[]): void {
  const seen = new Set<string>();
  for (const def of definitions) {
    if (seen.has(def.id)) {
      throw new Error(`Duplicate universal boon definition id: ${def.id}`);
    }
    seen.add(def.id);
  }
}

export function assertCoreImprintContract(def: UniversalBoonDefinition): void {
  if (def.role === 'CORE') {
    if (!def.imprint || !(CORE_IMPRINTS as readonly string[]).includes(def.imprint)) {
      throw new Error(`Core ${def.id} must occupy a contested imprint`);
    }
  } else if (def.imprint) {
    throw new Error(`${def.role} ${def.id} must not occupy an imprint`);
  }
  if (def.role === 'CONVERGENCE') {
    if (!def.secondaryStrainId || def.secondaryStrainId === def.strainId) {
      throw new Error(`Convergence ${def.id} requires two distinct parent strains`);
    }
  }
}

export function indexDefinitions(
  definitions: readonly UniversalBoonDefinition[],
): Map<string, UniversalBoonDefinition> {
  assertUniqueDefinitionIds(definitions);
  for (const def of definitions) assertCoreImprintContract(def);
  return new Map(definitions.map((def) => [def.id, def]));
}
