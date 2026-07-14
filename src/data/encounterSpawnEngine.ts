import type {
  EncounterOrigin,
  EncounterNodeTier,
  EncounterSquadTier,
  VeilBiome,
} from '../types/encounterSpawn';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import type { DistrictId } from './districtPacing';
import { localLevelFromDepth } from './districtPacing';
import { rollEncounterOrigin } from './originRollEngine';
import { rollThreatBudget, squadFitsThreatBudget } from './encounterThreatBudget';
import {
  passesHardCounterRules,
  squadEligibleForPickTier,
} from './encounterHardCounterEngine';
import {
  filterSquadsByEncounterOrigin,
  SQUAD_PICK_ATTEMPTS,
} from './encounterSquadOrigin';
import {
  filterSynergyDepthPool,
  filterSquadsBySpawnGates,
} from './synergySpawnEngine';
import type { SynergyBiome, SynergySquadSpec } from './synergyEncounterTypes';
import { macroFamilyToSynergyBiome } from './synergySpawnEngine';
import { veilBiomeToSynergyBiomes } from './sectorBiomeBridge';
import { seededRandom } from './encounterGenerator';
import type { SpawnGateContext } from './encounterSpawnGateEngine';
import { tryPickCompositionSquad } from './encounterCompositionPickEngine';
import type { EncounterCompositionPickMeta } from '../types/encounterComposition';
import type { OperationObjectiveKind } from '../types/worldState';

export interface ProceduralEncounterPickContext {
  globalDepth: number;
  district: DistrictId;
  seed: string;
  veilBiome?: VeilBiome | null;
  macroBiome?: MacroBiomeFamily | null;
  squadTier: EncounterSquadTier;
  nodeTier?: EncounterNodeTier;
  lastEncounterId?: string | null;
  lastEncounterOrigin?: EncounterOrigin | null;
  /** Node overlays — bias composition template selection (Phase A). */
  highValue?: boolean;
  highRisk?: boolean;
  anchorSignal?: boolean;
  echoSignal?: boolean;
  operationKind?: OperationObjectiveKind | null;
  foreshadowBias?: boolean;
}

export interface ProceduralEncounterPickResult {
  squad: SynergySquadSpec;
  encounterOrigin: EncounterOrigin;
  threatBudget: number;
  composition?: EncounterCompositionPickMeta;
}

function pickFromPool(
  pool: SynergySquadSpec[],
  rand: () => number,
  lastEncounterId: string | null,
): SynergySquadSpec | null {
  if (pool.length === 0) return null;
  const candidates = lastEncounterId != null
    ? pool.filter((squad) => squad.id !== lastEncounterId)
    : pool;
  const pickPool = candidates.length > 0 ? candidates : pool;
  const idx = Math.floor(rand() * pickPool.length);
  return pickPool[idx] ?? null;
}

function filterVeilBiomePool(
  depthPool: SynergySquadSpec[],
  veilBiome?: VeilBiome | null,
  synergyBiomes?: readonly SynergyBiome[],
): SynergySquadSpec[] {
  if (veilBiome) {
    const biomeLocked = depthPool.filter(
      (squad) => squad.veilBiome === veilBiome || squad.veilBiome == null,
    );
    if (biomeLocked.length > 0) return biomeLocked;
  }
  if (!synergyBiomes || synergyBiomes.length === 0) return depthPool;
  return depthPool.filter((squad) =>
    squad.allowedBiomes.some((biome) => synergyBiomes.includes(biome)),
  );
}

function resolveSynergyBiomes(ctx: ProceduralEncounterPickContext): SynergyBiome[] {
  if (ctx.veilBiome) {
    return [...veilBiomeToSynergyBiomes(ctx.veilBiome)];
  }
  return [macroFamilyToSynergyBiome(ctx.macroBiome)];
}

function applyPipelineFilters(
  pool: SynergySquadSpec[],
  ctx: {
    squadTier: EncounterSquadTier;
    nodeTier: EncounterNodeTier;
    depth: DistrictId;
    threatBudget: number;
  },
): SynergySquadSpec[] {
  return pool.filter((squad) => {
    if (!squadFitsThreatBudget(squad, ctx.threatBudget, ctx.squadTier)) return false;
    return passesHardCounterRules(squad, {
      depth: ctx.depth,
      tier: ctx.squadTier,
      nodeTier: ctx.nodeTier,
    });
  });
}

function tryPickSquad(
  depthPool: SynergySquadSpec[],
  veilBiome: VeilBiome | null | undefined,
  synergyBiomes: SynergyBiome[],
  rand: () => number,
  lastEncounterId: string | null,
  interloper: boolean | undefined,
): SynergySquadSpec | null {
  const biomePool = filterVeilBiomePool(depthPool, veilBiome, synergyBiomes);
  const primaryPool = biomePool.length > 0 ? biomePool : depthPool;
  const useInterloper = interloper ?? rand() > 0.8;
  const candidatePool = useInterloper ? depthPool : primaryPool;
  return pickFromPool(candidatePool, rand, lastEncounterId);
}

/**
 * Composition Phase A (preferred) → squad-deck fallback (Phase 5–6).
 * Origin → budget → role-template fill → fairness; on failure, deck pick.
 */
export function pickProceduralSynergySquad(
  ctx: ProceduralEncounterPickContext,
): ProceduralEncounterPickResult | null {
  const localLevel = localLevelFromDepth(ctx.globalDepth);
  const nodeIndexInDepth = localLevel;
  const nodeTier: EncounterNodeTier = ctx.nodeTier ?? 'NORMAL';
  const spawnGateContext: SpawnGateContext = {
    depth: ctx.district,
    nodeIndexInDepth,
    nodeTier,
    veilBiome: ctx.veilBiome ?? undefined,
  };

  const origin = rollEncounterOrigin(
    ctx.district,
    ctx.squadTier,
    ctx.seed,
    ctx.lastEncounterOrigin,
  );

  const rand = seededRandom(
    `${ctx.seed}:spawn:${ctx.globalDepth}:${origin}:${ctx.squadTier}:${ctx.lastEncounterId ?? 'none'}`,
  );
  const threatBudget = rollThreatBudget(ctx.district, ctx.squadTier, nodeIndexInDepth, rand);
  const synergyBiomes = resolveSynergyBiomes(ctx);

  const composition = tryPickCompositionSquad({
    depth: ctx.district,
    nodeIndexInDepth,
    squadTier: ctx.squadTier,
    nodeTier,
    veilBiome: ctx.veilBiome,
    seed: ctx.seed,
    encounterOrigin: origin,
    threatBudget,
    highValue: ctx.highValue,
    highRisk: ctx.highRisk,
    anchorSignal: ctx.anchorSignal,
    echoSignal: ctx.echoSignal,
    operationKind: ctx.operationKind,
    foreshadowBias: ctx.foreshadowBias ?? nodeIndexInDepth >= 10,
  }, rand);

  if (composition) {
    return {
      squad: composition.squad,
      encounterOrigin: origin,
      threatBudget,
      composition: composition.meta,
    };
  }

  let depthPool = filterSynergyDepthPool(ctx.district);
  depthPool = filterSquadsBySpawnGates(depthPool, spawnGateContext);
  depthPool = depthPool.filter((squad) => squadEligibleForPickTier(squad, ctx.squadTier));

  const lastEncounterId = ctx.lastEncounterId ?? null;

  for (const attempt of SQUAD_PICK_ATTEMPTS) {
    const originFiltered = attempt.filterOrigin
      ? filterSquadsByEncounterOrigin(depthPool, origin)
      : depthPool;
    if (originFiltered.length === 0) continue;

    const themed = applyPipelineFilters(originFiltered, {
      squadTier: ctx.squadTier,
      nodeTier,
      depth: ctx.district,
      threatBudget,
    });

    if (themed.length === 0) continue;

    const squad = tryPickSquad(
      themed,
      ctx.veilBiome,
      synergyBiomes,
      rand,
      lastEncounterId,
      attempt.interloper,
    );
    if (squad) {
      return { squad, encounterOrigin: origin, threatBudget };
    }
  }

  return null;
}

export function verifyEncounterSpawnPipeline(): void {
  const origins: EncounterOrigin[] = ['RIVAL_MERC', 'VEIL'];
  for (const depth of [1, 2, 3] as const) {
    for (const tier of ['NORMAL', 'ELITE'] as const) {
      for (const origin of origins) {
        const picked = pickProceduralSynergySquad({
          globalDepth: depth === 1 ? 3 : depth === 2 ? 18 : 33,
          district: depth,
          seed: `verify:${depth}:${tier}:${origin}`,
          veilBiome: 'NULL_ZONE',
          squadTier: tier,
          lastEncounterOrigin: origin,
        });
        if (!picked) {
          throw new Error(
            `verifyEncounterSpawnPipeline: no squad for D${depth} ${tier} (${origin})`,
          );
        }
        if (!passesHardCounterRules(picked.squad, {
          depth,
          tier,
          nodeTier: tier === 'ELITE' ? 'ELITE' : 'NORMAL',
        })) {
          throw new Error(
            `verifyEncounterSpawnPipeline: hard-counter violation in ${picked.squad.id} D${depth} ${tier}`,
          );
        }
        if (!squadFitsThreatBudget(picked.squad, picked.threatBudget, tier)) {
          throw new Error(
            `verifyEncounterSpawnPipeline: budget violation in ${picked.squad.id} D${depth} ${tier}`,
          );
        }
      }
    }
  }
}
