export interface HostileDamageLayers {
  incoming: number;
  ordinaryMitigationAndBarrier: number;
  parryOrRiftPrevention: number;
  shardsAbsorb: number;
  soulAnchorHp: number;
}

export interface HostileHpLossResult {
  preventedBeforeHp: number;
  hpLost: number;
  qualifiesAsEnemyDamageHpLoss: boolean;
}

/** Hostile order: mitigation/Barrier → Parry/Rift Ward → Shards → Soul Anchor HP. */
export function resolveHostileHpLoss(layers: HostileDamageLayers): HostileHpLossResult {
  let remaining = Math.max(0, layers.incoming);
  remaining = Math.max(0, remaining - layers.ordinaryMitigationAndBarrier);
  remaining = Math.max(0, remaining - layers.parryOrRiftPrevention);
  remaining = Math.max(0, remaining - layers.shardsAbsorb);
  const hpLost = Math.min(remaining, Math.max(0, layers.soulAnchorHp));
  return {
    preventedBeforeHp: layers.incoming - remaining,
    hpLost,
    qualifiesAsEnemyDamageHpLoss: hpLost > 0,
  };
}

export interface VoluntaryHpCostInput {
  cost: number;
  currentHp: number;
  lethalPaymentPermitted: boolean;
}

export function resolveVoluntaryHpCost(input: VoluntaryHpCostInput): { paid: number; remainingHp: number; rejected: boolean } {
  if (input.cost <= 0) return { paid: 0, remainingHp: input.currentHp, rejected: false };
  if (input.lethalPaymentPermitted) {
    const paid = Math.min(input.cost, input.currentHp);
    return { paid, remainingHp: input.currentHp - paid, rejected: paid < input.cost };
  }
  if (input.currentHp <= 1) {
    return { paid: 0, remainingHp: input.currentHp, rejected: true };
  }
  const maxPayable = input.currentHp - 1;
  if (input.cost > maxPayable) {
    return { paid: 0, remainingHp: input.currentHp, rejected: true };
  }
  return { paid: input.cost, remainingHp: input.currentHp - input.cost, rejected: false };
}
