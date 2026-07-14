import type {
  DepthIdentityRevealPayload,
  DepthIdentityRollContext,
  DepthIdentityState,
  VeilDistortionId,
} from '../types/depthIdentity';
import { createDefaultDepthIdentityState } from '../types/depthIdentity';
import type { RunGenerationContext } from '../types/worldState';
import type { VeilBiome } from '../types/encounterSpawn';
import {
  ALL_VEIL_DISTORTION_IDS,
  getVeilDistortionDefinition,
  VEIL_DISTORTION_DEFINITIONS,
} from './depthIdentityCatalog';

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

function weightForDistortion(id: VeilDistortionId, ctx: DepthIdentityRollContext): number {
  const def = VEIL_DISTORTION_DEFINITIONS[id];
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
  if (ctx.echoActivity && def.favoredEchoActivity.includes(ctx.echoActivity)) {
    weight += 8;
  }

  const focusJoined = ctx.resourceFocus.join(' ').toLowerCase();
  def.resourceFocusKeywords.forEach((keyword) => {
    if (focusJoined.includes(keyword.toLowerCase())) {
      weight += 4;
    }
  });

  return Math.max(1, weight);
}

export function buildDepthIdentityRollContext(
  runContext: RunGenerationContext | null | undefined,
  veilBiome: VeilBiome | null | undefined,
  seed: string,
): DepthIdentityRollContext {
  return {
    veilBiome: veilBiome ?? runContext?.sectorState.veilBiome ?? null,
    anchorType: runContext?.activeAnchor?.type ?? runContext?.sectorState.activeAnchor?.type ?? null,
    operationKind: runContext?.activeOperation.objectiveKind ?? null,
    echoActivity: runContext?.sectorState.echoActivity ?? null,
    resourceFocus: runContext?.sectorState.resourceFocus ?? [],
    seed,
  };
}

export function rollVeilDistortion(
  ctx: DepthIdentityRollContext,
  forcedId?: VeilDistortionId | null,
): VeilDistortionId {
  if (forcedId && VEIL_DISTORTION_DEFINITIONS[forcedId]) {
    return forcedId;
  }

  const rng = seededRandom(`${ctx.seed}:veil-distortion`);
  const weighted = ALL_VEIL_DISTORTION_IDS.map((id) => ({
    id,
    weight: weightForDistortion(id, ctx),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return weighted[weighted.length - 1]!.id;
}

export function buildDistortionReveal(id: VeilDistortionId): DepthIdentityRevealPayload {
  const def = getVeilDistortionDefinition(id);
  return {
    kind: 'DISTORTION',
    id,
    title: `BREACH DISTORTION — ${def.displayName.toUpperCase()}`,
    summary: def.effectSummary,
    intensified: false,
  };
}

export function applyVeilDistortionToState(
  prev: DepthIdentityState | null | undefined,
  distortionId: VeilDistortionId,
): DepthIdentityState {
  const base = prev ?? createDefaultDepthIdentityState();
  return {
    ...base,
    activeVeilDistortion: distortionId,
    pendingReveal: buildDistortionReveal(distortionId),
  };
}

export function formatVeilDistortionLogLine(id: VeilDistortionId): string {
  const def = getVeilDistortionDefinition(id);
  return `>> BREACH DISTORTION — ${def.displayName.toUpperCase()} // ${def.effectSummary.toUpperCase()}`;
}

export function formatVeilDistortionDebugLine(id: VeilDistortionId): string {
  const def = getVeilDistortionDefinition(id);
  return [
    `DISTORTION: ${def.displayName}`,
    `fantasy: ${def.fantasy}`,
    `effect: ${def.effectSummary}`,
    `biomes: ${def.favoredBiomes.join(', ')}`,
    `anchors: ${def.favoredAnchors.join(', ')}`,
  ].join('\n');
}

let debugForcedDistortion: VeilDistortionId | null = null;

export function setDebugForcedVeilDistortion(id: VeilDistortionId | null): void {
  debugForcedDistortion = id;
}

export function getDebugForcedVeilDistortion(): VeilDistortionId | null {
  return debugForcedDistortion;
}

export function rollVeilDistortionForRun(
  runContext: RunGenerationContext | null | undefined,
  veilBiome: VeilBiome | null | undefined,
  seed: string,
): VeilDistortionId {
  const ctx = buildDepthIdentityRollContext(runContext, veilBiome, seed);
  return rollVeilDistortion(ctx, debugForcedDistortion);
}
