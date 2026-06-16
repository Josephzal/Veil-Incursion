import type { ImageSourcePropType } from 'react-native';
import FortifiedIcon from '../../assets/images/enemy status images/fortified.png';
import EvadingIcon from '../../assets/images/enemy status images/evading.png';
import EnragedIcon from '../../assets/images/enemy status images/enraged.png';
import ConcussedIcon from '../../assets/images/enemy status images/concussed.png';
import DoomedIcon from '../../assets/images/enemy status images/doomed.png';
import type { EnemyIntent } from '../types/run';

export type EnemyStatusEffectKey = 'fortified' | 'evading' | 'enraged' | 'concussed' | 'doomed';

export interface EnemyActiveStatusSource {
  combatTags?: readonly string[];
  evadeActive?: boolean;
  intent?: EnemyIntent;
  fortifyTurnsRemaining?: number;
  doomedStacks?: number;
  isEnraged?: boolean;
}

export interface EnemyStatusEffectDef {
  key: EnemyStatusEffectKey;
  label: string;
  description: string;
  icon: ImageSourcePropType;
}

export const ENEMY_STATUS_EFFECT_ORDER: readonly EnemyStatusEffectKey[] = [
  'fortified',
  'evading',
  'enraged',
  'concussed',
  'doomed',
] as const;

export const ENEMY_STATUS_EFFECTS: Record<EnemyStatusEffectKey, EnemyStatusEffectDef> = {
  fortified: {
    key: 'fortified',
    label: 'Fortified',
    description: '+30% Physical Damage Resistance.',
    icon: FortifiedIcon,
  },
  evading: {
    key: 'evading',
    label: 'Evading',
    description: 'Guaranteed dodge of the next targeted attack.',
    icon: EvadingIcon,
  },
  enraged: {
    key: 'enraged',
    label: 'Enraged',
    description: 'Combat frenzy below HP threshold — increased damage and roster-specific enrage effects.',
    icon: EnragedIcon,
  },
  concussed: {
    key: 'concussed',
    label: 'Concussed',
    description: '-1 Action Point (AP) gain per turn. Cannot use complex abilities.',
    icon: ConcussedIcon,
  },
  doomed: {
    key: 'doomed',
    label: 'Doomed',
    description: 'Takes True Damage (bypasses all armor) equal to 50% max HP in 1 turn.',
    icon: DoomedIcon,
  },
};

/** Derive tray icon keys from live hostile state. */
export function resolveActiveEnemyStatuses(unit: EnemyActiveStatusSource): EnemyStatusEffectKey[] {
  const tags = new Set(unit.combatTags ?? []);
  const statuses: EnemyStatusEffectKey[] = [];

  if ((unit.fortifyTurnsRemaining ?? 0) > 0) statuses.push('fortified');
  if (unit.evadeActive || unit.intent === 'EVADE') statuses.push('evading');
  if (unit.isEnraged) statuses.push('enraged');
  if (tags.has('CONCUSSED')) statuses.push('concussed');
  if (tags.has('DOOMED') || (unit.doomedStacks ?? 0) > 0) statuses.push('doomed');

  return ENEMY_STATUS_EFFECT_ORDER.filter((key) => statuses.includes(key));
}

export function getEnemyStatusEffectDef(key: EnemyStatusEffectKey): EnemyStatusEffectDef {
  return ENEMY_STATUS_EFFECTS[key];
}
