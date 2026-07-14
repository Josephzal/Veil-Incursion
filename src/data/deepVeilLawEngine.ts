import type {
  DeepVeilLawId,
  DepthIdentityRevealPayload,
  DepthIdentityRollContext,
  DepthIdentityState,
  VeilDistortionId,
} from '../types/depthIdentity';
import { createDefaultDepthIdentityState } from '../types/depthIdentity';
import type { RunGenerationContext } from '../types/worldState';
import type { VeilBiome } from '../types/encounterSpawn';
import {
  ALL_DEEP_VEIL_LAW_IDS,
  DEEP_VEIL_LAW_DEFINITIONS,
  getDeepVeilLawDefinition,
  getVeilDistortionDefinition,
} from './depthIdentityCatalog';
import { buildDepthIdentityRollContext } from './veilDistortionEngine';

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function weightForLaw(id: DeepVeilLawId, ctx: DepthIdentityRollContext): number {
  const def = DEEP_VEIL_LAW_DEFINITIONS[id];
  let weight = 10;
  if (ctx.veilBiome && def.favoredBiomes.includes(ctx.veilBiome)) {
    weight += 18;
  }
  if (ctx.anchorType && def.favoredAnchors.includes(ctx.anchorType)) {
    weight += 14;
  }
  if (ctx.operationKind && def.favoredOperations.includes(ctx.operationKind)) {
    weight += 10;
  }
  return Math.max(1, weight);
}

export function rollDeepVeilLaw(
  ctx: DepthIdentityRollContext,
  activeDistortion: VeilDistortionId | null,
  forcedId?: DeepVeilLawId | null,
): { lawId: DeepVeilLawId; intensified: boolean } {
  if (forcedId && DEEP_VEIL_LAW_DEFINITIONS[forcedId]) {
    const intensified = Boolean(
      activeDistortion
      && getVeilDistortionDefinition(activeDistortion).intensifiesToLaw === forcedId,
    );
    return { lawId: forcedId, intensified };
  }

  const rng = seededRandom(`${ctx.seed}:deep-veil-law`);
  const intensifyTarget = activeDistortion
    ? getVeilDistortionDefinition(activeDistortion).intensifiesToLaw
    : null;

  if (intensifyTarget && rng() < 0.55) {
    return { lawId: intensifyTarget, intensified: true };
  }

  const weighted = ALL_DEEP_VEIL_LAW_IDS.map((id) => ({
    id,
    weight: weightForLaw(id, ctx),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) {
      return {
        lawId: entry.id,
        intensified: intensifyTarget === entry.id,
      };
    }
  }
  const last = weighted[weighted.length - 1]!;
  return {
    lawId: last.id,
    intensified: intensifyTarget === last.id,
  };
}

export function buildDeepVeilLawReveal(
  id: DeepVeilLawId,
  intensified: boolean,
): DepthIdentityRevealPayload {
  const def = getDeepVeilLawDefinition(id);
  return {
    kind: 'LAW',
    id,
    title: intensified
      ? `DEEP VEIL LAW — ${def.displayName.toUpperCase()} (INTENSIFIED)`
      : `DEEP VEIL LAW — ${def.displayName.toUpperCase()}`,
    summary: def.effectSummary,
    intensified,
  };
}

export function applyDeepVeilLawToState(
  prev: DepthIdentityState | null | undefined,
  lawId: DeepVeilLawId,
  intensified: boolean,
): DepthIdentityState {
  const base = prev ?? createDefaultDepthIdentityState();
  return {
    ...base,
    activeDeepVeilLaw: lawId,
    intensifiedFromDistortion: intensified,
    pendingReveal: buildDeepVeilLawReveal(lawId, intensified),
  };
}

export function formatDeepVeilLawLogLine(id: DeepVeilLawId, intensified: boolean): string {
  const def = getDeepVeilLawDefinition(id);
  const tag = intensified ? 'INTENSIFIED // ' : '';
  return `>> DEEP VEIL LAW — ${tag}${def.displayName.toUpperCase()} // ${def.effectSummary.toUpperCase()}`;
}

export function formatDeepVeilLawDebugLine(id: DeepVeilLawId): string {
  const def = getDeepVeilLawDefinition(id);
  return [
    `LAW: ${def.displayName}`,
    `fantasy: ${def.fantasy}`,
    `effect: ${def.effectSummary}`,
    `biomes: ${def.favoredBiomes.join(', ')}`,
    `anchors: ${def.favoredAnchors.join(', ')}`,
  ].join('\n');
}

let debugForcedLaw: DeepVeilLawId | null = null;

export function setDebugForcedDeepVeilLaw(id: DeepVeilLawId | null): void {
  debugForcedLaw = id;
}

export function getDebugForcedDeepVeilLaw(): DeepVeilLawId | null {
  return debugForcedLaw;
}

export function rollDeepVeilLawForRun(
  runContext: RunGenerationContext | null | undefined,
  veilBiome: VeilBiome | null | undefined,
  activeDistortion: VeilDistortionId | null,
  seed: string,
): { lawId: DeepVeilLawId; intensified: boolean } {
  const ctx = buildDepthIdentityRollContext(runContext, veilBiome, seed);
  return rollDeepVeilLaw(ctx, activeDistortion, debugForcedLaw);
}
