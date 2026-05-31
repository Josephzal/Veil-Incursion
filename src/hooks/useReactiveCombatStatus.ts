import { useMemo } from 'react';
import { CombatStatusEffect } from '../types/run';
import { deriveCombatStatusEffects, isCombatExhausted } from '../utils/combatResourceState';

/** Reactive status pipeline — EXHAUSTED tracks stamina === 0 only. */
export function useReactiveCombatStatus(stamina: number): {
  statusEffects: CombatStatusEffect[];
  isExhausted: boolean;
} {
  const statusEffects = useMemo(() => deriveCombatStatusEffects(stamina), [stamina]);
  const isExhausted = useMemo(
    () => isCombatExhausted(stamina, statusEffects),
    [stamina, statusEffects],
  );
  return { statusEffects, isExhausted };
}
