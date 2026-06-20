import type { ImageSourcePropType } from 'react-native';
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

export function resolvePlayerCombatIdlePortrait(classId: ClassType = 'AEGIS'): ImageSourcePropType {
  return CLASS_PORTRAITS[classId].idle;
}

export function resolvePlayerCombatAttackPortrait(classId: ClassType = 'AEGIS'): ImageSourcePropType {
  return CLASS_PORTRAITS[classId].attack;
}

export function resolvePlayerBadgePortrait(classId: ClassType = 'AEGIS'): ImageSourcePropType {
  return CLASS_PORTRAITS[classId].idle;
}
