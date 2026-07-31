/**
 * Authored Longsword Warden's Strike VFX — static PNG requires for Metro/Expo.
 */

import type { ImageSourcePropType } from 'react-native';

export const WARDEN_STRIKE_SWING_SMEAR: ImageSourcePropType = require(
  '../../assets/vfx/aegis/longsword/warden-strike-swing-smear.png',
);
export const WARDEN_STRIKE_CONTACT_BURST: ImageSourcePropType = require(
  '../../assets/vfx/aegis/longsword/warden-strike-contact-burst.png',
);
export const WARDEN_STRIKE_INCISION: ImageSourcePropType = require(
  '../../assets/vfx/aegis/longsword/warden-strike-incision.png',
);
export const WARDEN_STRIKE_FRACTURE_CRACK: ImageSourcePropType = require(
  '../../assets/vfx/aegis/longsword/warden-strike-fracture-crack.png',
);

export const WARDEN_STRIKE_ART_ASSETS = {
  swingSmear: WARDEN_STRIKE_SWING_SMEAR,
  contactBurst: WARDEN_STRIKE_CONTACT_BURST,
  incision: WARDEN_STRIKE_INCISION,
  fractureCrack: WARDEN_STRIKE_FRACTURE_CRACK,
} as const;

export const WARDEN_STRIKE_ART_PATHS = [
  'assets/vfx/aegis/longsword/warden-strike-swing-smear.png',
  'assets/vfx/aegis/longsword/warden-strike-contact-burst.png',
  'assets/vfx/aegis/longsword/warden-strike-incision.png',
  'assets/vfx/aegis/longsword/warden-strike-fracture-crack.png',
] as const;
