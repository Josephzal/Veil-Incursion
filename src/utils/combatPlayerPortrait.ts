import type { ImageSourcePropType, ImageStyle } from 'react-native';
import { Platform } from 'react-native';
import type { ClassType } from '../types/game';
import type { WeaponFamilyId } from '../types/weapon';
import { STARTER_WEAPON_BY_CLASS, getWeaponFamily, isWeaponFamilyId } from '../data/weaponRegistry';
import {
  POSE_CALIBRATION,
  getPoseCalibrationForFamily,
  listPoseCalibrations,
  type PoseCalibration,
} from './combatPortraitCalibration';
import {
  computeAnatomyRegisteredLayouts,
  usesAnatomyPoseRegistration,
  type RegisteredPoseLayout,
} from './combatPoseRegistration';

import AegisCombatAttack from '../../assets/images/character images/aegis/aegis_attacking.png';
import AegisCombatIdle from '../../assets/images/character images/aegis/aegis_combat.png';
import AegisPairedIdle from '../../assets/images/character images/aegis/aegis_paired_idle.png';
import AegisPairedAttack from '../../assets/images/character images/aegis/aegis_paired_attack.png';
import AegisGreatswordIdle from '../../assets/images/character images/aegis/aegis_greatsword_idle.png';
import AegisGreatswordAttack from '../../assets/images/character images/aegis/aegis_greatsword_attack.png';
import AegisIcon from '../../assets/images/character images/aegis/aegis_icon.png';
import HexShotAttack from '../../assets/images/character images/hex-shot/hex_shot_attack.png';
import HexShotIdle from '../../assets/images/character images/hex-shot/hex_shot_idle.png';
import HexCarbineIdle from '../../assets/images/character images/hex-shot/hex_carbine_idle.png';
import HexCarbineAttack from '../../assets/images/character images/hex-shot/hex_carbine_attack.png';
import HexShotgunIdle from '../../assets/images/character images/hex-shot/hex_shotgun_idle.png';
import HexShotgunAttack from '../../assets/images/character images/hex-shot/hex_shotgun_attack.png';
import HexShotIcon from '../../assets/images/character images/hex-shot/hex_shot_icon.png';
import EnvoyVambraceIdle from '../../assets/images/character images/envoy/envoy_vambrace_idle.png';
import EnvoyVambraceAttack from '../../assets/images/character images/envoy/envoy_vambrace_attack.png';
import EnvoyScytheIdle from '../../assets/images/character images/envoy/envoy_scythe_idle.png';
import EnvoyScytheAttack from '../../assets/images/character images/envoy/envoy_scythe_attack.png';
import EnvoyHeartIdle from '../../assets/images/character images/envoy/envoy_heart_idle.png';
import EnvoyHeartAttack from '../../assets/images/character images/envoy/envoy_heart_attack.png';
import EnvoyIcon from '../../assets/images/character images/envoy/envoy_icon.png';

export type { PoseCalibration };
export { listPoseCalibrations };

type PortraitPair = { idle: ImageSourcePropType; attack: ImageSourcePropType };

const CLASS_FALLBACK_PORTRAITS: Record<ClassType, PortraitPair> = {
  AEGIS: { idle: AegisCombatIdle, attack: AegisCombatAttack },
  HEX_SHOT: { idle: HexShotIdle, attack: HexShotAttack },
  // Envoy starter is Vambrace — never fall back to legacy class-only art.
  ENVOY: { idle: EnvoyVambraceIdle, attack: EnvoyVambraceAttack },
};

/**
 * Per-weapon combat portraits (idle / attack).
 * Longsword + Revolver keep the original class art; all other families use
 * dedicated weapon PNGs under assets/images/character images/.
 */
const WEAPON_PORTRAITS: Record<WeaponFamilyId, PortraitPair> = {
  // Aegis
  'aegis-runed-longsword': { idle: AegisCombatIdle, attack: AegisCombatAttack },
  'aegis-rift-edge': { idle: AegisPairedIdle, attack: AegisPairedAttack },
  'aegis-claymore-blade': { idle: AegisGreatswordIdle, attack: AegisGreatswordAttack },
  // Hex Shot
  'hex-silver-core-sidearm': { idle: HexShotIdle, attack: HexShotAttack },
  'hex-pulse-rifle': { idle: HexCarbineIdle, attack: HexCarbineAttack },
  'hex-void-cannon': { idle: HexShotgunIdle, attack: HexShotgunAttack },
  // Envoy
  'envoy-echo-lantern': { idle: EnvoyVambraceIdle, attack: EnvoyVambraceAttack },
  'envoy-null-conduit': { idle: EnvoyScytheIdle, attack: EnvoyScytheAttack },
  'envoy-sanguine-prism': { idle: EnvoyHeartIdle, attack: EnvoyHeartAttack },
};

const CLASS_BADGE_ICONS: Record<ClassType, ImageSourcePropType> = {
  AEGIS: AegisIcon,
  HEX_SHOT: HexShotIcon,
  ENVOY: EnvoyIcon,
};

/** PNG layout metadata — feet row and canvas size drive alignment without drift. */
export type PortraitMeta = {
  canvasW: number;
  canvasH: number;
  /** Opaque-pixel content height (alpha-bounded). Used to lock on-screen character size. */
  contentH: number;
  feetFromBottom: number;
};

type PortraitMetaPair = { idle: PortraitMeta; attack: PortraitMeta };

/**
 * Reference idle — envoy_vambrace_idle.png (permanent ID: envoy-echo-lantern).
 * Every idle and attack portrait scales so opaque content height matches this figure.
 *
 * scale = (REF.contentH * containFit(box, REF)) / pose.contentH
 * → pose.contentH * scale === REF on-screen content height
 */
const ENVOY_VAMBRACE_IDLE_META: PortraitMeta = {
  canvasW: 772,
  canvasH: 1734,
  contentH: 1714,
  feetFromBottom: 0,
};

const HEX_SHOT_IDLE_META: PortraitMeta = {
  canvasW: 592,
  canvasH: 1254,
  contentH: 1205,
  feetFromBottom: 23,
};

const HEX_SHOT_ATTACK_META: PortraitMeta = {
  canvasW: 698,
  canvasH: 1262,
  contentH: 1213,
  feetFromBottom: 27,
};

/** Class-keyed meta retained for badge / legacy callers. */
export const PORTRAIT_META: Record<ClassType, PortraitMetaPair> = {
  HEX_SHOT: {
    idle: HEX_SHOT_IDLE_META,
    attack: HEX_SHOT_ATTACK_META,
  },
  AEGIS: {
    idle: { canvasW: 400, canvasH: 1172, contentH: 1140, feetFromBottom: 19 },
    attack: { canvasW: 800, canvasH: 998, contentH: 969, feetFromBottom: 17 },
  },
  // Envoy starter is Vambrace — match that art, not legacy envoy_idle.
  ENVOY: {
    idle: { canvasW: 772, canvasH: 1734, contentH: 1714, feetFromBottom: 0 },
    attack: { canvasW: 1284, canvasH: 1578, contentH: 1469, feetFromBottom: 9 },
  },
};

/** Measured from PNG alpha bounds — keep in sync when art is replaced. */
const WEAPON_PORTRAIT_META: Record<WeaponFamilyId, PortraitMetaPair> = {
  'aegis-runed-longsword': PORTRAIT_META.AEGIS,
  'aegis-rift-edge': {
    idle: { canvasW: 1384, canvasH: 1636, contentH: 1588, feetFromBottom: 22 },
    attack: { canvasW: 1666, canvasH: 1384, contentH: 1340, feetFromBottom: 27 },
  },
  'aegis-claymore-blade': {
    idle: { canvasW: 1200, canvasH: 1608, contentH: 1533, feetFromBottom: 23 },
    attack: { canvasW: 1130, canvasH: 1626, contentH: 1552, feetFromBottom: 35 },
  },
  'hex-silver-core-sidearm': PORTRAIT_META.HEX_SHOT,
  'hex-pulse-rifle': {
    idle: { canvasW: 988, canvasH: 1772, contentH: 1705, feetFromBottom: 47 },
    attack: { canvasW: 1174, canvasH: 1724, contentH: 1675, feetFromBottom: 15 },
  },
  'hex-void-cannon': {
    idle: { canvasW: 682, canvasH: 1632, contentH: 1593, feetFromBottom: 24 },
    attack: { canvasW: 1394, canvasH: 1542, contentH: 1476, feetFromBottom: 30 },
  },
  'envoy-echo-lantern': PORTRAIT_META.ENVOY,
  'envoy-null-conduit': {
    idle: { canvasW: 968, canvasH: 1698, contentH: 1596, feetFromBottom: 18 },
    attack: { canvasW: 1962, canvasH: 1396, contentH: 1349, feetFromBottom: 22 },
  },
  'envoy-sanguine-prism': {
    idle: { canvasW: 856, canvasH: 1554, contentH: 1522, feetFromBottom: 18 },
    attack: { canvasW: 2058, canvasH: 1256, contentH: 1182, feetFromBottom: 30 },
  },
};

export type FootprintBox = { width: number; height: number };

function resolvePortraitFamily(
  classId: ClassType,
  weaponFamilyId?: WeaponFamilyId | null,
): WeaponFamilyId {
  if (weaponFamilyId && isWeaponFamilyId(weaponFamilyId)
    && getWeaponFamily(weaponFamilyId).classId === classId) {
    return weaponFamilyId;
  }
  return STARTER_WEAPON_BY_CLASS[classId];
}

function resolveMetaPair(
  classId: ClassType,
  weaponFamilyId?: WeaponFamilyId | null,
): PortraitMetaPair {
  const family = resolvePortraitFamily(classId, weaponFamilyId);
  return WEAPON_PORTRAIT_META[family] ?? PORTRAIT_META[classId];
}

/**
 * Extra shrink — legacy aura helper only (does not affect idle/attack layouts).
 */
const ATTACK_RELATIVE_TO_IDLE = 0.94;

export function getPoseCalibration(
  classId: ClassType,
  weaponFamilyId: WeaponFamilyId | null | undefined,
  pose: 'idle' | 'attack',
): PoseCalibration {
  const family = resolvePortraitFamily(classId, weaponFamilyId);
  return getPoseCalibrationForFamily(family, pose);
}

/** Contain-fit the Vambrace idle canvas into the art box. */
function referenceContainScale(box: FootprintBox): number {
  return Math.min(
    box.width / ENVOY_VAMBRACE_IDLE_META.canvasW,
    box.height / ENVOY_VAMBRACE_IDLE_META.canvasH,
  );
}

/** Target on-screen opaque height — envoy-echo-lantern idle. */
function referenceContentDisplayH(box: FootprintBox): number {
  return ENVOY_VAMBRACE_IDLE_META.contentH * referenceContainScale(box);
}

/**
 * Scale so pose opaque height matches envoy-echo-lantern idle, then apply
 * per-pose visualScale from combatPortraitCalibration (manual art tune).
 */
function contentLockedScale(meta: PortraitMeta, box: FootprintBox): number {
  return referenceContentDisplayH(box) / Math.max(1, meta.contentH);
}

function contentLockedDisplay(
  meta: PortraitMeta,
  box: FootprintBox,
  visualScale = 1,
): { width: number; height: number; scale: number } {
  const scale = contentLockedScale(meta, box) * visualScale;
  return {
    scale,
    width: meta.canvasW * scale,
    height: meta.canvasH * scale,
  };
}

const WEB_CONTAIN_BOTTOM: ImageStyle = Platform.OS === 'web'
  ? {
    objectFit: 'contain',
    objectPosition: 'bottom center',
  } as ImageStyle
  : {};

function registeredPoseLayoutToImageStyle(
  layout: RegisteredPoseLayout,
  boxHeight: number,
): ImageStyle {
  // Anchor by bottom so soles stay on the art-box floor even when scale/overflow shifts top.
  const bottom = boxHeight - (layout.top + layout.height);
  return {
    position: 'absolute',
    left: layout.left,
    bottom,
    width: layout.width,
    height: layout.height,
    backgroundColor: 'transparent',
    ...WEB_CONTAIN_BOTTOM,
  };
}

/** Pixel-locked idle layout — canvas bottom sits on the art-box floor. */
export function computeFootprintIdleLayout(
  box: FootprintBox,
  classId: ClassType,
  weaponFamilyId?: WeaponFamilyId | null,
): ImageStyle {
  if (box.width <= 0 || box.height <= 0) {
    return {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: '100%',
      height: '100%',
    };
  }

  const family = resolvePortraitFamily(classId, weaponFamilyId);
  if (usesAnatomyPoseRegistration(family)) {
    const layouts = computeAnatomyRegisteredLayouts(box);
    if (layouts) return registeredPoseLayoutToImageStyle(layouts.idle, box.height);
  }

  const cal = POSE_CALIBRATION[family].idle;
  const { idle } = resolveMetaPair(classId, weaponFamilyId);
  const display = contentLockedDisplay(idle, box, cal.visualScale);

  return {
    position: 'absolute',
    bottom: 0,
    left: (box.width - display.width) / 2 + cal.translateX,
    width: display.width,
    height: display.height,
    backgroundColor: 'transparent',
    ...WEB_CONTAIN_BOTTOM,
    ...(cal.translateY !== 0 ? { transform: [{ translateY: cal.translateY }] } : {}),
  };
}

/**
 * Attack layout — Vambrace content-height lock × this pose's visualScale.
 * Placement via attack bodyAnchorX / translate.
 * Longsword uses anatomy registration (body height + planted foot) instead.
 */
export function computeFootprintAttackLayout(
  box: FootprintBox,
  classId: ClassType,
  weaponFamilyId?: WeaponFamilyId | null,
): ImageStyle {
  if (box.width <= 0 || box.height <= 0) {
    return {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: '100%',
      height: '100%',
    };
  }

  const family = resolvePortraitFamily(classId, weaponFamilyId);
  if (usesAnatomyPoseRegistration(family)) {
    const layouts = computeAnatomyRegisteredLayouts(box);
    if (layouts) return registeredPoseLayoutToImageStyle(layouts.attack, box.height);
  }

  const attackCal = POSE_CALIBRATION[family].attack;
  const { idle, attack } = resolveMetaPair(classId, weaponFamilyId);
  const display = contentLockedDisplay(attack, box, attackCal.visualScale);
  const footDeltaPx = (attack.feetFromBottom - idle.feetFromBottom)
    * (display.width / attack.canvasW);
  const footDeltaCapped = Math.max(-12, Math.min(12, footDeltaPx)) + attackCal.translateY;
  const idleCenterX = box.width / 2;
  const left = idleCenterX - display.width * attackCal.bodyAnchorX + attackCal.translateX;

  return {
    position: 'absolute',
    bottom: 0,
    left,
    width: display.width,
    height: display.height,
    backgroundColor: 'transparent',
    ...WEB_CONTAIN_BOTTOM,
    ...(footDeltaCapped !== 0 ? { transform: [{ translateY: footDeltaCapped }] } : {}),
  };
}

export function resolvePlayerCombatIdlePortrait(
  classId: ClassType = 'AEGIS',
  weaponFamilyId?: WeaponFamilyId | null,
): ImageSourcePropType {
  const family = resolvePortraitFamily(classId, weaponFamilyId);
  return WEAPON_PORTRAITS[family]?.idle ?? CLASS_FALLBACK_PORTRAITS[classId].idle;
}

export function resolvePlayerCombatAttackPortrait(
  classId: ClassType = 'AEGIS',
  weaponFamilyId?: WeaponFamilyId | null,
): ImageSourcePropType {
  const family = resolvePortraitFamily(classId, weaponFamilyId);
  return WEAPON_PORTRAITS[family]?.attack ?? CLASS_FALLBACK_PORTRAITS[classId].attack;
}

export function resolvePlayerCombatAttackArtScale(
  classId: ClassType = 'AEGIS',
  weaponFamilyId?: WeaponFamilyId | null,
): number {
  const { idle, attack } = resolveMetaPair(classId, weaponFamilyId);
  // Legacy aura helper — content-height ratio with shared attack shrink.
  return (idle.contentH / Math.max(1, attack.contentH)) * ATTACK_RELATIVE_TO_IDLE;
}

export function playerCombatAttackArtLayerStyle(scale: number): ImageStyle {
  if (scale <= 1) {
    return {};
  }
  return {
    position: 'absolute',
    bottom: 0,
    left: `${-(scale - 1) * 50}%`,
    width: `${scale * 100}%`,
    height: `${scale * 100}%`,
    minHeight: 120,
    backgroundColor: 'transparent',
    ...WEB_CONTAIN_BOTTOM,
  };
}

export function resolvePlayerBadgePortrait(classId: ClassType = 'AEGIS'): ImageSourcePropType {
  return CLASS_BADGE_ICONS[classId];
}
