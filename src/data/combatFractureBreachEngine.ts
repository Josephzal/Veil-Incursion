import type { ResolvedWeaponCombatStats } from './inventory';
import type { ClassType } from '../types/game';

export interface FractureBreachStrikePlan {
  hitCount: number;
  damagePerHit: number;
  channel: 'KINETIC' | 'OCCULT' | 'TRUE';
  rollCrit: boolean;
  tag: string;
}

export function planFractureBreachStrike(
  operativeClass: ClassType,
  strikeStats: ResolvedWeaponCombatStats,
): FractureBreachStrikePlan {
  if (operativeClass === 'HEX_SHOT') {
    return {
      hitCount: 3,
      damagePerHit: 3,
      channel: 'TRUE',
      rollCrit: false,
      tag: '[FRACTURE BREACH]',
    };
  }
  if (operativeClass === 'ENVOY') {
    const spike = Math.max(24, Math.floor(strikeStats.strikeDamage * 2.5));
    return {
      hitCount: 1,
      damagePerHit: spike,
      channel: 'OCCULT',
      rollCrit: false,
      tag: '[OCCULT SPIKE]',
    };
  }
  const execution = Math.floor(strikeStats.strikeDamage * 2.2);
  return {
    hitCount: 1,
    damagePerHit: execution,
    channel: 'KINETIC',
    rollCrit: true,
    tag: '[FRACTURE EXECUTION]',
  };
}
