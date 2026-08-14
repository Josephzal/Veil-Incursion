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
