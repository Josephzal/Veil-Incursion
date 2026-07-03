import type { CabalEmployerId } from '../types/worldState';
import { EMPLOYER_PACKAGES } from '../data/worldStateEngine';

export function describeEmployerPerks(employerId: CabalEmployerId): string[] {
  const pkg = EMPLOYER_PACKAGES[employerId];
  const lines: string[] = [];
  if (pkg.maxHpBonusPct > 0) lines.push(`+${pkg.maxHpBonusPct}% Max HP`);
  if (pkg.kineticArmorBonus > 0) lines.push(`+${pkg.kineticArmorBonus} Kinetic Armor`);
  if (pkg.rareLootBonusPct > 0) lines.push(`+${pkg.rareLootBonusPct}% Rare Loot`);
  if (pkg.blackMarketDiscountPct > 0) lines.push(`${pkg.blackMarketDiscountPct}% Black Market Discount`);
  if (pkg.firstTurnApBonus > 0) lines.push(`+${pkg.firstTurnApBonus} AP Turn 1`);
  if (pkg.creditBonusPct > 0) lines.push(`+${pkg.creditBonusPct}% Credit Bonus`);
  return lines.length > 0 ? lines : ['Standard sponsor terms'];
}

export function employerSponsorLabel(employerId: CabalEmployerId): string {
  switch (employerId) {
    case 'TERRAN_GRID':
      return 'Terran Grid Requisition';
    case 'LEGION':
      return 'Legion Void Contract';
    case 'SOLARIS':
      return 'Solaris Anomaly Bounty';
    default:
      return employerId;
  }
}
