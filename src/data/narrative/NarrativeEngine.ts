import type { Biome, GeneratedEncounter, Tag } from '../../types/narrativeAssembly';
import {
  COMPLICATION_SEEDS,
  CONTEXT_SEEDS,
  RESOLVER_SETS,
  getContextSeedsForBiome,
  getResolverSetsForComplication,
} from './narrativeCatalog';
import {
  assemblyIdFor,
  buildScenarioText,
  filterComplicationsForContextSeed,
  filterComplicationsWithResolverSets,
  filterContextsForBiome,
  isAssemblyPairUsed,
  pickFromPool,
} from './narrativeAssemblyCore';

export interface NarrativePlayerState {
  seed: string;
  usedAssemblyIds: readonly string[];
  /** When set, context must include at least one of these tags. */
  requiredContextTags?: readonly Tag[];
}

export function generateEncounter(
  currentBiome: Biome,
  playerState: NarrativePlayerState,
): GeneratedEncounter {
  let contextPool = filterContextsForBiome(
    CONTEXT_SEEDS,
    currentBiome,
    playerState.requiredContextTags,
  );
  if (contextPool.length === 0) {
    contextPool = filterContextsForBiome(CONTEXT_SEEDS, currentBiome);
  }
  if (contextPool.length === 0) {
    contextPool = [...getContextSeedsForBiome(currentBiome)];
  }
  if (contextPool.length === 0) {
    contextPool = [...CONTEXT_SEEDS];
  }

  const resolvableComplications = filterComplicationsWithResolverSets(
    COMPLICATION_SEEDS,
    RESOLVER_SETS,
  );
  if (resolvableComplications.length === 0) {
    throw new Error('generateEncounter: no complications with resolver sets in catalog');
  }

  const context = pickFromPool(
    contextPool,
    `${playerState.seed}:ctx`,
    playerState.usedAssemblyIds,
    (entry) => entry.id,
  );

  let complicationPool = filterComplicationsForContextSeed(context, resolvableComplications);
  if (complicationPool.length === 0) {
    complicationPool = [...resolvableComplications];
  }

  const unusedComplications = complicationPool.filter(
    (cmp) => !isAssemblyPairUsed(context.id, cmp.id, playerState.usedAssemblyIds),
  );
  if (unusedComplications.length > 0) {
    complicationPool = unusedComplications;
  }

  const complication = pickFromPool(
    complicationPool,
    `${playerState.seed}:cmp:${context.id}`,
    [],
    (entry) => entry.id,
  );

  const resolverPool = [...getResolverSetsForComplication(complication.id)];
  if (resolverPool.length === 0) {
    throw new Error(
      `generateEncounter: no resolver set for complication ${complication.id}`,
    );
  }

  const resolverSet = pickFromPool(
    resolverPool,
    `${playerState.seed}:res:${context.id}:${complication.id}`,
    [],
    (entry) => entry.id,
  );

  const assemblyId = assemblyIdFor(context.id, complication.id, playerState.seed);

  return {
    assemblyId,
    biome: currentBiome,
    context,
    complication,
    resolverSet,
    scenarioText: buildScenarioText(context, complication),
  };
}
