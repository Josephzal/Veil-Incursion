import type { ImageSourcePropType, ImageStyle } from 'react-native';
import { Platform } from 'react-native';
import type { ClassType } from '../types/game';

import AegisCombatAttack from '../../assets/images/character images/aegis/aegis_attacking.png';
import AegisCombatIdle from '../../assets/images/character images/aegis/aegis_combat.png';
import HexShotAttack from '../../assets/images/character images/hex-shot/hex_shot_attack.png';
import HexShotIdle from '../../assets/images/character images/hex-shot/hex_shot_idle.png';
import EnvoyAttack from '../../assets/images/character images/envoy/envoy_attack.png';
import EnvoyIdle from '../../assets/images/character images/envoy/envoy_idle.png';

const CLASS_PORTRAITS: Record<ClassType, { idle: ImageSourcePropType; attack: ImageSourcePropType }> = {
  AEGIS: { idle: AegisCombatIdle, attack: AegisCombatAttack },
  HEX_SHOT: { idle: HexShotIdle, attack: HexShotAttack },
  ENVOY: { idle: EnvoyIdle, attack: EnvoyAttack },
};

/** PNG layout metadata — feet row and canvas size drive alignment without drift. */
export type PortraitMeta = {
  canvasW: number;
  canvasH: number;
  contentH: number;
  feetFromBottom: number;
};

export const PORTRAIT_META: Record<ClassType, { idle: PortraitMeta; attack: PortraitMeta }> = {
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

export type FootprintBox = { width: number; height: number };

function attackArtScaleForBox(idle: PortraitMeta, attack: PortraitMeta, box: FootprintBox): number {
  const idleScale = containScale(idle, box);
  const attackScale = containScale(attack, box);
  return (idle.contentH * idleScale) / (attack.contentH * attackScale);
}

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
export function computeFootprintIdleLayout(box: FootprintBox, classId: ClassType): ImageStyle {
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

  const { idle } = PORTRAIT_META[classId];
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
 * Pixel-locked attack layout — matches idle character height and foot line.
 * No transform scale; size boost is baked into width/height.
 */
export function computeFootprintAttackLayout(box: FootprintBox, classId: ClassType): ImageStyle {
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

  const { idle, attack } = PORTRAIT_META[classId];
  const boost = attackArtScaleForBox(idle, attack, box);
  const display = canvasDisplaySize(attack, box, boost);
  const footDeltaPx = (attack.feetFromBottom - idle.feetFromBottom) * (display.width / attack.canvasW);

  return {
    position: 'absolute',
    bottom: 0,
    left: (box.width - display.width) / 2,
    width: display.width,
    height: display.height,
    backgroundColor: 'transparent',
    ...WEB_CONTAIN_BOTTOM,
    ...(footDeltaPx !== 0 ? { transform: [{ translateY: footDeltaPx }] } : {}),
  };
}

export function resolvePlayerCombatIdlePortrait(classId: ClassType = 'AEGIS'): ImageSourcePropType {
  return CLASS_PORTRAITS[classId].idle;
}

export function resolvePlayerCombatAttackPortrait(classId: ClassType = 'AEGIS'): ImageSourcePropType {
  return CLASS_PORTRAITS[classId].attack;
}

export function resolvePlayerCombatAttackArtScale(classId: ClassType = 'AEGIS'): number {
  const { idle, attack } = PORTRAIT_META[classId];
  return attackArtScaleEstimate(idle, attack);
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
  return CLASS_PORTRAITS[classId].idle;
}
