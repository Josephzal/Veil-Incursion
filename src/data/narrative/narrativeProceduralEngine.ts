import type { CargoRunState } from '../../types/cargoGrid';
import type {
  CheckStatus,
  EnvironmentalModifiers,
  FactionType,
  IncursionProgressState,
  NarrativeEventNode,
} from '../../types/game';
import type { RunState } from '../../types/run';
import type { NarrativeChoiceKey } from '../../types/game';
import type {
  MacroBiomeFamily,
  NarrativeComplicationSeed,
  NarrativeContextSeed,
  NarrativeResolverSeed,
  ProceduralNarrativeAssembly,
  RunDepth,
} from '../../types/narrativeProcedural';
import { getDistrictFromDepth, depthFromNodesCleared } from '../districtPacing';
import { consumeCargoItem, hasCargoItem } from '../cargoGridEngine';
import type { NarrativeResolutionResult, OperativeResourceSnapshot } from '../narrativeEncounterMatrix';
import { CITY_STREETS_COMPLICATIONS } from './catalogs/cityStreetsComplications';
import { CITY_STREETS_CONTEXTS } from './catalogs/cityStreetsContexts';
import { CITY_STREETS_RESOLVERS } from './catalogs/cityStreetsResolvers';

export interface GenerateNarrativeEncounterParams {
  macroFamily?: MacroBiomeFamily;
  nodesCleared: number;
  seed: string;
  usedAssemblyIds: readonly string[];
  /** When set, context must include one of these tags (e.g. faction vault nodes). */
  requiredContextTags?: readonly string[];
}

export interface ProceduralEligibilityContext {
  alignedFaction: FactionType | null;
  cargo: CargoRunState;
}

const CONTEXTS_BY_FAMILY: Record<MacroBiomeFamily, readonly NarrativeContextSeed[]> = {
  CITY_STREETS: CITY_STREETS_CONTEXTS,
  CITY_BUILDINGS: CITY_STREETS_CONTEXTS,
  FORESTS: CITY_STREETS_CONTEXTS,
  UNDERGROUND: CITY_STREETS_CONTEXTS,
  BACKROADS: CITY_STREETS_CONTEXTS,
  DEEP_VEIL: CITY_STREETS_CONTEXTS,
};

const COMPLICATIONS_BY_FAMILY: Record<MacroBiomeFamily, readonly NarrativeComplicationSeed[]> = {
  CITY_STREETS: CITY_STREETS_COMPLICATIONS,
  CITY_BUILDINGS: CITY_STREETS_COMPLICATIONS,
  FORESTS: CITY_STREETS_COMPLICATIONS,
  UNDERGROUND: CITY_STREETS_COMPLICATIONS,
  BACKROADS: CITY_STREETS_COMPLICATIONS,
  DEEP_VEIL: CITY_STREETS_COMPLICATIONS,
};

const RESOLVERS_BY_FAMILY: Record<MacroBiomeFamily, readonly NarrativeResolverSeed[]> = {
  CITY_STREETS: CITY_STREETS_RESOLVERS,
  CITY_BUILDINGS: CITY_STREETS_RESOLVERS,
  FORESTS: CITY_STREETS_RESOLVERS,
  UNDERGROUND: CITY_STREETS_RESOLVERS,
  BACKROADS: CITY_STREETS_RESOLVERS,
  DEEP_VEIL: CITY_STREETS_RESOLVERS,
};

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickFromPool<T extends { id: string }>(
  pool: readonly T[],
  seed: string,
  usedIds: readonly string[],
): T {
  const unused = pool.filter((entry) => !usedIds.includes(entry.id));
  const candidates = unused.length > 0 ? unused : [...pool];
  const index = hashSeed(seed) % candidates.length;
  return candidates[index] ?? candidates[0];
}

/** Tags must intersect — prevents incompatible context/complication pairings. */
export function tagsCompatible(
  contextTags: readonly string[],
  requiredTags: readonly string[],
): boolean {
  if (requiredTags.length === 0) return true;
  const contextSet = new Set(contextTags);
  return requiredTags.some((tag) => contextSet.has(tag));
}

export function filterComplicationsForContext(
  context: NarrativeContextSeed,
  complications: readonly NarrativeComplicationSeed[],
): NarrativeComplicationSeed[] {
  return complications.filter((cmp) => tagsCompatible(context.tags, cmp.requiresTags));
}

export function filterResolversForAssembly(
  context: NarrativeContextSeed,
  complication: NarrativeComplicationSeed,
  resolvers: readonly NarrativeResolverSeed[],
  kind: NarrativeResolverSeed['kind'],
): NarrativeResolverSeed[] {
  const tagUnion = new Set([...context.tags, ...complication.requiresTags]);
  return resolvers.filter((resolver) => {
    if (resolver.kind !== kind) return false;
    return resolver.compatibleTags.some((tag) => tagUnion.has(tag));
  });
}

function runDepthFromNodesCleared(nodesCleared: number): RunDepth {
  return getDistrictFromDepth(depthFromNodesCleared(nodesCleared));
}

function pctDelta(value: number, pct: number): number {
  return Math.max(0, Math.round(value * (1 + pct / 100)));
}

function pctLoss(value: number, pct: number): number {
  return Math.max(0, Math.round(value * (1 - pct / 100)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildChoiceOption(
  label: string,
  requirement: string,
  costPreview: string,
  rewardPreview: string,
  locked: boolean,
  lockReason?: string,
): import('../../types/game').NarrativeChoiceOption {
  const preview = `${costPreview} // ${rewardPreview}`;
  return {
    label,
    requirement,
    successText: `>> RESOLVER LOCKED — ${preview}`,
    failureText: lockReason
      ? `>> RESOLVER BLOCKED — ${lockReason}`
      : '>> RESOLVER BLOCKED — REQUIREMENTS NOT MET.',
    effectPreview: { guaranteed: preview },
    locked,
    lockReason,
  };
}

function evaluateResolverEligibility(
  resolver: NarrativeResolverSeed,
  eligibility: ProceduralEligibilityContext,
): { locked: boolean; lockReason?: string } {
  if (resolver.requiresCabal && resolver.requiresCabal !== eligibility.alignedFaction) {
    const cabalLabel = resolver.requiresCabal.replace(/_/g, ' ');
    return { locked: true, lockReason: `REQUIRES ${cabalLabel} CABAL` };
  }
  if (resolver.requiresItem && !hasCargoItem(eligibility.cargo, resolver.requiresItem)) {
    const itemName = resolver.requiresItem.replace(/-/g, ' ').toUpperCase();
    return { locked: true, lockReason: `REQUIRES ITEM: ${itemName}` };
  }
  return { locked: false };
}

export function generateNarrativeEncounter(
  params: GenerateNarrativeEncounterParams,
  eligibility: ProceduralEligibilityContext,
): { assembly: ProceduralNarrativeAssembly; node: NarrativeEventNode } {
  const macroFamily = params.macroFamily ?? 'CITY_STREETS';
  const depth = runDepthFromNodesCleared(params.nodesCleared);
  const contexts = CONTEXTS_BY_FAMILY[macroFamily];
  const complications = COMPLICATIONS_BY_FAMILY[macroFamily];
  const resolvers = RESOLVERS_BY_FAMILY[macroFamily];

  const contextPool = params.requiredContextTags?.length
    ? contexts.filter((ctx) => tagsCompatible(ctx.tags, params.requiredContextTags!))
    : contexts;
  const context = pickFromPool(
    contextPool.length > 0 ? contextPool : contexts,
    `${params.seed}:ctx`,
    params.usedAssemblyIds,
  );
  const compatible = filterComplicationsForContext(context, complications);
  const complicationPool = compatible.length > 0 ? compatible : [...complications];
  const complication = pickFromPool(
    complicationPool,
    `${params.seed}:cmp:${context.id}`,
    params.usedAssemblyIds,
  );

  const cabalPool = filterResolversForAssembly(context, complication, resolvers, 'CABAL');
  const macroPool = filterResolversForAssembly(context, complication, resolvers, 'MACRO');
  const cabalCandidates = cabalPool.length > 0 ? cabalPool : macroPool;
  const cabalResolver = pickFromPool(
    cabalCandidates.length > 0 ? cabalCandidates : resolvers.filter((r) => r.kind === 'CABAL'),
    `${params.seed}:cabal:${context.id}:${complication.id}`,
    [],
  );

  const itemPool = filterResolversForAssembly(context, complication, resolvers, 'ITEM');
  const itemResolver = pickFromPool(
    itemPool.length > 0 ? itemPool : resolvers.filter((r) => r.kind === 'ITEM'),
    `${params.seed}:item:${context.id}:${complication.id}`,
    [],
  );

  const assembly: ProceduralNarrativeAssembly = {
    assemblyId: `proc-${context.id}-${complication.id}-${hashSeed(params.seed)}`,
    macroFamily,
    depth,
    contextId: context.id,
    complicationId: complication.id,
    resolverIds: {
      brute: complication.id,
      cabal: cabalResolver.id,
      item: itemResolver.id,
      retreat: 'static-retreat',
    },
  };

  const scenarioText = [
    context.proseLead,
    complication.proseClause,
    'A high-density extraction opportunity is visible inside the chamber.',
  ].join(' ');

  const cabalGate = evaluateResolverEligibility(cabalResolver, eligibility);
  const itemGate = evaluateResolverEligibility(itemResolver, eligibility);

  const node: NarrativeEventNode = {
    id: assembly.assemblyId,
    interactionMode: 'procedural',
    title: context.title,
    scenarioText,
    hazardPreview: complication.hazardPreview,
    choiceA: buildChoiceOption(
      complication.bruteLabel,
      complication.bruteRequirement,
      complication.bruteCostPreview,
      complication.bruteRewardPreview,
      false,
    ),
    choiceB: buildChoiceOption(
      cabalResolver.label,
      cabalResolver.requirement,
      cabalResolver.costPreview,
      cabalResolver.rewardPreview,
      cabalGate.locked,
      cabalGate.lockReason,
    ),
    choiceC: buildChoiceOption(
      itemResolver.label,
      itemResolver.requirement,
      itemResolver.costPreview,
      itemResolver.rewardPreview,
      itemGate.locked,
      itemGate.lockReason,
    ),
    choiceD: {
      label: '[ D ] ABORT PROTOCOL',
      requirement: 'RETURN TO SCANNER',
      successText: '>> ABORT CONFIRMED — ROUTING TERMINAL BACK TO LEY-LINE GRID.',
      failureText: '>> ABORT CONFIRMED — ROUTING TERMINAL BACK TO LEY-LINE GRID.',
      effectPreview: { guaranteed: 'Return to overworld map without resolving encounter.' },
    },
  };

  return { assembly, node };
}

function lookupContext(id: string): NarrativeContextSeed {
  return CITY_STREETS_CONTEXTS.find((ctx) => ctx.id === id) ?? CITY_STREETS_CONTEXTS[0];
}

function lookupComplication(id: string): NarrativeComplicationSeed {
  return CITY_STREETS_COMPLICATIONS.find((cmp) => cmp.id === id) ?? CITY_STREETS_COMPLICATIONS[0];
}

function lookupResolver(id: string): NarrativeResolverSeed | null {
  return CITY_STREETS_RESOLVERS.find((res) => res.id === id) ?? null;
}

function applyResonanceSpike(
  env: EnvironmentalModifiers,
  spike: number,
): EnvironmentalModifiers {
  if (spike <= 0) return env;
  return {
    ...env,
    resonancePercent: clamp((env.resonancePercent ?? 0) + spike, 0, 100),
  };
}

export function resolveProceduralNarrativeChoice(
  assembly: ProceduralNarrativeAssembly,
  choice: NarrativeChoiceKey,
  progress: IncursionProgressState,
  env: EnvironmentalModifiers,
  snapshot: OperativeResourceSnapshot,
  eligibility: ProceduralEligibilityContext,
  currentResonancePercent: number,
): NarrativeResolutionResult {
  const context = lookupContext(assembly.contextId);
  const complication = lookupComplication(assembly.complicationId);
  const usedIds = [...progress.usedNarrativeEventIds, assembly.assemblyId];

  if (choice === 'D') {
    return {
      logLines: ['>> ABORT PROTOCOL — EXPEDITION RESOLVER DISENGAGED.', '>> RETURNING TO SCANNER HUB.'],
      flagsAdded: [],
      progress,
      runPatch: {},
      status: 'NOT_TESTED' as CheckStatus,
      outcomeText: '>> ABORT CONFIRMED — ROUTING TERMINAL BACK TO LEY-LINE GRID.',
      environmentalModifiers: env,
      cryptoGlimmerGrantPct: 0,
      triggerCombatAmbush: false,
      abortToScanner: true,
    };
  }

  let runPatch: Partial<RunState> = {};
  let cargoPatch: CargoRunState | undefined;
  let nextEnv = env;
  let resonanceDelta = 0;
  const logLines: string[] = [`>> PROCEDURAL RESOLVER // ${context.title}`];
  let outcome = '';
  let status: CheckStatus = 'SUCCESS';
  let triggerCombatAmbush = false;
  let spawnGridHound = false;
  let cryptoGlimmerGrantPct = 0;
  const flagsAdded: string[] = [];

  if (choice === 'A') {
    runPatch.soulAnchorIntegrity = clamp(
      pctLoss(snapshot.soulAnchorIntegrity, complication.hpCostPct),
      1,
      snapshot.maxSoulAnchor,
    );
    resonanceDelta += complication.resonanceSpike;
    nextEnv = applyResonanceSpike(nextEnv, complication.resonanceSpike);
    triggerCombatAmbush = complication.ambushOnBrute === true;
    spawnGridHound = complication.spawnGridHoundOnBrute === true;
    if (complication.rewardFlag) flagsAdded.push(complication.rewardFlag);
    logLines.push(
      `>> BRUTE RESOLVER — ${complication.bruteCostPreview}`,
      `>> ${complication.bruteRewardPreview}`,
    );
    outcome = `>> BRUTE FORCE SUCCESS — ${complication.bruteRewardPreview}`;
    if (triggerCombatAmbush) {
      logLines.push('>> HOSTILE SIGNATURES DETECTED — AMBUSH IMMINENT.');
      outcome += ' // AMBUSH TRIGGERED';
    }
    if (spawnGridHound) {
      logLines.push('>> FACTION VAULT ALARM — GRID-HOUND DEPLOYED ON OVERWORLD.');
    }
  }

  if (choice === 'B') {
    const resolver = lookupResolver(assembly.resolverIds.cabal);
    if (!resolver) {
      return blockedResult(progress, env, '>> CABAL RESOLVER MISSING FROM CATALOG.');
    }
    const gate = evaluateResolverEligibility(resolver, eligibility);
    if (gate.locked) {
      return blockedResult(progress, env, `>> ${gate.lockReason ?? 'REQUIREMENTS NOT MET'}.`);
    }
    if (resolver.hpCostPct) {
      runPatch.soulAnchorIntegrity = clamp(
        pctLoss(snapshot.soulAnchorIntegrity, resolver.hpCostPct),
        1,
        snapshot.maxSoulAnchor,
      );
    }
    if (resolver.shieldRestorePct) {
      runPatch.soulAnchorIntegrity = clamp(
        pctDelta(snapshot.soulAnchorIntegrity, resolver.shieldRestorePct),
        1,
        snapshot.maxSoulAnchor,
      );
    }
    resonanceDelta += resolver.resonanceSpike ?? 0;
    nextEnv = applyResonanceSpike(nextEnv, resolver.resonanceSpike ?? 0);
    if (resolver.rewardFlag) flagsAdded.push(resolver.rewardFlag);
    if (resolver.macroThreatReduction) {
      nextEnv = {
        ...nextEnv,
        enemyDamageReductionPct: (nextEnv.enemyDamageReductionPct ?? 0) + resolver.macroThreatReduction * 10,
      };
      logLines.push(`>> MACRO SHIFT — future threat output reduced.`);
    }
    if (resolver.macroResonanceSpike) {
      resonanceDelta += resolver.macroResonanceSpike;
      nextEnv = applyResonanceSpike(nextEnv, resolver.macroResonanceSpike);
    }
    logLines.push(`>> CABAL RESOLVER — ${resolver.label}`, `>> ${resolver.rewardPreview}`);
    outcome = `>> CABAL RESOLVER SUCCESS — ${resolver.rewardPreview}`;
  }

  if (choice === 'C') {
    const resolver = lookupResolver(assembly.resolverIds.item);
    if (!resolver) {
      return blockedResult(progress, env, '>> ITEM RESOLVER MISSING FROM CATALOG.');
    }
    const gate = evaluateResolverEligibility(resolver, eligibility);
    if (gate.locked) {
      return blockedResult(progress, env, `>> ${gate.lockReason ?? 'REQUIREMENTS NOT MET'}.`);
    }
    if (resolver.requiresItem && resolver.consumesItem) {
      const consumed = consumeCargoItem(eligibility.cargo, resolver.requiresItem);
      if (!consumed) {
        return blockedResult(progress, env, '>> ITEM NOT FOUND IN CARGO GRID.');
      }
      cargoPatch = consumed;
    }
    if (resolver.rewardFlag) flagsAdded.push(resolver.rewardFlag);
    logLines.push(`>> ITEM RESOLVER — ${resolver.label}`, `>> ${resolver.rewardPreview}`);
    outcome = `>> ITEM RESOLVER SUCCESS — ${resolver.rewardPreview}`;
  }

  const creditReward = choice === 'A'
    ? complication.rewardCredits
    : choice === 'B'
      ? lookupResolver(assembly.resolverIds.cabal)?.rewardCredits ?? 0
      : lookupResolver(assembly.resolverIds.item)?.rewardCredits ?? 0;

  if (creditReward > 0) {
    logLines.push(`>> RUN CREDITS PENDING — +${creditReward} on node clear.`);
  }

  return {
    logLines,
    flagsAdded,
    progress: {
      ...progress,
      collectedFlags: [...progress.collectedFlags, ...flagsAdded],
      usedNarrativeEventIds: usedIds,
      pendingCombatAmbush: triggerCombatAmbush || progress.pendingCombatAmbush,
    },
    runPatch,
    cargoPatch,
    status,
    outcomeText: outcome,
    environmentalModifiers: nextEnv,
    cryptoGlimmerGrantPct,
    triggerCombatAmbush,
    pendingRunCredits: creditReward,
    resonanceDelta,
    spawnGridHound,
  };
}

export function refreshProceduralNarrativeLocks(
  node: NarrativeEventNode,
  assembly: ProceduralNarrativeAssembly,
  eligibility: ProceduralEligibilityContext,
): NarrativeEventNode {
  if (node.interactionMode !== 'procedural') return node;
  const cabalResolver = lookupResolver(assembly.resolverIds.cabal);
  const itemResolver = lookupResolver(assembly.resolverIds.item);
  if (!cabalResolver || !itemResolver) return node;

  const cabalGate = evaluateResolverEligibility(cabalResolver, eligibility);
  const itemGate = evaluateResolverEligibility(itemResolver, eligibility);

  return {
    ...node,
    choiceB: {
      ...node.choiceB,
      locked: cabalGate.locked,
      lockReason: cabalGate.lockReason,
    },
    choiceC: node.choiceC
      ? {
          ...node.choiceC,
          locked: itemGate.locked,
          lockReason: itemGate.lockReason,
        }
      : undefined,
  };
}

function blockedResult(
  progress: IncursionProgressState,
  env: EnvironmentalModifiers,
  outcome: string,
): NarrativeResolutionResult {
  return {
    logLines: [outcome],
    flagsAdded: [],
    progress,
    runPatch: {},
    status: 'FAILURE',
    outcomeText: outcome,
    environmentalModifiers: env,
    cryptoGlimmerGrantPct: 0,
    triggerCombatAmbush: false,
  };
}

/** All macro biome families route through procedural assembly (catalogs may share stubs). */
export function shouldUseProceduralNarrative(_macroFamily: MacroBiomeFamily): boolean {
  return true;
}

/** Dev-only tag compatibility self-check — throws on failure. */
export function verifyNarrativeProceduralEngine(): void {
  for (const context of CITY_STREETS_CONTEXTS) {
    const matches = filterComplicationsForContext(context, CITY_STREETS_COMPLICATIONS);
    if (matches.length === 0) {
      throw new Error(`No complications match context ${context.id}`);
    }
    for (const complication of matches) {
      const cabal = filterResolversForAssembly(
        context,
        complication,
        CITY_STREETS_RESOLVERS,
        'CABAL',
      );
      const item = filterResolversForAssembly(
        context,
        complication,
        CITY_STREETS_RESOLVERS,
        'ITEM',
      );
      if (cabal.length === 0 && item.length === 0) {
        throw new Error(`No resolvers for ${context.id} + ${complication.id}`);
      }
    }
  }

  const bogus = tagsCompatible(['hydro', 'outdoor'], ['tech', 'indoor']);
  if (bogus) throw new Error('Incompatible tags should not match');

  const sample = generateNarrativeEncounter(
    { nodesCleared: 0, seed: 'verify-seed', usedAssemblyIds: [] },
    { alignedFaction: 'SOLARIS', cargo: { grid: { placed: [] }, containment: [], dataBleedActive: false } },
  );
  if (sample.node.interactionMode !== 'procedural') {
    throw new Error('Generated node must be procedural');
  }
  if (!sample.node.choiceC || !sample.node.choiceD) {
    throw new Error('Generated node must expose four resolver options');
  }
}
