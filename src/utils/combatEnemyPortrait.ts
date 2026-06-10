import { ImageSourcePropType } from 'react-native';
import EnemyStandard from '../../assets/enemy images/enemy_placeholder.png';
import EnemyElite from '../../assets/enemy images/enemyl2.png';
import EnemyBoss from '../../assets/enemy images/bossv1.png';
import EnemyStalker from '../../assets/enemy images/stalkerv1.png';
import type { RunNodeType } from '../types/game';
import type { EnemyCombatProfile } from '../types/run';
import { ENEMY_ROSTER, type EnemyRosterId } from '../data/enemyRoster';

export function resolveCombatEnemyPortrait(options: {
  isBoss: boolean;
  isVeilStalker?: boolean;
  nodeType?: RunNodeType | null;
  isElite?: boolean;
  enemyClass?: EnemyCombatProfile['class'];
}): ImageSourcePropType {
  if (options.isVeilStalker) return EnemyStalker;
  if (options.isBoss) return EnemyBoss;
  if (options.isElite || options.nodeType === 'ELITE_COMBAT') return EnemyElite;
  if (options.enemyClass === 'ABOMINATION') return EnemyElite;
  return EnemyStandard;
}

export function resolveUnitCombatPortrait(
  unit: Pick<
    EnemyCombatProfile,
    'isBoss' | 'isVeilStalker' | 'class' | 'rosterId'
  >,
  nodeType?: RunNodeType | null,
): ImageSourcePropType {
  const rosterElite = unit.rosterId
    ? ENEMY_ROSTER[unit.rosterId as EnemyRosterId]?.elite === true
    : false;
  return resolveCombatEnemyPortrait({
    isBoss: unit.isBoss === true,
    isVeilStalker: unit.isVeilStalker === true,
    nodeType,
    isElite: rosterElite,
    enemyClass: unit.class,
  });
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
