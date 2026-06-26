import type { FactionType } from '../types/game';
import type {
  BoundRequisitionDefinition,
  BoundRequisitionId,
  BoundRequisitionTier,
} from '../types/boundRequisition';
import { getBoundRequisitionLevel } from './boundRequisitionProgression';
import type { PlayerAccount } from '../types/game';

export const BOUND_REQUISITION_CATALOG: Record<BoundRequisitionId, BoundRequisitionDefinition> = {
  HAZARD_PAY: {
    id: 'HAZARD_PAY',
    name: 'Hazard Pay',
    tier: 1,
    kind: 'STANDARD',
    tagline: 'PRE-LOADED CRED-STICK',
    effectSummary: 'Start the run with 50 Credits.',
  },
  STANDARD_ISSUE_COAGULANT: {
    id: 'STANDARD_ISSUE_COAGULANT',
    name: 'Standard-Issue Coagulant',
    tier: 1,
    kind: 'STANDARD',
    tagline: 'FIELD MEDKIT DOCTRINE',
    effectSummary: 'Start with 1 Coagulation Stitch in your Cargo Deck.',
  },
  ADRENALINE_PRIMER: {
    id: 'ADRENALINE_PRIMER',
    name: 'Adrenaline Primer',
    tier: 1,
    kind: 'STANDARD',
    tagline: 'COMBAT ENTRY STIM',
    effectSummary: '+1 Action Point on your first 3 turns in each of your first 3 Combat Nodes.',
  },
  REINFORCED_TRENCH_COAT: {
    id: 'REINFORCED_TRENCH_COAT',
    name: 'Reinforced Trench-Coat',
    tier: 1,
    kind: 'STANDARD',
    tagline: 'ARMOR WEAVE LINING',
    effectSummary: 'Start with +10% Maximum Health.',
  },
  SMUGGLERS_POCKETS: {
    id: 'SMUGGLERS_POCKETS',
    name: "Smuggler's Pockets",
    tier: 2,
    kind: 'STANDARD',
    tagline: 'HIDDEN COMPARTMENTS',
    effectSummary: '+2 unlocked Cargo Deck slots.',
    tradeoffSummary: 'Every node you scan generates +5% Resonance.',
  },
  CHALK_LINE_WARD: {
    id: 'CHALK_LINE_WARD',
    name: 'Chalk-Line Ward',
    tier: 2,
    kind: 'STANDARD',
    tagline: 'OCCULT SUPPRESSOR',
    effectSummary: 'First 3 Depths generate 0 Resonance from scans.',
  },
  BLOOD_PRICE: {
    id: 'BLOOD_PRICE',
    name: 'Blood Price',
    tier: 2,
    kind: 'STANDARD',
    tagline: 'CRIMSON PACT',
    effectSummary: 'Start with a random powerful Ley-Scar already active.',
    tradeoffSummary: 'Begin missing 25% of your Max Health.',
  },
  SCAVENGERS_MARK: {
    id: 'SCAVENGERS_MARK',
    name: "Scavenger's Mark",
    tier: 2,
    kind: 'STANDARD',
    tagline: 'BLACK MARKET FAVOR',
    effectSummary: 'First Black Market visit offers 50% off all listings.',
    tradeoffSummary: 'Start with Resonance already at 20%.',
  },
  WIRETAP_OVERRIDE: {
    id: 'WIRETAP_OVERRIDE',
    name: 'Wiretap Override',
    tier: 3,
    kind: 'STANDARD',
    tagline: 'SCANNER INTERCEPT',
    effectSummary: 'For the first 5 Depths, Combat Nodes reveal exact enemy types on scan.',
  },
  BRIBE_THE_FERRYMAN: {
    id: 'BRIBE_THE_FERRYMAN',
    name: 'Bribe the Ferryman',
    tier: 3,
    kind: 'STANDARD',
    tagline: 'EARLY EVAC CONDUIT',
    effectSummary: 'Guarantees an [ EVAC VECTOR ] at Depth 5.',
    tradeoffSummary: 'All Elite enemies hit 10% harder.',
  },
  DEAD_DROP_TRACKER: {
    id: 'DEAD_DROP_TRACKER',
    name: 'Dead-Drop Tracker',
    tier: 3,
    kind: 'STANDARD',
    tagline: 'RUNNER ECHO BEACON',
    effectSummary: 'Forces a [ RUNNER ECHO ] within the first 7 Depths.',
  },
  KINETIC_BATTERY: {
    id: 'KINETIC_BATTERY',
    name: 'Kinetic Battery',
    tier: 2,
    kind: 'STANDARD',
    tagline: 'DEFENSE CHARGE LATTICE',
    effectSummary: 'Defending boosts your next attack damage.',
  },
  HOLLOW_POINT_REQUISITION: {
    id: 'HOLLOW_POINT_REQUISITION',
    name: 'Hollow-Point Requisition',
    tier: 3,
    kind: 'STANDARD',
    tagline: 'KINETIC LOADOUT',
    effectSummary: '+15% damage to Frontline Corporeal enemies.',
    tradeoffSummary: '-10% damage to Backline Spectral enemies.',
  },
  VOID_TOUCHED_ARTIFACT: {
    id: 'VOID_TOUCHED_ARTIFACT',
    name: 'Void-Touched Artifact',
    tier: 4,
    kind: 'STANDARD',
    tagline: 'WEAPON BLUEPRINT SEED',
    effectSummary: 'Start with a high-tier Weapon Blueprint in cargo.',
    tradeoffSummary: '2 Cargo Deck slots are permanently locked this run.',
  },
  APEX_BAIT: {
    id: 'APEX_BAIT',
    name: 'Apex Bait',
    tier: 4,
    kind: 'STANDARD',
    tagline: 'ELITE MAGNET',
    effectSummary: 'Elite nodes drop double Credits and Cabal Tech.',
    tradeoffSummary: 'Start with 30% Resonance.',
  },
  MARTYRS_BARGAIN: {
    id: 'MARTYRS_BARGAIN',
    name: "Martyr's Bargain",
    tier: 4,
    kind: 'STANDARD',
    tagline: 'GRIM INSURANCE',
    effectSummary: 'On death, keep exactly 1 Cargo Deck item.',
    tradeoffSummary: 'Start with only 50% Max Health.',
  },
  IRONCLAD_LOGISTICS: {
    id: 'IRONCLAD_LOGISTICS',
    name: 'Ironclad Logistics',
    tier: 5,
    kind: 'CABAL_MANDATE',
    cabal: 'TERRAN_GRID',
    tagline: 'TERRAN GRID MANDATE',
    effectSummary: 'Fully expanded Cargo Deck + guaranteed [ EVAC VECTOR ] at Depth 10.',
    tradeoffSummary: 'Cannot acquire or equip Ley-Scars this run.',
  },
  SUNKEN_RITE: {
    id: 'SUNKEN_RITE',
    name: 'The Sunken Rite',
    tier: 5,
    kind: 'CABAL_MANDATE',
    cabal: 'SOLARIS',
    tagline: 'SOLARIS MANDATE',
    effectSummary: 'Two powerful Ley-Scars active + Resonance hazard immunity for 5 Depths.',
    tradeoffSummary: 'Maximum Health halved for the incursion.',
  },
  ENDLESS_MARCH: {
    id: 'ENDLESS_MARCH',
    name: 'The Endless March',
    tier: 5,
    kind: 'CABAL_MANDATE',
    cabal: 'LEGION',
    tagline: 'LEGION MANDATE',
    effectSummary: 'Heal 15% Max HP per Combat clear; +5% physical damage per clear.',
    tradeoffSummary: 'All [ EVAC VECTOR ] nodes locked — must reach Depth 15 Gatekeeper.',
  },
};

const ALL_STANDARD_IDS = Object.values(BOUND_REQUISITION_CATALOG)
  .filter((entry) => entry.kind === 'STANDARD')
  .map((entry) => entry.id);

function shuffleIds(ids: BoundRequisitionId[], rng: () => number): BoundRequisitionId[] {
  const pool = [...ids];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function mandateForFaction(faction: FactionType | null): BoundRequisitionDefinition | null {
  if (!faction) return null;
  return Object.values(BOUND_REQUISITION_CATALOG).find(
    (entry) => entry.kind === 'CABAL_MANDATE' && entry.cabal === faction,
  ) ?? null;
}

export function rollBoundRequisitionOffers(
  account: PlayerAccount,
  alignedFaction: FactionType | null,
  rng: () => number = Math.random,
): BoundRequisitionDefinition[] {
  const level = getBoundRequisitionLevel(account);
  const eligible = ALL_STANDARD_IDS.filter(
    (id) => BOUND_REQUISITION_CATALOG[id].tier <= level,
  );
  const picks = shuffleIds(eligible, rng).slice(0, 3).map((id) => BOUND_REQUISITION_CATALOG[id]);

  if (level === 5) {
    const mandate = mandateForFaction(alignedFaction);
    if (mandate) {
      const replaceIndex = Math.floor(rng() * 3);
      picks[replaceIndex] = mandate;
    }
  }

  return picks;
}

export function getBoundRequisitionDefinition(id: BoundRequisitionId): BoundRequisitionDefinition {
  return BOUND_REQUISITION_CATALOG[id];
}

export function tierLabel(tier: BoundRequisitionTier): string {
  return `TIER ${tier} // BOUND REQUISITION`;
}
