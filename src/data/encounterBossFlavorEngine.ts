import type { DepthIdentityState, DeepVeilLawId, VeilDistortionId } from '../types/depthIdentity';
import type { VeilAnchorType, OperationObjectiveKind } from '../types/worldState';
import type { EncounterRewardTier } from '../types/encounterComposition';

export interface BossFlavorContext {
  depth: 1 | 2 | 3;
  distortionId?: VeilDistortionId | null;
  lawId?: DeepVeilLawId | null;
  intensified?: boolean;
  anchorType?: VeilAnchorType | null;
  operationKind?: OperationObjectiveKind | null;
}

/** Soft credit bump for gatekeeper kills — flavor identity, not a boss rewrite. */
export function bossFlavorCreditBonus(ctx: BossFlavorContext): number {
  let bonus = 0;
  if (ctx.lawId === 'THE_MACHINE_IS_PRAYING') bonus += 12;
  if (ctx.distortionId === 'MEMORY_CONTAMINATION') bonus += 8;
  if (ctx.anchorType === 'ASHEN_HEART') bonus += 10;
  if (ctx.anchorType === 'CHOIR_SPIRE') bonus += 8;
  if (ctx.operationKind === 'ANCHOR_ASSAULT' || ctx.operationKind === 'BOSS_SUPPRESSION') {
    bonus += 6;
  }
  if (ctx.intensified) bonus += 5;
  return bonus;
}

/** Soft rare-loot bump for gatekeeper aftermath salvage hooks. */
export function bossFlavorRareLootBonusPct(ctx: BossFlavorContext): number {
  let pct = 0;
  if (ctx.distortionId === 'MEMORY_CONTAMINATION') pct += 10;
  if (ctx.lawId === 'THE_MACHINE_IS_PRAYING') pct += 12;
  if (ctx.anchorType === 'RIFT_ENGINE') pct += 8;
  if (ctx.anchorType === 'CHOIR_SPIRE') pct += 6;
  return pct;
}

export function resolveBossFlavorRewardTier(ctx: BossFlavorContext): EncounterRewardTier {
  if (ctx.depth === 3 && (ctx.lawId || ctx.anchorType === 'ASHEN_HEART' || ctx.anchorType === 'RIFT_ENGINE')) {
    return 'RARE';
  }
  if (ctx.distortionId || ctx.anchorType || ctx.operationKind === 'BOSS_SUPPRESSION') {
    return 'HIGH_VALUE';
  }
  return 'IMPROVED';
}

export function formatBossDepthIdentityFlavorLines(ctx: BossFlavorContext): string[] {
  const lines: string[] = [];

  if (ctx.distortionId === 'MEMORY_CONTAMINATION') {
    lines.push('>> DEPTH IDENTITY — MEMORY CONTAMINATION: echoes of dead runners stain the gate.');
  } else if (ctx.distortionId === 'BLEEDING_ARCHITECTURE') {
    lines.push('>> DEPTH IDENTITY — BLEEDING ARCHITECTURE: the arena bleeds wrong angles around the Gatekeeper.');
  } else if (ctx.distortionId === 'PREDATORY_GEOMETRY') {
    lines.push('>> DEPTH IDENTITY — PREDATORY GEOMETRY: corridors hunt toward the threshold.');
  } else if (ctx.distortionId === 'UNSTABLE_MATTER') {
    lines.push('>> DEPTH IDENTITY — UNSTABLE MATTER: the floor forgets what solid means.');
  } else if (ctx.distortionId === 'RITUAL_PRESSURE') {
    lines.push('>> DEPTH IDENTITY — RITUAL PRESSURE: chant-static crowns the Gatekeeper.');
  } else if (ctx.distortionId) {
    lines.push(`>> DEPTH IDENTITY — ${String(ctx.distortionId).replace(/_/g, ' ')} warps Gatekeeper presence.`);
  }

  if (ctx.lawId === 'THE_MACHINE_IS_PRAYING') {
    lines.push(
      ctx.intensified
        ? '>> DEEP VEIL LAW (INTENSIFIED) — THE MACHINE IS PRAYING: industrial ritual locks the gate.'
        : '>> DEEP VEIL LAW — THE MACHINE IS PRAYING: machinery intones around the Gatekeeper.',
    );
  } else if (ctx.lawId === 'THE_VEIL_REMEMBERS') {
    lines.push('>> DEEP VEIL LAW — THE VEIL REMEMBERS: prior failures replay at the threshold.');
  } else if (ctx.lawId === 'THE_WALLS_ARE_HUNGRY') {
    lines.push('>> DEEP VEIL LAW — THE WALLS ARE HUNGRY: the arena consumes spare cover.');
  } else if (ctx.lawId === 'THE_ROADS_ARE_LOOPING') {
    lines.push('>> DEEP VEIL LAW — THE ROADS ARE LOOPING: retreat vectors fold into each other.');
  } else if (ctx.lawId === 'THE_SKY_IS_UNDERGROUND') {
    lines.push('>> DEEP VEIL LAW — THE SKY IS UNDERGROUND: horizon pressure presses the Gatekeeper.');
  } else if (ctx.lawId) {
    lines.push(`>> DEEP VEIL LAW — ${String(ctx.lawId).replace(/_/g, ' ')} presses on the Gatekeeper.`);
  }

  if (ctx.anchorType === 'CHOIR_SPIRE') {
    lines.push('>> ANCHOR PRESSURE — CHOIR SPIRE: resonance caster logic foreshadows the gate.');
  } else if (ctx.anchorType === 'RIFT_ENGINE') {
    lines.push('>> ANCHOR PRESSURE — RIFT ENGINE: industrial hazards frame the Gatekeeper.');
  } else if (ctx.anchorType === 'ASHEN_HEART') {
    lines.push('>> ANCHOR PRESSURE — ASHEN HEART: elite bruiser pressure saturates the arena.');
  } else if (ctx.anchorType === 'NULL_MONOLITH') {
    lines.push('>> ANCHOR PRESSURE — NULL MONOLITH: scanner/phase disruption ghosts the gate.');
  } else if (ctx.anchorType === 'LEY_NEXUS') {
    lines.push('>> ANCHOR PRESSURE — LEY NEXUS: occult current threads the Gatekeeper.');
  }

  if (ctx.operationKind === 'BOSS_SUPPRESSION') {
    lines.push('>> OPERATION — BOSS SUPPRESSION: gate clearance advances the active contract.');
  } else if (ctx.operationKind === 'ANCHOR_ASSAULT') {
    lines.push('>> OPERATION — ANCHOR ASSAULT: Gatekeeper fall weakens sector Anchor pressure.');
  }

  if (lines.length === 0) {
    lines.push('>> GATEKEEPER THRESHOLD — depth identity quiet; standard arena standing.');
  }

  return lines;
}

export function buildBossFlavorContextFromRun(args: {
  depth: 1 | 2 | 3;
  depthIdentity?: DepthIdentityState | null;
  anchorType?: VeilAnchorType | null;
  operationKind?: OperationObjectiveKind | null;
}): BossFlavorContext {
  return {
    depth: args.depth,
    distortionId: args.depthIdentity?.activeVeilDistortion ?? null,
    lawId: args.depthIdentity?.activeDeepVeilLaw ?? null,
    intensified: Boolean(args.depthIdentity?.intensifiedFromDistortion),
    anchorType: args.anchorType ?? null,
    operationKind: args.operationKind ?? null,
  };
}
