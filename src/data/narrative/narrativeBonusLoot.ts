import type { CargoRunState } from '../../types/cargoGrid';
import type { TensionMechanic } from '../../types/narrativeAssembly';
import type {
  NarrativeBonusReward,
  NarrativeBoonId,
  PendingNarrativeCombatBoons,
} from '../../types/narrativeBonusReward';
import { NARRATIVE_BOON_CATALOG } from '../../types/narrativeBonusReward';
import type { RunStatusEffect } from '../../types/narrativeProcedural';
import { hashSeed } from './narrativeAssemblyCore';
import { addLootToContainment } from '../cargoGridEngine';

type BonusPoolEntry =
  | { kind: 'BOON'; boonId: NarrativeBoonId }
  | { kind: 'CREDITS'; min: number; max: number }
  | { kind: 'VEIL_RESIDUE'; min: number; max: number };

const CONCEAL_POOL: BonusPoolEntry[] = [
  { kind: 'BOON', boonId: 'Ghosted_Boon' },
  { kind: 'BOON', boonId: 'Scouted_Boon' },
  { kind: 'CREDITS', min: 15, max: 25 },
];

const SIGIL_POOL: BonusPoolEntry[] = [
  { kind: 'BOON', boonId: 'Overcharged_Boon' },
  { kind: 'VEIL_RESIDUE', min: 3, max: 5 },
  { kind: 'BOON', boonId: 'Veil_Ward_Boon' },
];

function rollRange(seed: string, min: number, max: number): number {
  if (max <= min) return min;
  return min + (hashSeed(seed) % (max - min + 1));
}

function poolForMechanic(mechanic: TensionMechanic): BonusPoolEntry[] | null {
  if (mechanic === 'Mechanic_ConcealSlider') return CONCEAL_POOL;
  if (mechanic === 'Mechanic_SigilTrace') return SIGIL_POOL;
  return null;
}

export function rollNarrativeBonusReward(
  tensionMechanic: TensionMechanic,
  seed: string,
): NarrativeBonusReward | undefined {
  const pool = poolForMechanic(tensionMechanic);
  if (!pool || pool.length === 0) return undefined;

  const entry = pool[hashSeed(`${seed}:bonus-pick`) % pool.length]!;
  if (entry.kind === 'BOON') {
    return { kind: 'BOON', boonId: entry.boonId };
  }
  const amount = rollRange(`${seed}:bonus-amt`, entry.min, entry.max);
  return entry.kind === 'CREDITS'
    ? { kind: 'CREDITS', amount }
    : { kind: 'VEIL_RESIDUE', amount };
}

export function formatNarrativeBonusRewardLabel(reward: NarrativeBonusReward): string {
  if (reward.kind === 'CREDITS') return `+${reward.amount} Credits`;
  if (reward.kind === 'VEIL_RESIDUE') {
    return `+${reward.amount} Veil Residue`;
  }
  return `${NARRATIVE_BOON_CATALOG[reward.boonId].statusLabel} Gained`;
}

export function formatNarrativeBonusLogLine(reward: NarrativeBonusReward): string {
  return `>> BONUS LOOT — ${formatNarrativeBonusRewardLabel(reward)}`;
}

export function bonusRewardCredits(reward: NarrativeBonusReward | undefined): number {
  return reward?.kind === 'CREDITS' ? reward.amount : 0;
}

export function applyBoonToPending(
  pending: PendingNarrativeCombatBoons,
  boonId: NarrativeBoonId,
): PendingNarrativeCombatBoons {
  switch (boonId) {
    case 'Ghosted_Boon':
      return { ...pending, ghosted: true };
    case 'Scouted_Boon':
      return { ...pending, scouted: true };
    case 'Overcharged_Boon':
      return { ...pending, overcharged: true };
    case 'Veil_Ward_Boon':
      return { ...pending, veilWard: true };
    default:
      return pending;
  }
}

export function runStatusEffectForBoon(boonId: NarrativeBoonId): RunStatusEffect {
  const meta = NARRATIVE_BOON_CATALOG[boonId];
  return {
    id: `narrative-boon-${boonId}`,
    label: meta.statusLabel,
    description: meta.description,
    source: 'BOON',
  };
}

export function applyVeilResidueBonus(cargo: CargoRunState, amount: number): CargoRunState {
  return addLootToContainment(cargo, 'veil-residue-bulk', amount);
}

export function hasPendingNarrativeCombatBoons(pending: PendingNarrativeCombatBoons): boolean {
  return pending.ghosted || pending.scouted || pending.overcharged || pending.veilWard;
}

export function stripNarrativeBoonStatusEffects(
  effects: readonly RunStatusEffect[],
): RunStatusEffect[] {
  return effects.filter((effect) => !effect.id.startsWith('narrative-boon-'));
}
