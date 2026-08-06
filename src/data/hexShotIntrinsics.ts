import type { HexShotAbilityId } from '../types/operativeClass';
import { getHexShotAbilityTags } from './hexShotAbilities';

/** Tactical abilities cycle +1 ammo before resolve (class identity). */
export const PHANTOM_FEED_AMMO = 1;

/** Every reload initiation costs this many AP (including at 0/6). */
export { HEX_RELOAD_AP_COST } from '../types/hexShotState';

/** H.3b — these tactical casts must not mutate magazine (no Phantom Feed). */
const PHANTOM_FEED_EXCLUDED: readonly HexShotAbilityId[] = [
  'CINDERLINE_SATURATION',
  'BLACKSITE_TRIAGE',
];

export function shouldApplyPhantomFeed(
  abilityId: HexShotAbilityId,
  effectiveTags?: readonly string[],
): boolean {
  if (PHANTOM_FEED_EXCLUDED.includes(abilityId)) return false;
  const tags = effectiveTags ?? getHexShotAbilityTags(abilityId);
  return tags.includes('TACTICAL') && !tags.includes('RELOAD');
}

/** Widow-Choke and similar grafts collapse AoE to a single focal target. */
export function graftForcesSingleTarget(effectiveTags: readonly string[] | undefined): boolean {
  if (!effectiveTags?.length) return false;
  return effectiveTags.includes('SINGLE_TARGET') && !effectiveTags.includes('AOE');
}
