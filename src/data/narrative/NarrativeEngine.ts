import type { Biome, GeneratedEncounter, Tag } from '../../types/narrativeAssembly';
import { isOptionABruteForce } from '../../types/narrativeAssembly';
import {
  COMPLICATION_SEEDS,
  CONTEXT_SEEDS,
  RESOLVER_SETS,
  USE_ASSEMBLY_V2,
  getContextSeedsForBiome,
  getResolverSetsForComplication,
} from './narrativeCatalog';
import {
  assemblyIdFor,
  buildScenarioText,
  filterComplicationsForContextSeed,
  filterComplicationsWithResolverSets,
  filterContextsForBiome,
  hashSeed,
  isAssemblyPairUsed,
  pickFromPool,
} from './narrativeAssemblyCore';
import { rollNarrativeBonusReward } from './narrativeBonusLoot';
import {
  assembleDynamicResolverSet,
  pickDynamicResolverTemplates,
} from './narrativeDynamicAssembly';
import {
  pickActiveGenerationTensionMechanic,
  remapDeprecatedScavengeBar,
} from './tensionMechanicRouting';

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

  const complicationPoolSource = USE_ASSEMBLY_V2
    ? COMPLICATION_SEEDS
    : filterComplicationsWithResolverSets(COMPLICATION_SEEDS, RESOLVER_SETS);
  if (complicationPoolSource.length === 0) {
    throw new Error('generateEncounter: no complications in catalog');
  }

  const context = pickFromPool(
    contextPool,
    `${playerState.seed}:ctx`,
    playerState.usedAssemblyIds,
    (entry) => entry.id,
  );

  let complicationPool = filterComplicationsForContextSeed(context, complicationPoolSource);
  if (complicationPool.length === 0) {
    complicationPool = [...complicationPoolSource];
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

  const assemblySeed = `${playerState.seed}:res:${context.id}:${complication.id}`;
  let resolverSet;
  let dynamicSelection: ReturnType<typeof pickDynamicResolverTemplates> | undefined;

  if (USE_ASSEMBLY_V2) {
    dynamicSelection = pickDynamicResolverTemplates(assemblySeed);
    resolverSet = assembleDynamicResolverSet(complication, assemblySeed, dynamicSelection);
  } else {
    const resolverPool = [...getResolverSetsForComplication(complication.id)];
    if (resolverPool.length === 0) {
      throw new Error(
        `generateEncounter: no resolver set for complication ${complication.id}`,
      );
    }
    resolverSet = pickFromPool(
      resolverPool,
      assemblySeed,
      [],
      (entry) => entry.id,
    );
  }

  const assemblyId = assemblyIdFor(context.id, complication.id, playerState.seed);

  const tensionMechanic = isOptionABruteForce(resolverSet.optionA)
    ? pickActiveGenerationTensionMechanic(hashSeed(`${assemblyId}:bonus-mech`), {
      flavorText: `${resolverSet.optionA.text} ${complication.flavorText}`,
      tags: complication.requiredTags,
    })
    : remapDeprecatedScavengeBar(resolverSet.optionA.tensionMechanic, {
      flavorText: `${resolverSet.optionA.text} ${complication.flavorText}`,
      tags: complication.requiredTags,
      resolverSetId: resolverSet.id,
    });

  const bonusReward = tensionMechanic != null
    ? rollNarrativeBonusReward(
      tensionMechanic,
      `${playerState.seed}:bonus:${assemblyId}`,
    )
    : undefined;

  return {
    assemblyId,
    biome: currentBiome,
    context,
    complication,
    resolverSet,
    scenarioText: buildScenarioText(context, complication),
    bonusReward,
    dynamicSelection,
  };
}
