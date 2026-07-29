import {
  BOON_BASE_OFFER_WEIGHT,
  BOON_SYNERGY_DIRECT_INTERACTION,
  BOON_SYNERGY_ENGINE_FAMILY,
  BOON_SYNERGY_EXPLICIT_CONFLICT,
  BOON_SYNERGY_WEAPON_AFFINITY,
  BOON_TIER_CATEGORY_WEIGHT,
  clampSynergyMultiplier,
} from './boonOfferWeightConstants';
import type { BoonOfferContext, SoftWeightBreakdown } from './boonOfferTypes';
import { getLiveBoonAuditEntry, type LiveBoonAuditEntry } from './boonSynergyInventory';

function hasDirectInteraction(entry: LiveBoonAuditEntry, ctx: BoonOfferContext): boolean {
  const final = new Set(ctx.tagLayers.finalTransformedTags);
  const tagHit =
    entry.hardRequiredTags.length > 0
    && entry.hardRequiredTags.every((t) => final.has(t));
  const preferredHit = entry.preferredTags.some((t) => final.has(t));
  const hookHit = entry.requiredHooks.some((h) => ctx.reachableHooks.includes(h));
  const abilityHit = entry.requiredAbilityIds.some((id) => ctx.equippedAbilityIds.includes(id));
  return Boolean(abilityHit || tagHit || (preferredHit && hookHit));
}

function hasAffinityMatch(entry: LiveBoonAuditEntry, ctx: BoonOfferContext): boolean {
  if (!entry.preferredAffinityTags.length) return false;
  const weapon = new Set(ctx.weaponAffinityTags);
  return entry.preferredAffinityTags.some((t) => weapon.has(t));
}

function hasEngineContinuation(entry: LiveBoonAuditEntry, ctx: BoonOfferContext): boolean {
  if (!entry.engineFamily) return false;
  return ctx.acquiredEngineFamilies.includes(entry.engineFamily);
}

function hasExplicitConflict(entry: LiveBoonAuditEntry, ctx: BoonOfferContext): boolean {
  return entry.mechanicalConflicts.some(
    (c) => !c.weaponFamilyId || c.weaponFamilyId === ctx.weaponFamilyId,
  );
}

/**
 * Soft weighting after hard eligibility.
 * finalWeight = base × category × clamp(1 + contributions, 0.65, 2.00)
 * Each evidence category contributes at most once.
 */
export function computeSoftWeight(
  boonId: string,
  ctx: BoonOfferContext,
  entry?: LiveBoonAuditEntry,
): SoftWeightBreakdown {
  const audit = entry ?? getLiveBoonAuditEntry(boonId);
  const baseWeight = audit?.baseOfferWeight ?? BOON_BASE_OFFER_WEIGHT;
  const categoryWeight = BOON_TIER_CATEGORY_WEIGHT[audit?.tier ?? 'TIER_1'] ?? 1;
  let direct = 0;
  let engine = 0;
  let affinity = 0;
  let conflict = 0;
  if (audit) {
    if (hasDirectInteraction(audit, ctx)) direct = BOON_SYNERGY_DIRECT_INTERACTION;
    if (hasEngineContinuation(audit, ctx)) engine = BOON_SYNERGY_ENGINE_FAMILY;
    if (hasAffinityMatch(audit, ctx)) affinity = BOON_SYNERGY_WEAPON_AFFINITY;
    if (hasExplicitConflict(audit, ctx)) conflict = BOON_SYNERGY_EXPLICIT_CONFLICT;
  }
  const raw = 1 + direct + engine + affinity + conflict;
  const clamped = clampSynergyMultiplier(raw);
  return {
    baseWeight,
    categoryWeight,
    directLoadoutContribution: direct,
    acquiredEngineContribution: engine,
    weaponAffinityContribution: affinity,
    conflictPenalty: conflict,
    synergyMultiplierRaw: raw,
    synergyMultiplierClamped: clamped,
    finalWeight: baseWeight * categoryWeight * clamped,
  };
}
