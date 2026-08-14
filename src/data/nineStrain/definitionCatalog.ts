import type { UniversalBoonDefinition } from '../../types/nineStrain';
import { COUNTERFATE_DEFINITIONS } from './counterfateDefinitions';
import { RITUAL_CADENCE_DEFINITIONS } from './ritualCadenceDefinitions';
import { CORE_IMPRINTS } from './strainRegistry';

const LIVE_DEFINITIONS: UniversalBoonDefinition[] = [
  ...COUNTERFATE_DEFINITIONS,
  ...RITUAL_CADENCE_DEFINITIONS,
];

export function getLiveUniversalBoonDefinitions(): readonly UniversalBoonDefinition[] {
  return LIVE_DEFINITIONS;
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
