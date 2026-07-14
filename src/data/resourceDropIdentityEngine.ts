import type { ResourceItemId } from '../types/resourceItem';
import type { VeilBiome } from '../types/encounterSpawn';
import type { EncounterCompositionTemplateId, EncounterRewardTier } from '../types/encounterComposition';

/** Primary stable identity mats for each Veil biome. */
export function sectorIdentityResourcePool(veilBiome: VeilBiome | null | undefined): ResourceItemId[] {
  switch (veilBiome) {
    case 'NULL_ZONE':
      return ['nullcrete-shard', 'echo-glass-shard', 'ley-slag'];
    case 'ABYSSAL_SINK':
      return ['mycelial-ichor', 'sanguine-ampoule', 'echo-glass-shard'];
    case 'ASHEN_WASTE':
      return ['cinder-wire', 'combustion-cylinder', 'veil-ash-canister'];
    case 'SLAG_WORKS':
      return ['rail-capacitor', 'legion-blood-iron', 'combustion-cylinder', 'ley-slag'];
    case 'BLACKLINE_TERMINUS':
      return ['containment-seal', 'encrypted-grid-drive', 'breach-thread'];
    default:
      return ['ley-slag', 'echo-glass-shard'];
  }
}

/** Depth-gated expansion mats — rarity guidance for pools. */
export const EXPANSION_COMMON_STABLE: readonly ResourceItemId[] = [
  'nullcrete-shard',
  'cinder-wire',
];

export const EXPANSION_UNCOMMON_STABLE: readonly ResourceItemId[] = [
  'mycelial-ichor',
  'rail-capacitor',
  'resonant-filament',
  'containment-seal',
];

export const EXPANSION_RARE_GATED: readonly ResourceItemId[] = [
  'anchor-marrow',
  'breach-thread',
  'blacksite-specimen-jar',
];

export interface ExpansionIdentityDropContext {
  districtDepth: 1 | 2 | 3;
  veilBiome?: VeilBiome | null;
  isElite?: boolean;
  highValue?: boolean;
  highRisk?: boolean;
  echoSignal?: boolean;
  anchorSignal?: boolean;
  hasModifier?: boolean;
  hasTwisted?: boolean;
  templateId?: EncounterCompositionTemplateId | null;
  rewardTier?: EncounterRewardTier | null;
  rng: () => number;
}

/**
 * Sparse identity extras — keeps Depth 1 mostly sector/common, opens Breach/Anchor
 * in Depth 2+, and Specimen Jar only on valid Depth 3 high-risk blacksite contexts.
 */
export function rollExpansionIdentityExtras(ctx: ExpansionIdentityDropContext): ResourceItemId[] {
  const extras: ResourceItemId[] = [];
  const sector = sectorIdentityResourcePool(ctx.veilBiome);
  const primary = sector[0];

  // Sector identity — common chance; stronger on elite / resource-guard templates.
  if (primary) {
    let sectorChance = ctx.isElite ? 0.45 : 0.28;
    if (ctx.templateId === 'RESOURCE_GUARD' || ctx.highValue) sectorChance += 0.12;
    if (ctx.rng() < sectorChance) {
      extras.push(primary);
    }
  }

  // Echo lane — Resonant Filament (not just Echo-Glass).
  if (
    ctx.echoSignal
    || ctx.templateId === 'ECHO_CONTAMINATED'
    || ctx.templateId === 'BOSS_FORESHADOWING'
  ) {
    const filamentChance = ctx.districtDepth >= 2 ? 0.42 : 0.22;
    if (ctx.rng() < filamentChance) {
      extras.push('resonant-filament');
    }
  }

  // Anchor lane — Anchor Marrow (never Depth 1 standard soup).
  if (ctx.anchorSignal || ctx.templateId === 'ANCHOR_PATROL') {
    if (ctx.districtDepth >= 2 || ctx.isElite) {
      const marrowChance = ctx.templateId === 'ANCHOR_PATROL' || ctx.isElite ? 0.55 : 0.28;
      if (ctx.rng() < marrowChance) {
        extras.push('anchor-marrow');
      }
    }
  }

  // Depth 2+ / distortion — Breach Thread.
  if (ctx.districtDepth >= 2) {
    const distortion =
      ctx.hasTwisted
      || ctx.hasModifier
      || ctx.highRisk
      || ctx.templateId === 'HIGH_RISK_CARGO_GUARD'
      || ctx.rewardTier === 'RARE'
      || ctx.rewardTier === 'APEX_CHANCE';
    if (distortion) {
      const threadChance = ctx.districtDepth >= 3 ? 0.32 : 0.18;
      if (ctx.rng() < threadChance) {
        extras.push('breach-thread');
      }
    }
  }

  // Blackline intel — Containment Seal rare bump.
  if (ctx.veilBiome === 'BLACKLINE_TERMINUS' && ctx.rng() < (ctx.isElite ? 0.35 : 0.18)) {
    extras.push('containment-seal');
  }

  // Depth 3 blacksite contraband — Specimen Jar (never guaranteed Anomalous Core).
  if (
    ctx.districtDepth >= 3
    && (ctx.veilBiome === 'BLACKLINE_TERMINUS' || ctx.veilBiome === 'ABYSSAL_SINK')
    && (ctx.highRisk || ctx.isElite || ctx.rewardTier === 'RARE' || ctx.rewardTier === 'APEX_CHANCE')
  ) {
    if (ctx.rng() < 0.14) {
      extras.push('blacksite-specimen-jar');
    }
  }

  return extras;
}
