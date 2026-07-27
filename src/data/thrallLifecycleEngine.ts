/**
 * Thrall Undying lifecycle — ACTIVE → SLUMPED → DEAD / ACTIVE (reanimated).
 * Pure rules used by combatLifecycleEngine + hub turn timing.
 */

export type ThrallLifecycleState = 'ACTIVE' | 'SLUMPED' | 'DEAD';

/** Tags that permanently kill an ACTIVE thrall without entering Slump. */
export const THRALL_BYPASS_SLUMP_TAGS = [
  'HEAVY',
  'EXECUTE',
  'FINISHER',
  'EXECUTION',
] as const;

export type ThrallBypassSlumpTag = (typeof THRALL_BYPASS_SLUMP_TAGS)[number];

export const THRALL_ROSTER_IDS = ['thrall', 'remembering-thrall'] as const;

export const THRALL_DEFAULT_REVIVE_HP_PERCENT = 0.4;

export function isThrallRosterId(rosterId: string | undefined | null): boolean {
  return rosterId === 'thrall' || rosterId === 'remembering-thrall';
}

export function attackBypassesThrallSlump(tags: readonly string[] | undefined | null): boolean {
  if (!tags?.length) return false;
  const set = new Set(tags);
  return THRALL_BYPASS_SLUMP_TAGS.some((tag) => set.has(tag));
}

export function resolveThrallLifecycleState(input: {
  isSlumped?: boolean;
  currentHp: number;
}): ThrallLifecycleState {
  if (input.isSlumped) return 'SLUMPED';
  if (input.currentHp <= 0) return 'DEAD';
  return 'ACTIVE';
}

export interface ThrallKillingBlowMeta {
  damage: number;
  tags?: readonly string[];
  /** Defaults to true when omitted — DoT/indirect should pass false. */
  isDirectDamage?: boolean;
}

export type ThrallDeathOutcome =
  | { kind: 'TRUE_DEATH'; reason: 'FLESH_WARP' | 'HEAVY_BYPASS' | 'EXECUTE' }
  | { kind: 'ENTER_SLUMP' };

/**
 * Resolve lethal blow against a thrall.
 * Slumped + direct damage → execute. Heavy/Execute tags on ACTIVE → bypass.
 * Otherwise → enter Slump (HP stays 0).
 */
export function resolveThrallLethalBlow(
  enemy: { isSlumped?: boolean; unitId?: string },
  blow: ThrallKillingBlowMeta,
  opts: { fleshWarped: boolean },
): ThrallDeathOutcome {
  if (opts.fleshWarped) {
    return { kind: 'TRUE_DEATH', reason: 'FLESH_WARP' };
  }
  if (enemy.isSlumped) {
    if (blow.isDirectDamage === false) {
      // Indirect damage cannot execute a slumped thrall — leave slumped.
      return { kind: 'ENTER_SLUMP' };
    }
    return { kind: 'TRUE_DEATH', reason: 'EXECUTE' };
  }
  if (attackBypassesThrallSlump(blow.tags)) {
    return { kind: 'TRUE_DEATH', reason: 'HEAVY_BYPASS' };
  }
  return { kind: 'ENTER_SLUMP' };
}

export function thrallSlumpEnterPatch(): {
  isSlumped: true;
  slumpTurnsRemaining: number;
  slumpGraceThisPlayerTurn: true;
  currentHp: 0;
  skipNextAction: false;
} {
  return {
    isSlumped: true,
    /** One full player turn after the turn of entry (grace skips the entry turn end). */
    slumpTurnsRemaining: 1,
    slumpGraceThisPlayerTurn: true,
    currentHp: 0,
    skipNextAction: false,
  };
}

export function thrallTrueDeathPatch(): {
  isSlumped: false;
  slumpTurnsRemaining: number;
  slumpGraceThisPlayerTurn: false;
  currentHp: 0;
  skipNextAction: false;
} {
  return {
    isSlumped: false,
    slumpTurnsRemaining: 0,
    slumpGraceThisPlayerTurn: false,
    currentHp: 0,
    skipNextAction: false,
  };
}

export function thrallRevivePatch(
  maxHp: number,
  reviveHpPercent: number = THRALL_DEFAULT_REVIVE_HP_PERCENT,
): {
  isSlumped: false;
  slumpTurnsRemaining: number;
  slumpGraceThisPlayerTurn: false;
  currentHp: number;
  skipNextAction: true;
} {
  const pct = Math.max(0.05, Math.min(1, reviveHpPercent));
  return {
    isSlumped: false,
    slumpTurnsRemaining: 0,
    slumpGraceThisPlayerTurn: false,
    currentHp: Math.max(1, Math.floor(maxHp * pct)),
    skipNextAction: true,
  };
}

export function thrallDeathLogLine(
  designation: string,
  outcome: ThrallDeathOutcome,
): string {
  switch (outcome.kind) {
    case 'ENTER_SLUMP':
      return `>> ${designation} SLUMPS — strike it again before it reanimates.`;
    case 'TRUE_DEATH':
      if (outcome.reason === 'EXECUTE') {
        return `>> ${designation} EXECUTED — revival prevented.`;
      }
      if (outcome.reason === 'HEAVY_BYPASS') {
        return `>> ${designation} DESTROYED — Slump prevented by a heavy strike.`;
      }
      return `>> ${designation} TRUE DEATH — flesh-warp seal denies slump.`;
    default:
      return `>> ${designation} TRUE DEATH.`;
  }
}

export function thrallReanimateLogLine(designation: string, hp: number): string {
  return `>> ${designation} REANIMATES at ${hp} health.`;
}

export const THRALL_SLUMP_FLOAT = 'SLUMPED — FINISH IT';
export const THRALL_REANIMATE_FLOAT = 'REANIMATED';
export const THRALL_EXECUTE_FLOAT = 'EXECUTED';

export const THRALL_SLUMP_INTEL = [
  'SLUMPED',
  'Any direct attack executes this enemy.',
  'Heavy attacks bypass Slump entirely.',
  'Revives at 40% HP if ignored.',
] as const;
