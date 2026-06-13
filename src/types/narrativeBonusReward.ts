/** Narrative mini-game bonus loot — rolled once per encounter for options A/B/C. */

export type NarrativeBoonId =
  | 'Ghosted_Boon'
  | 'Scouted_Boon'
  | 'Overcharged_Boon'
  | 'Veil_Ward_Boon';

export type NarrativeBonusReward =
  | { kind: 'CREDITS'; amount: number }
  | { kind: 'VEIL_RESIDUE'; amount: number }
  | { kind: 'BOON'; boonId: NarrativeBoonId };

export interface PendingNarrativeCombatBoons {
  ghosted: boolean;
  scouted: boolean;
  overcharged: boolean;
  veilWard: boolean;
}

export function createDefaultPendingNarrativeCombatBoons(): PendingNarrativeCombatBoons {
  return {
    ghosted: false,
    scouted: false,
    overcharged: false,
    veilWard: false,
  };
}

export const NARRATIVE_BOON_CATALOG: Record<
  NarrativeBoonId,
  { label: string; description: string; statusLabel: string }
> = {
  Ghosted_Boon: {
    label: 'Ghosted',
    statusLabel: 'Ghosted Boon',
    description: '+1 AP on your first turn of the next combat encounter.',
  },
  Scouted_Boon: {
    label: 'Scouted',
    statusLabel: 'Scouted Boon',
    description: 'Hostiles in the next combat encounter start at −10% current HP.',
  },
  Overcharged_Boon: {
    label: 'Overcharged',
    statusLabel: 'Overcharged Boon',
    description: 'Your first damaging strike in the next combat ignores all mitigation.',
  },
  Veil_Ward_Boon: {
    label: 'Veil Ward',
    statusLabel: 'Veil Ward Boon',
    description: '+15 shield capacity for the duration of the next combat encounter.',
  },
};
