import type { ImageSourcePropType } from 'react-native';

import AegisCombatAttack from '../../assets/images/character images/aegis/aegis_attacking.png';
import AegisCombatIdle from '../../assets/images/character images/aegis/aegis_combat.png';

export function resolvePlayerCombatIdlePortrait(): ImageSourcePropType {
  return AegisCombatIdle;
}

export function resolvePlayerCombatAttackPortrait(): ImageSourcePropType {
  return AegisCombatAttack;
}
