import type {
  Biome,
  ComplicationSeed,
  ContextSeed,
  ResolverSet,
  Tag,
} from '../../types/narrativeAssembly';

/** Tags must intersect — prevents incompatible context/complication pairings. */
export function tagsCompatible(
  contextTags: readonly string[],
  requiredTags: readonly string[],
): boolean {
  if (requiredTags.length === 0) return true;
  const contextSet = new Set(contextTags);
  return requiredTags.some((tag) => contextSet.has(tag));
}

export function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function pickFromPool<T>(
  pool: readonly T[],
  seed: string,
  usedKeys: readonly string[],
  getKey: (entry: T) => string,
): T {
  if (pool.length === 0) {
    throw new Error('pickFromPool: empty candidate pool');
  }
  const unused = pool.filter((entry) => !usedKeys.includes(getKey(entry)));
  const candidates = unused.length > 0 ? unused : [...pool];
  const index = hashSeed(seed) % candidates.length;
  return candidates[index] ?? candidates[0];
}

export function filterContextsForBiome(
  contexts: readonly ContextSeed[],
  biome: Biome,
  requiredContextTags?: readonly Tag[],
): ContextSeed[] {
  let filtered = contexts.filter((ctx) => ctx.biomes.includes(biome));
  if (requiredContextTags?.length) {
    filtered = filtered.filter((ctx) => tagsCompatible(ctx.tags, requiredContextTags));
  }
  return filtered;
}

export function filterComplicationsForContextSeed(
  context: ContextSeed,
  complications: readonly ComplicationSeed[],
): ComplicationSeed[] {
  return complications.filter((cmp) => tagsCompatible(context.tags, cmp.requiredTags));
}

export function filterComplicationsWithResolverSets(
  complications: readonly ComplicationSeed[],
  resolverSets: readonly ResolverSet[],
): ComplicationSeed[] {
  const resolvableIds = new Set(resolverSets.map((set) => set.complicationId));
  return complications.filter((cmp) => resolvableIds.has(cmp.id));
}

export function assemblyIdFor(contextId: string, complicationId: string, seed: string): string {
  return `asm-${contextId}-${complicationId}-${hashSeed(seed)}`;
}

export function isAssemblyPairUsed(
  contextId: string,
  complicationId: string,
  usedAssemblyIds: readonly string[],
): boolean {
  const prefix = `${contextId}-${complicationId}-`;
  return usedAssemblyIds.some(
    (id) =>
      id.startsWith(`asm-${prefix}`) ||
      id.startsWith(`proc-${prefix}`) ||
      id === `asm-${contextId}-${complicationId}` ||
      id === `proc-${contextId}-${complicationId}`,
  );
}

export function buildScenarioText(context: ContextSeed, complication: ComplicationSeed): string {
  return `${context.flavorText} ${complication.flavorText}`.trim();
}

export interface AssemblyCandidate {
  context: ContextSeed;
  complication: ComplicationSeed;
  resolverSet: ResolverSet;
}

export function buildAssemblyCandidates(
  contexts: readonly ContextSeed[],
  complications: readonly ComplicationSeed[],
  resolverSets: readonly ResolverSet[],
): AssemblyCandidate[] {
  const resolvableComplications = filterComplicationsWithResolverSets(complications, resolverSets);
  const resolverByComplication = new Map<string, ResolverSet[]>();
  for (const set of resolverSets) {
    const bucket = resolverByComplication.get(set.complicationId) ?? [];
    bucket.push(set);
    resolverByComplication.set(set.complicationId, bucket);
  }

  const candidates: AssemblyCandidate[] = [];
  for (const context of contexts) {
    const matched = filterComplicationsForContextSeed(context, resolvableComplications);
    const complicationPool =
      matched.length > 0 ? matched : resolvableComplications;
    for (const complication of complicationPool) {
      const sets = resolverByComplication.get(complication.id);
      if (!sets?.length) continue;
      for (const resolverSet of sets) {
        candidates.push({ context, complication, resolverSet });
      }
    }
  }
  return candidates;
}

/** Dev-only sanity checks — call manually; no test runner in repo. */
export function runNarrativeAssemblyCoreSelfCheck(): void {
  const ctx: ContextSeed = {
    id: 'TEST_CTX',
    biomes: ['city_streets'],
    tags: ['urban', 'physical'],
    flavorText: 'Alley.',
  };
  const cmp: ComplicationSeed = {
    id: 'TEST_CMP',
    requiredTags: ['urban', 'physical'],
    flavorText: 'Patrol.',
    defaultPenalty: { type: 'HP', amount: 10 },
  };
  const mismatch: ComplicationSeed = {
    ...cmp,
    id: 'TEST_MISMATCH',
    requiredTags: ['nature'],
  };

  if (!tagsCompatible(ctx.tags, cmp.requiredTags)) {
    throw new Error('selfCheck: expected compatible tags');
  }
  if (tagsCompatible(ctx.tags, mismatch.requiredTags)) {
    throw new Error('selfCheck: expected incompatible tags');
  }

  const filtered = filterComplicationsForContextSeed(ctx, [cmp, mismatch]);
  if (filtered.length !== 1 || filtered[0]?.id !== 'TEST_CMP') {
    throw new Error('selfCheck: complication filter failed');
  }

  const id1 = assemblyIdFor('CTX_01', 'COMP_01', 'seed-a');
  const id2 = assemblyIdFor('CTX_01', 'COMP_01', 'seed-a');
  if (id1 !== id2) {
    throw new Error('selfCheck: assembly id must be deterministic');
  }
  if (!isAssemblyPairUsed('CTX_01', 'COMP_01', [id1])) {
    throw new Error('selfCheck: assembly pair usage detection failed');
  }

  const picked = pickFromPool([cmp, mismatch], 'fixed-seed', [], (entry) => entry.id);
  if (!picked) {
    throw new Error('selfCheck: pickFromPool returned empty');
  }
}
