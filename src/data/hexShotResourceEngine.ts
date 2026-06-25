import type { HexShotAbilityDefinition } from './hexShotAbilities';

export interface HexShotResolvedResourceCosts {
  apCost: number;
  ammoCost: number;
  staminaCost: number;
  staminaCostPct: number;
}

/**
 * Enforces the Hex Shot tri-resource split:
 * BALLISTIC → ammo only, TACTICAL → stamina only (graft overrides preserved).
 */
export function resolveHexShotResourceCosts(
  def: HexShotAbilityDefinition,
  overrides?: { apCost?: number; ammoCost?: number },
): HexShotResolvedResourceCosts {
  const tags = def.tags;
  const pureBallistic = tags.includes('BALLISTIC') && !tags.includes('TACTICAL');
  const pureTactical = tags.includes('TACTICAL') && !tags.includes('BALLISTIC');

  let ammoCost = overrides?.ammoCost ?? def.ammoCost;
  let staminaCost = def.staminaCost;
  let staminaCostPct = def.staminaCostPct ?? 0;

  if (pureTactical && overrides?.ammoCost == null) {
    ammoCost = 0;
  }
  if (pureBallistic) {
    staminaCost = 0;
    staminaCostPct = 0;
  }

  return {
    apCost: overrides?.apCost ?? def.apCost,
    ammoCost: Math.max(0, ammoCost),
    staminaCost: Math.max(0, staminaCost),
    staminaCostPct: Math.max(0, staminaCostPct),
  };
}
