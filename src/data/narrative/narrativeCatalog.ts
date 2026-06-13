import contextSeedsJson from '../../../narrative/context_seeds.json';
import complicationSeedsJson from '../../../narrative/complication_seeds.json';
import resolverSetsJson from '../../../narrative/resolver_sets.json';
import type {
  ComplicationSeed,
  ContextSeed,
  ResolverSet,
} from '../../types/narrativeAssembly';
import { migrateLegacyNodes, type MigratedLegacyCatalog } from './migrateLegacyNodes';
import { tagsCompatible } from './narrativeAssemblyCore';

/** When true, legacy matrix events are merged into assembly catalog pools. */
export const INCLUDE_LEGACY_MIGRATED_SEEDS = false;

export const BASE_CONTEXT_SEEDS: readonly ContextSeed[] = contextSeedsJson as ContextSeed[];

export const BASE_COMPLICATION_SEEDS: readonly ComplicationSeed[] =
  complicationSeedsJson as ComplicationSeed[];

export const BASE_RESOLVER_SETS: readonly ResolverSet[] = resolverSetsJson as ResolverSet[];

export const MIGRATED_LEGACY_CATALOG: MigratedLegacyCatalog = migrateLegacyNodes();

export const LEGACY_CONTEXT_SEEDS: readonly ContextSeed[] = MIGRATED_LEGACY_CATALOG.contexts;
export const LEGACY_COMPLICATION_SEEDS: readonly ComplicationSeed[] =
  MIGRATED_LEGACY_CATALOG.complications;
export const LEGACY_RESOLVER_SETS: readonly ResolverSet[] = MIGRATED_LEGACY_CATALOG.resolverSets;

export const CONTEXT_SEEDS: readonly ContextSeed[] = INCLUDE_LEGACY_MIGRATED_SEEDS
  ? [...BASE_CONTEXT_SEEDS, ...LEGACY_CONTEXT_SEEDS]
  : BASE_CONTEXT_SEEDS;

export const COMPLICATION_SEEDS: readonly ComplicationSeed[] = INCLUDE_LEGACY_MIGRATED_SEEDS
  ? [...BASE_COMPLICATION_SEEDS, ...LEGACY_COMPLICATION_SEEDS]
  : BASE_COMPLICATION_SEEDS;

export const RESOLVER_SETS: readonly ResolverSet[] = INCLUDE_LEGACY_MIGRATED_SEEDS
  ? [...BASE_RESOLVER_SETS, ...LEGACY_RESOLVER_SETS]
  : BASE_RESOLVER_SETS;

const contextById = new Map(CONTEXT_SEEDS.map((seed) => [seed.id, seed]));
const complicationById = new Map(COMPLICATION_SEEDS.map((seed) => [seed.id, seed]));
const resolverSetById = new Map(RESOLVER_SETS.map((set) => [set.id, set]));
const resolverSetsByComplicationId = new Map<string, ResolverSet[]>();

for (const set of RESOLVER_SETS) {
  const existing = resolverSetsByComplicationId.get(set.complicationId) ?? [];
  existing.push(set);
  resolverSetsByComplicationId.set(set.complicationId, existing);
}

export function getContextSeedById(id: string): ContextSeed | undefined {
  return contextById.get(id);
}

export function getComplicationSeedById(id: string): ComplicationSeed | undefined {
  return complicationById.get(id);
}

export function getResolverSetById(id: string): ResolverSet | undefined {
  return resolverSetById.get(id);
}

export function getResolverSetsForComplication(complicationId: string): readonly ResolverSet[] {
  return resolverSetsByComplicationId.get(complicationId) ?? [];
}

export function getContextSeedsForBiome(biome: ContextSeed['biomes'][number]): ContextSeed[] {
  return CONTEXT_SEEDS.filter((seed) => seed.biomes.includes(biome));
}

export function getLegacyMigrationForMatrixId(matrixId: string) {
  return MIGRATED_LEGACY_CATALOG.matrixIndex[matrixId];
}

export function isLegacyMigratedContextId(contextId: string): boolean {
  return contextId.startsWith('LEGACY_CTX_');
}

export function isLegacyMigratedResolverSetId(resolverSetId: string): boolean {
  return resolverSetId.startsWith('LEGACY_RES_');
}

/** Dev-only — validates JSON assembly catalog integrity. */
export function verifyNarrativeAssemblyCatalog(): void {
  const resolvableComplicationIds = new Set(RESOLVER_SETS.map((set) => set.complicationId));
  for (const complication of COMPLICATION_SEEDS) {
    if (!resolvableComplicationIds.has(complication.id)) {
      throw new Error(`verifyNarrativeAssemblyCatalog: missing resolver set for ${complication.id}`);
    }
  }

  for (const context of CONTEXT_SEEDS) {
    const matches = COMPLICATION_SEEDS.filter((cmp) =>
      tagsCompatible(context.tags, cmp.requiredTags),
    );
    if (matches.length === 0) {
      throw new Error(`verifyNarrativeAssemblyCatalog: no complications match context ${context.id}`);
    }
  }

  const bogus = tagsCompatible(['hydro', 'outdoor'], ['tech', 'indoor']);
  if (bogus) {
    throw new Error('verifyNarrativeAssemblyCatalog: incompatible tags should not match');
  }
}
