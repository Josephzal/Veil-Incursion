import type { WeaponFamilyId } from '../types/weapon';
import type { WeaponLoadoutRecommendationProfile } from '../types/weaponLoadoutRecommendation';
import {
  AEGIS_CLAYMORE,
  AEGIS_LONGSWORD,
  AEGIS_RIFT,
} from './weaponLoadoutRecommendationProfiles.aegis';
import {
  HEX_NULLBREACH,
  HEX_PULSE,
  HEX_SIDEARM,
} from './weaponLoadoutRecommendationProfiles.hex';
import {
  ENVOY_CONDUIT,
  ENVOY_LANTERN,
  ENVOY_PRISM,
} from './weaponLoadoutRecommendationProfiles.envoy';

export const WEAPON_LOADOUT_RECOMMENDATION_PROFILES: Record<
  WeaponFamilyId,
  WeaponLoadoutRecommendationProfile
> = {
  'aegis-longsword': AEGIS_LONGSWORD,
  'aegis-paired-blades': AEGIS_RIFT,
  'aegis-claymore': AEGIS_CLAYMORE,
  'hex-revolver': HEX_SIDEARM,
  'hex-shotgun': HEX_NULLBREACH,
  'hex-carbine': HEX_PULSE,
  'envoy-scythe': ENVOY_CONDUIT,
  'envoy-vambrace': ENVOY_LANTERN,
  'envoy-sanguine-prism': ENVOY_PRISM,
};

export function getWeaponLoadoutRecommendationProfile(
  id: WeaponFamilyId,
): WeaponLoadoutRecommendationProfile {
  return WEAPON_LOADOUT_RECOMMENDATION_PROFILES[id];
}

export function listWeaponLoadoutRecommendationProfiles(): WeaponLoadoutRecommendationProfile[] {
  return (Object.keys(WEAPON_LOADOUT_RECOMMENDATION_PROFILES) as WeaponFamilyId[]).map(
    (id) => WEAPON_LOADOUT_RECOMMENDATION_PROFILES[id],
  );
}
