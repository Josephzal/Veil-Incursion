import type { WeaponStatModifiers } from '../types/weapon';
import { weaponHealReceivedMultiplier } from './weaponCombatEngine';

/**
 * Scale player-originated enemy debuff durations once.
 * Does not extend self-debuffs, permanent (99+) statuses, buffs, or enemy-origin effects.
 */
export function scalePlayerOriginDebuffDuration(
  baseTurns: number,
  mods: WeaponStatModifiers | null | undefined,
): { turns: number; appliedPct: number; logged: string | null } {
  if (baseTurns <= 0) return { turns: baseTurns, appliedPct: 0, logged: null };
  // Permanent / encounter-long markers are not scaled.
  if (baseTurns >= 99) return { turns: baseTurns, appliedPct: 0, logged: null };
  const pct = mods?.debuffDurationPct ?? 0;
  if (!pct) return { turns: baseTurns, appliedPct: 0, logged: null };
  const turns = Math.max(1, Math.ceil(baseTurns * (1 + pct / 100)));
  return {
    turns,
    appliedPct: pct,
    logged: `[WEAPON] >> Debuff duration ${baseTurns}→${turns} (+${pct}%).`,
  };
}

/**
 * Apply healReceivedPct exactly once on the central heal path.
 * Does not touch shields, Max HP, sacrifice costs, damage prevention, or enemy healing.
 */
export function resolvePlayerHealReceived(args: {
  rawAmount: number;
  mods: WeaponStatModifiers | null | undefined;
  healingReceivedPenaltyPct?: number;
  cargoHealMult?: number;
}): { effectiveAmount: number; logged: string | null } {
  const penalty = args.healingReceivedPenaltyPct ?? 0;
  const penalized = penalty > 0
    ? Math.floor(args.rawAmount * (1 - penalty / 100))
    : args.rawAmount;
  const cargo = args.cargoHealMult ?? 1;
  const weaponMult = args.mods ? weaponHealReceivedMultiplier(args.mods) : 1;
  const effectiveAmount = Math.max(0, Math.floor(penalized * cargo * weaponMult));
  const logged = args.mods?.healReceivedPct
    ? `[WEAPON] >> Heal received ${args.rawAmount}→${effectiveAmount} (healReceivedPct ${args.mods.healReceivedPct}).`
    : null;
  return { effectiveAmount, logged };
}
