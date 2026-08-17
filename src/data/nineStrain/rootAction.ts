import type { CanonicalRootActionContext, TargetNativeResult } from '../../types/nineStrain';

export function aggregateNativeByTarget(
  hits: readonly { targetId: string; damage: number; miss?: boolean; crit?: boolean }[],
): TargetNativeResult[] {
  const byTarget = new Map<string, TargetNativeResult>();
  for (const hit of hits) {
    const current = byTarget.get(hit.targetId) ?? {
      targetId: hit.targetId,
      hits: 0,
      misses: 0,
      crits: 0,
      nativeDirectDamage: 0,
      defenseDamage: 0,
      defenseBreaks: 0,
      fractures: 0,
      statusesApplied: 0,
      killed: false,
      healingDealt: 0,
      movement: 0,
    };
    if (hit.miss) {
      current.misses += 1;
    } else {
      current.hits += 1;
      current.nativeDirectDamage += hit.damage;
      if (hit.crit) current.crits += 1;
    }
    byTarget.set(hit.targetId, current);
  }
  return [...byTarget.values()];
}

export function totalNativeDirectDamage(results: readonly TargetNativeResult[]): number {
  return results.reduce((sum, row) => sum + row.nativeDirectDamage, 0);
}

export function isCommittedRootAction(ctx: CanonicalRootActionContext): boolean {
  return ctx.committed === true && ctx.classification === 'NATIVE_DIRECT';
}

export function nativeResultForTarget(
  ctx: CanonicalRootActionContext,
  targetId: string,
): TargetNativeResult | null {
  return ctx.nativeByTarget.find((row) => row.targetId === targetId) ?? null;
}

/** Native committed-root result against a hostile — not selection, miss-only, or derivatives. */
export function isDirectlyAffectedNative(row: TargetNativeResult): boolean {
  if (row.misses > 0 && row.hits === 0 && row.nativeDirectDamage <= 0 && row.defenseDamage <= 0) {
    return row.killed || row.statusesApplied > 0 || row.movement > 0
      || row.kineticArmorBroken === true || row.occultWardBroken === true
      || row.defenseBreaks > 0 || row.fractures > 0;
  }
  return row.nativeDirectDamage > 0
    || row.defenseDamage > 0
    || row.defenseBreaks > 0
    || row.fractures > 0
    || row.statusesApplied > 0
    || row.killed
    || row.movement > 0
    || row.kineticArmorBroken === true
    || row.occultWardBroken === true;
}

/**
 * Deterministic affected order: locked primary, remaining locked pattern, then unit id.
 * Battlefield rank is applied by Woundweave when intent snapshots are available.
 */
export function directlyAffectedTargetIds(ctx: CanonicalRootActionContext): string[] {
  const unique = [...new Set(ctx.nativeByTarget.filter(isDirectlyAffectedNative).map((row) => row.targetId))];
  const locked = ctx.lockedTargetIds;
  const primary = locked[0];
  return unique.slice().sort((a, b) => {
    if (a === primary && b !== primary) return -1;
    if (b === primary && a !== primary) return 1;
    const ai = locked.indexOf(a);
    const bi = locked.indexOf(b);
    if (ai >= 0 && bi >= 0 && ai !== bi) return ai - bi;
    if (ai >= 0 && bi < 0) return -1;
    if (bi >= 0 && ai < 0) return 1;
    return a.localeCompare(b);
  });
}
