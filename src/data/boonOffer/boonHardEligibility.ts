import type { BoonOfferContext, HardEligibilityResult, HardEligibilityRejection } from './boonOfferTypes';
import { getLiveBoonAuditEntry, type LiveBoonAuditEntry } from './boonSynergyInventory';

function tagsSatisfy(
  finalTags: readonly string[],
  required: readonly string[],
): boolean {
  if (!required.length) return true;
  // Prefer tagAny semantics when multiple tags listed without explicit all-mode:
  // live catalogs use tagAll (every) OR tagAny (some). Inventory stores hardRequiredTags
  // as the union; match if every required tag is present (tagAll fidelity).
  return required.every((t) => finalTags.includes(t));
}

/**
 * Hard eligibility — must run before soft weighting.
 * Affinity tags never grant eligibility. Recommendation roles never satisfy ability requirements.
 */
export function evaluateHardEligibility(
  boonId: string,
  ctx: BoonOfferContext,
  entry?: LiveBoonAuditEntry,
): HardEligibilityResult {
  const audit = entry ?? getLiveBoonAuditEntry(boonId);
  const rejections: HardEligibilityRejection[] = [];

  if (!audit) {
    return { eligible: false, rejections: ['NOT_LIVE'] };
  }
  if (!audit.live) {
    rejections.push('RETIRED_OR_DEAD');
  }
  if (audit.deprecatedDependency) {
    rejections.push('LEGACY_DEPENDENCY');
  }
  if (!audit.runtimeImplemented) {
    rejections.push('RUNTIME_UNIMPLEMENTED');
  }
  if (audit.classId !== ctx.classId) {
    rejections.push('WRONG_CLASS_POOL');
  }
  if (ctx.ownedBoonIds.includes(boonId)) {
    rejections.push('ALREADY_OWNED');
  }
  if (audit.weaponFamilyExclusive && audit.weaponFamilyExclusive !== ctx.weaponFamilyId) {
    rejections.push('WEAPON_FAMILY_EXCLUSIVE_MISMATCH');
  }
  if (audit.requiredAbilityIds.length) {
    const missing = audit.requiredAbilityIds.some(
      (id) => !ctx.equippedAbilityIds.includes(id),
    );
    if (missing) rejections.push('REQUIRED_ABILITY_MISSING');
  }
  if (audit.hardRequiredTags.length) {
    if (!tagsSatisfy(ctx.tagLayers.finalTransformedTags, audit.hardRequiredTags)) {
      rejections.push('REQUIRED_TAG_MISSING');
    }
  }
  if (audit.requiredHooks.length) {
    // Passive/general: requiredHooks are preferred signals, not hard gates unless
    // the boon is classified as DIRECT_IDENTITY with a single exclusive hook.
    // Hard gate only when every required hook is unreachable AND tags also missing.
    const reachable = new Set(ctx.reachableHooks);
    const anyReachable = audit.requiredHooks.some((h) => reachable.has(h));
    if (
      audit.classification === 'DIRECT_IDENTITY'
      && audit.requiredHooks.length > 0
      && !anyReachable
      && audit.hardRequiredTags.length === 0
    ) {
      rejections.push('REQUIRED_HOOK_UNREACHABLE');
    }
  }
  if (audit.requiredPriorBoons.length) {
    const missingPrior = audit.requiredPriorBoons.some((id) => !ctx.ownedBoonIds.includes(id));
    if (missingPrior) rejections.push('REQUIRED_PRIOR_BOON_MISSING');
  }
  if (!audit.stackable && ctx.ownedBoonIds.includes(boonId)) {
    rejections.push('EXCLUSIVE_DUPLICATE_BLOCKED');
  }

  return { eligible: rejections.length === 0, rejections };
}

/**
 * Soft policy: tag-gated boons need the tag in the final transformed set.
 * Passive / encounter-start boons with empty hardRequiredTags remain eligible.
 */
export function isHardEligible(boonId: string, ctx: BoonOfferContext): boolean {
  return evaluateHardEligibility(boonId, ctx).eligible;
}
