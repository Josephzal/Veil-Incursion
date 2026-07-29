/**
 * Seeded deterministic offer selection without replacement + composition rules.
 */
import type { BoonOfferContext, SoftWeightBreakdown } from './boonOfferTypes';
import { evaluateHardEligibility } from './boonHardEligibility';
import { computeSoftWeight } from './boonSoftWeighting';
import { getLiveBoonAuditEntry, listLiveBoonsForClass, type LiveBoonAuditEntry } from './boonSynergyInventory';

export type WeightedBoonCandidate = {
  boonId: string;
  entry: LiveBoonAuditEntry;
  soft: SoftWeightBreakdown;
  isDirect: boolean;
  isConflict: boolean;
  engineFamily: string | null;
};

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG */
export function createSeededRng(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(
  pool: WeightedBoonCandidate[],
  rng: () => number,
): WeightedBoonCandidate | null {
  if (!pool.length) return null;
  const total = pool.reduce((s, c) => s + Math.max(0.001, c.soft.finalWeight), 0);
  let roll = rng() * total;
  for (const c of pool) {
    roll -= Math.max(0.001, c.soft.finalWeight);
    if (roll <= 0) return c;
  }
  return pool[pool.length - 1] ?? null;
}

export function buildEligibleWeightedPool(ctx: BoonOfferContext): WeightedBoonCandidate[] {
  return listLiveBoonsForClass(ctx.classId)
    .map((entry) => {
      const hard = evaluateHardEligibility(entry.id, ctx, entry);
      if (!hard.eligible) return null;
      const soft = computeSoftWeight(entry.id, ctx, entry);
      return {
        boonId: entry.id,
        entry,
        soft,
        isDirect: soft.directLoadoutContribution > 0,
        isConflict: soft.conflictPenalty < 0,
        engineFamily: entry.engineFamily,
      } satisfies WeightedBoonCandidate;
    })
    .filter((c): c is WeightedBoonCandidate => c !== null);
}

/**
 * Composition for a normal 3-choice offer:
 * - ≥1 direct weapon/class/loadout interaction when available
 * - ≥1 compatible non-conflict
 * - never three explicit conflicts when a non-conflict exists
 * - avoid three near-identical engine-family effects
 * - no duplicate non-stackable
 * - first offer: guarantee weapon/class-loop synergy when one exists
 */
export function selectSeededBoonOffers(ctx: BoonOfferContext): string[] {
  const count = ctx.offerCount ?? 3;
  const rng = createSeededRng(ctx.seed);
  const pool = buildEligibleWeightedPool(ctx);
  const selected: WeightedBoonCandidate[] = [];
  const remaining = [...pool];

  const take = (pred: (c: WeightedBoonCandidate) => boolean): boolean => {
    const subset = remaining.filter(pred);
    const pick = pickWeighted(subset, rng);
    if (!pick) return false;
    selected.push(pick);
    const idx = remaining.findIndex((c) => c.boonId === pick.boonId);
    if (idx >= 0) remaining.splice(idx, 1);
    return true;
  };

  if (ctx.isFirstOffer) {
    take((c) => c.isDirect && !c.isConflict);
  } else {
    take((c) => c.isDirect);
  }

  take((c) => !c.isConflict);

  while (selected.length < count && remaining.length) {
    const familyCounts = new Map<string, number>();
    selected.forEach((s) => {
      if (s.engineFamily) {
        familyCounts.set(s.engineFamily, (familyCounts.get(s.engineFamily) ?? 0) + 1);
      }
    });
    const avoidTripleFamily = (c: WeightedBoonCandidate) => {
      if (!c.engineFamily) return true;
      return (familyCounts.get(c.engineFamily) ?? 0) < 2;
    };
    const conflictCount = selected.filter((s) => s.isConflict).length;
    const preferNonConflict = conflictCount >= 1;
    const ok = take((c) => {
      if (!avoidTripleFamily(c)) return false;
      if (preferNonConflict && c.isConflict && remaining.some((r) => !r.isConflict)) return false;
      return true;
    });
    if (!ok) take(() => true);
  }

  // Final safety: if all three are conflicts and a non-conflict remained, swap last.
  if (
    selected.length === count
    && selected.every((s) => s.isConflict)
    && remaining.some((r) => !r.isConflict)
  ) {
    const replacement = pickWeighted(
      remaining.filter((r) => !r.isConflict),
      rng,
    );
    if (replacement) {
      selected[selected.length - 1] = replacement;
    }
  }

  return selected.slice(0, count).map((s) => s.boonId);
}

export function inspectBoonOfferWeight(boonId: string, ctx: BoonOfferContext) {
  const entry = getLiveBoonAuditEntry(boonId);
  const hard = evaluateHardEligibility(boonId, ctx, entry);
  const soft = hard.eligible ? computeSoftWeight(boonId, ctx, entry) : null;
  return {
    boonId,
    hard,
    soft,
    finalTransformedTags: ctx.tagLayers.finalTransformedTags,
    reachableHooks: ctx.reachableHooks,
    weaponFamilyExclusive: entry?.weaponFamilyExclusive ?? null,
  };
}

export function formatBoonOfferWeightDebug(boonId: string, ctx: BoonOfferContext): string {
  const i = inspectBoonOfferWeight(boonId, ctx);
  const soft = i.soft;
  return [
    `boon=${boonId}`,
    `eligible=${i.hard.eligible}`,
    `rejections=[${i.hard.rejections.join(',')}]`,
    soft
      ? [
          `base=${soft.baseWeight}`,
          `category=${soft.categoryWeight}`,
          `direct=${soft.directLoadoutContribution}`,
          `engine=${soft.acquiredEngineContribution}`,
          `affinity=${soft.weaponAffinityContribution}`,
          `conflict=${soft.conflictPenalty}`,
          `multRaw=${soft.synergyMultiplierRaw.toFixed(2)}`,
          `mult=${soft.synergyMultiplierClamped.toFixed(2)}`,
          `final=${soft.finalWeight.toFixed(3)}`,
        ].join(' // ')
      : 'soft=n/a',
    `finalTags=[${i.finalTransformedTags.join(',')}]`,
    `hooks=[${i.reachableHooks.join(',')}]`,
    `exclusive=${i.weaponFamilyExclusive ?? '—'}`,
  ].join('\n');
}
