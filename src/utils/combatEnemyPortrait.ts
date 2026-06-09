import { ImageSourcePropType } from 'react-native';
import EnemyStandard from '../../assets/enemy images/enemy_placeholder.png';
import EnemyElite from '../../assets/enemy images/enemyl2.png';
import EnemyBoss from '../../assets/enemy images/bossv1.png';
import EnemyStalker from '../../assets/enemy images/stalkerv1.png';
import type { RunNodeType } from '../types/game';

export function resolveCombatEnemyPortrait(options: {
  isBoss: boolean;
  isVeilStalker?: boolean;
  nodeType?: RunNodeType | null;
}): ImageSourcePropType {
  if (options.isVeilStalker) return EnemyStalker;
  if (options.isBoss) return EnemyBoss;
  if (options.nodeType === 'ELITE_COMBAT') return EnemyElite;
  return EnemyStandard;
}

export function resolvePortraitKeySuffix(options: {
  isBoss: boolean;
  isVeilStalker?: boolean;
  nodeType?: RunNodeType | null;
}): string {
  if (options.isVeilStalker) return 'stalker';
  if (options.isBoss) return 'boss';
  if (options.nodeType === 'ELITE_COMBAT') return 'elite';
  return 'standard';
}
