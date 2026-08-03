/**
 * ABYSSAL VERDICT (Longsword ultimate) authored VFX / pose assets.
 * Metro/Expo static requires — do not resize or recolor sources.
 *
 * Image requires are lazy so Node presentation tests can import availability
 * helpers without parsing binary PNG/JPEG payloads.
 */

import type { ImageSourcePropType } from 'react-native';

export const ABYSSAL_VERDICT_ART_PATHS = [
  'assets/vfx/aegis/longsword/abyssal-verdict/aegis_longsword_ult_charge.png',
  'assets/vfx/aegis/longsword/abyssal-verdict/aegis_longsword_ult_release.png',
  'assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_veil_pull.png',
  'assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_blade_charge.png',
  'assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_edge_flare.png',
  'assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_slash_afterimage.png',
  'assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_cut_line.png',
  'assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_impact_burst.png',
] as const;

function loadPoseCharge(): ImageSourcePropType {
  return require('../../assets/vfx/aegis/longsword/abyssal-verdict/aegis_longsword_ult_charge.png');
}
function loadPoseRelease(): ImageSourcePropType {
  return require('../../assets/vfx/aegis/longsword/abyssal-verdict/aegis_longsword_ult_release.png');
}
function loadVeilPull(): ImageSourcePropType {
  return require('../../assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_veil_pull.png');
}
function loadBladeCharge(): ImageSourcePropType {
  return require('../../assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_blade_charge.png');
}
function loadEdgeFlare(): ImageSourcePropType {
  return require('../../assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_edge_flare.png');
}
function loadSlashAfterimage(): ImageSourcePropType {
  return require('../../assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_slash_afterimage.png');
}
function loadCutLine(): ImageSourcePropType {
  return require('../../assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_cut_line.png');
}
function loadImpactBurst(): ImageSourcePropType {
  return require('../../assets/vfx/aegis/longsword/abyssal-verdict/abyssal_verdict_impact_burst.png');
}

export const ABYSSAL_VERDICT_ART = {
  get poseCharge(): ImageSourcePropType {
    return loadPoseCharge();
  },
  get poseRelease(): ImageSourcePropType {
    return loadPoseRelease();
  },
  get veilPull(): ImageSourcePropType {
    return loadVeilPull();
  },
  get bladeCharge(): ImageSourcePropType {
    return loadBladeCharge();
  },
  get edgeFlare(): ImageSourcePropType {
    return loadEdgeFlare();
  },
  get slashAfterimage(): ImageSourcePropType {
    return loadSlashAfterimage();
  },
  get cutLine(): ImageSourcePropType {
    return loadCutLine();
  },
  get impactBurst(): ImageSourcePropType {
    return loadImpactBurst();
  },
} as const;

/** Test-only override — null uses the soft probe. */
let assetsAvailableOverride: boolean | null = null;

export function __setAbyssalVerdictAssetsAvailableForTests(value: boolean | null): void {
  assetsAvailableOverride = value;
}

/** Soft probe — never throws; missing art falls back to standard ultimate presentation. */
export function areAbyssalVerdictAssetsAvailable(): boolean {
  if (assetsAvailableOverride != null) return assetsAvailableOverride;
  try {
    return loadPoseCharge() != null && loadPoseRelease() != null && loadImpactBurst() != null;
  } catch {
    return false;
  }
}
