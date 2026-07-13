import type { CabalEmployerId } from '../../types/worldState';

const REP_RANK_STEP = 5;

export interface SponsorReputationPreview {
  sponsorId: CabalEmployerId;
  reputation: number;
  rank: number;
  progressInRank: number;
  progressToNext: number;
  nextUnlockHint: string;
}

export function buildSponsorReputationPreview(
  sponsorId: CabalEmployerId,
  reputation: number,
): SponsorReputationPreview {
  const rank = Math.floor(reputation / REP_RANK_STEP);
  const progressInRank = reputation % REP_RANK_STEP;
  const progressToNext = REP_RANK_STEP - progressInRank;
  const nextUnlockHint = progressInRank >= REP_RANK_STEP - 1
    ? 'Next rank unlock imminent — harder contracts may appear.'
    : `${progressToNext} rep to next rank tier.`;

  return {
    sponsorId,
    reputation,
    rank,
    progressInRank,
    progressToNext,
    nextUnlockHint,
  };
}

export function formatSponsorReputationLine(preview: SponsorReputationPreview, displayName: string): string {
  return `${displayName.toUpperCase()}: ${preview.reputation} REP (RANK ${preview.rank}) — ${preview.nextUnlockHint}`;
}
