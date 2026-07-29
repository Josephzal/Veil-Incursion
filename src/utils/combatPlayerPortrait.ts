import type { ImageSourcePropType, ImageStyle } from 'react-native';
import { Platform } from 'react-native';
import type { ClassType } from '../types/game';
import type { WeaponFamilyId } from '../types/weapon';
import { STARTER_WEAPON_BY_CLASS, getWeaponFamily, isWeaponFamilyId } from '../data/weaponRegistry';

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
  contentH: number;
  feetFromBottom: number;
};

type PortraitMetaPair = { idle: PortraitMeta; attack: PortraitMeta };

/** Class-keyed meta retained for badge / legacy callers. */
export const PORTRAIT_META: Record<ClassType, PortraitMetaPair> = {
  ENVOY: {
    idle: { canvasW: 450, canvasH: 1088, contentH: 1070, feetFromBottom: 0 },
    attack: { canvasW: 824, canvasH: 1156, contentH: 1102, feetFromBottom: 19 },
  },
  HEX_SHOT: {
    idle: { canvasW: 592, canvasH: 1254, contentH: 1205, feetFromBottom: 23 },
    attack: { canvasW: 698, canvasH: 1262, contentH: 1213, feetFromBottom: 27 },
  },
  AEGIS: {
    idle: { canvasW: 400, canvasH: 1172, contentH: 1140, feetFromBottom: 19 },
    attack: { canvasW: 800, canvasH: 998, contentH: 969, feetFromBottom: 17 },
  },
};

const WEAPON_PORTRAIT_META: Record<WeaponFamilyId, PortraitMetaPair> = {
  'aegis-runed-longsword': PORTRAIT_META.AEGIS,
  'aegis-rift-edge': {
    idle: { canvasW: 1384, canvasH: 1636, contentH: 1600, feetFromBottom: 20 },
    attack: { canvasW: 1666, canvasH: 1384, contentH: 1340, feetFromBottom: 18 },
  },
  'aegis-claymore-blade': {
    idle: { canvasW: 1200, canvasH: 1608, contentH: 1570, feetFromBottom: 20 },
    attack: { canvasW: 1130, canvasH: 1626, contentH: 1590, feetFromBottom: 18 },
  },
  'hex-silver-core-sidearm': PORTRAIT_META.HEX_SHOT,
  'hex-pulse-rifle': {
    idle: { canvasW: 988, canvasH: 1772, contentH: 1720, feetFromBottom: 24 },
    attack: { canvasW: 1174, canvasH: 1724, contentH: 1670, feetFromBottom: 26 },
  },
  'hex-void-cannon': {
    idle: { canvasW: 682, canvasH: 1632, contentH: 1580, feetFromBottom: 22 },
    attack: { canvasW: 1394, canvasH: 1542, contentH: 1490, feetFromBottom: 24 },
  },
  'envoy-echo-lantern': {
    idle: { canvasW: 772, canvasH: 1734, contentH: 1690, feetFromBottom: 12 },
    attack: { canvasW: 1284, canvasH: 1578, contentH: 1520, feetFromBottom: 18 },
  },
  'envoy-null-conduit': {
    idle: { canvasW: 968, canvasH: 1698, contentH: 1650, feetFromBottom: 14 },
    attack: { canvasW: 1962, canvasH: 1396, contentH: 1340, feetFromBottom: 16 },
  },
  'envoy-sanguine-prism': {
    idle: { canvasW: 856, canvasH: 1554, contentH: 1510, feetFromBottom: 12 },
    attack: { canvasW: 2058, canvasH: 1256, contentH: 1200, feetFromBottom: 14 },
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

function attackArtScaleForBox(idle: PortraitMeta, attack: PortraitMeta, box: FootprintBox): number {
  const idleScale = containScale(idle, box);
  const attackScale = containScale(attack, box);
  return (idle.contentH * idleScale) / (attack.contentH * attackScale);
}

/**
 * Extra shrink after height-matching — attack pose should read slightly smaller than idle.
 * Aegis attack canvas is much wider; without this it still feels oversized.
 */
const ATTACK_RELATIVE_TO_IDLE: Record<ClassType, number> = {
  AEGIS: 0.86,
  HEX_SHOT: 0.94,
  ENVOY: 0.94,
};

/**
 * Where the character body sits in the attack canvas (0 = left edge, 0.5 = center).
 * Wide melee / scythe / heart canvases keep the body under the idle pose.
 */
const ATTACK_BODY_ANCHOR_X_BY_WEAPON: Record<WeaponFamilyId, number> = {
  'aegis-runed-longsword': 0.30,
  'aegis-rift-edge': 0.32,
  'aegis-claymore-blade': 0.34,
  'hex-silver-core-sidearm': 0.50,
  'hex-pulse-rifle': 0.48,
  'hex-void-cannon': 0.42,
  'envoy-echo-lantern': 0.48,
  'envoy-null-conduit': 0.34,
  'envoy-sanguine-prism': 0.32,
};

const ATTACK_BODY_ANCHOR_X_BY_CLASS: Record<ClassType, number> = {
  AEGIS: 0.30,
  HEX_SHOT: 0.50,
  ENVOY: 0.50,
};

/** Width-limited estimate for legacy aura sizing outside the footprint lock path. */
function attackArtScaleEstimate(idle: PortraitMeta, attack: PortraitMeta): number {
  return (idle.contentH / idle.canvasW) / (attack.contentH / attack.canvasW);
}

function containScale(meta: PortraitMeta, box: FootprintBox): number {
  return Math.min(box.width / meta.canvasW, box.height / meta.canvasH);
}

function canvasDisplaySize(meta: PortraitMeta, box: FootprintBox, boost = 1): { width: number; height: number } {
  const scale = containScale(meta, box) * boost;
  return {
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

  const { idle } = resolveMetaPair(classId, weaponFamilyId);
  const display = canvasDisplaySize(idle, box);

  return {
    position: 'absolute',
    bottom: 0,
    left: (box.width - display.width) / 2,
    width: display.width,
    height: display.height,
    backgroundColor: 'transparent',
    ...WEB_CONTAIN_BOTTOM,
  };
}

/**
 * Pixel-locked attack layout — slightly smaller than idle character height,
 * body-anchored so wide melee canvases still read as lunging forward.
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

  const { idle, attack } = resolveMetaPair(classId, weaponFamilyId);
  const boost = attackArtScaleForBox(idle, attack, box) * ATTACK_RELATIVE_TO_IDLE[classId];
  const display = canvasDisplaySize(attack, box, boost);
  const footDeltaPx = (attack.feetFromBottom - idle.feetFromBottom) * (display.width / attack.canvasW);
  const idleCenterX = box.width / 2;
  const family = resolvePortraitFamily(classId, weaponFamilyId);
  const bodyAnchorX = weaponFamilyId
    ? ATTACK_BODY_ANCHOR_X_BY_WEAPON[family]
    : ATTACK_BODY_ANCHOR_X_BY_CLASS[classId];
  const left = idleCenterX - display.width * bodyAnchorX;

  return {
    position: 'absolute',
    bottom: 0,
    left,
    width: display.width,
    height: display.height,
    backgroundColor: 'transparent',
    ...WEB_CONTAIN_BOTTOM,
    ...(footDeltaPx !== 0 ? { transform: [{ translateY: footDeltaPx }] } : {}),
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
  return attackArtScaleEstimate(idle, attack) * ATTACK_RELATIVE_TO_IDLE[classId];
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
