import type { DistrictId } from './districtPacing';
import {
  decideEnemyIntent,
  defaultPlayerAIState,
  enemyAIStateFromProfile,
  type PlayerAIState,
} from './AIDecisionEngine';
import type { EnemyClass, EnemyCombatProfile, EnemyIntent } from '../types/run';

const CLASS_BASE_HP: Record<EnemyClass, number> = {
  GREMLIN: 40,
  APPARITION: 60,
  ABOMINATION: 90,
};

const CLASS_BASE_DAMAGE: Record<EnemyClass, number> = {
  GREMLIN: 8,
  APPARITION: 12,
  ABOMINATION: 16,
};

/** @deprecated Use decideEnemyIntent via advanceEnemyIntent / rollEnemyIntentForProfile. */
export function rollEnemyIntent(
  classType: EnemyClass,
  chargeTurns: number,
  district: DistrictId = 1,
  playerState?: PlayerAIState,
): EnemyIntent {
  return rollEnemyIntentForProfile(
    {
      class: classType,
      currentHp: CLASS_BASE_HP[classType],
      maxHp: CLASS_BASE_HP[classType],
      baseDamage: CLASS_BASE_DAMAGE[classType],
      chargeTurns,
      intent: chargeTurns > 0 ? 'CHARGE' : 'STRIKE',
      evadeActive: false,
    } as EnemyCombatProfile,
    district,
    playerState,
  );
}

export function rollEnemyIntentForProfile(
  profile: Pick<EnemyCombatProfile, 'class' | 'currentHp' | 'maxHp' | 'baseDamage' | 'chargeTurns' | 'intent' | 'evadeActive'>,
  district: DistrictId = 1,
  playerState?: PlayerAIState,
): EnemyIntent {
  const enemyState = enemyAIStateFromProfile(
    {
      ...profile,
      designation: '',
      nodeIndex: 0,
      scale: 1,
    } as EnemyCombatProfile,
    district,
  );
  return decideEnemyIntent({
    enemy: { ...enemyState, chargeTurns: profile.chargeTurns ?? 0 },
    player: playerState ?? defaultPlayerAIState(),
  });
}
