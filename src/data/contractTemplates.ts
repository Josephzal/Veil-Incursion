import type {
  ContractObjectiveKind,
  ContractRewardPackage,
  GeneratedContract,
} from '../types/contract';
import type { ResourceItemId } from '../types/resourceItem';
import type { CabalEmployerId, SectorId } from '../types/worldState';

export interface ContractTemplateSpec {
  kind: ContractObjectiveKind;
  /** Weight when rolling for a sponsor. */
  weight: number;
  sponsors: readonly CabalEmployerId[];
  titlePrefix: string;
  buildObjectiveText: (ctx: ContractTemplateContext) => string;
  pickResources?: (ctx: ContractTemplateContext) => {
    targetResourceId?: ResourceItemId;
    targetResourceOptions?: ResourceItemId[];
    targetQuantity: number;
  };
  requiredDepth?: 1 | 2 | 3;
  requiresEmergencyRecall?: boolean;
  requiredEliteKills?: number;
  requiredOperationTargets?: number;
  difficultyBase: 1 | 2 | 3 | 4 | 5;
  rewardFor: (sponsorId: CabalEmployerId, difficulty: number) => ContractRewardPackage;
}

export interface ContractTemplateContext {
  sponsorId: CabalEmployerId;
  seed: string;
  rng: () => number;
}

const STABLE_RESOURCES: ResourceItemId[] = [
  'ley-slag',
  'sanguine-ampoule',
  'echo-glass-shard',
  'combustion-cylinder',
  'nullcrete-shard',
  'cinder-wire',
  'mycelial-ichor',
  'rail-capacitor',
];

const SPONSOR_RESOURCE_BY_CABAL: Record<CabalEmployerId, ResourceItemId[]> = {
  TERRAN_GRID: ['encrypted-grid-drive', 'containment-seal', 'rail-capacitor', 'ley-slag', 'echo-glass-shard'],
  LEGION: ['legion-blood-iron', 'rail-capacitor', 'combustion-cylinder', 'cinder-wire', 'ley-slag'],
  SOLARIS: ['sanguine-ampoule', 'mycelial-ichor', 'resonant-filament', 'veil-ash-canister', 'ossified-ley-knot'],
};

const SCANNER_INTEL: ResourceItemId[] = ['encrypted-grid-drive', 'containment-seal'];
const ECONOMY_INTEL: ResourceItemId[] = ['smugglers-ledger', 'tarnished-dog-tags'];
const UNSTABLE_CARGO: ResourceItemId[] = [
  'veil-ash-canister',
  'ossified-ley-knot',
  'anchor-marrow',
  'breach-thread',
  'anomalous-core',
];
const CONTRABAND: ResourceItemId[] = ['sealed-containment-casket', 'blacksite-specimen-jar'];

function pickOne<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)]!;
}

function rewardBase(sponsorId: CabalEmployerId, credits: number, reputation: number): ContractRewardPackage {
  switch (sponsorId) {
    case 'TERRAN_GRID':
      return { credits, reputation, rareLootBonusPct: 0 };
    case 'LEGION':
      return { credits: Math.round(credits * 0.9), reputation, rareLootBonusPct: 5 };
    case 'SOLARIS':
      return { credits: Math.round(credits * 1.1), reputation: reputation + 1, rareLootBonusPct: 8 };
    default:
      return { credits, reputation };
  }
}

export const CONTRACT_TEMPLATE_SPECS: ContractTemplateSpec[] = [
  {
    kind: 'EXTRACT_STABLE_RESOURCE',
    weight: 3,
    sponsors: ['TERRAN_GRID', 'LEGION', 'SOLARIS'],
    titlePrefix: 'Stable Extraction',
    buildObjectiveText: (ctx) => {
      const res = pickOne(STABLE_RESOURCES, ctx.rng);
      const qty = 3 + Math.floor(ctx.rng() * 3);
      return `Extract ${qty} ${res.replace(/-/g, ' ')} from any sector.`;
    },
    pickResources: (ctx) => ({
      targetResourceId: pickOne(STABLE_RESOURCES, ctx.rng),
      targetQuantity: 3 + Math.floor(ctx.rng() * 3),
    }),
    difficultyBase: 2,
    rewardFor: (s, d) => rewardBase(s, 80 + d * 20, 2),
  },
  {
    kind: 'EXTRACT_SPONSOR_RESOURCE',
    weight: 3,
    sponsors: ['TERRAN_GRID', 'LEGION', 'SOLARIS'],
    titlePrefix: 'Sponsor Requisition',
    buildObjectiveText: (ctx) => {
      const pool = SPONSOR_RESOURCE_BY_CABAL[ctx.sponsorId];
      const res = pickOne(pool, ctx.rng);
      return `Extract 1 ${res.replace(/-/g, ' ')} from a recommended sector.`;
    },
    pickResources: (ctx) => ({
      targetResourceId: pickOne(SPONSOR_RESOURCE_BY_CABAL[ctx.sponsorId], ctx.rng),
      targetQuantity: 1,
    }),
    difficultyBase: 3,
    rewardFor: (s, d) => rewardBase(s, 120 + d * 25, 3),
  },
  {
    kind: 'RECOVER_INTEL',
    weight: 4,
    sponsors: ['TERRAN_GRID'],
    titlePrefix: 'Grid Evidence',
    buildObjectiveText: () => 'Extract 1 Encrypted Grid-Drive.',
    pickResources: () => ({ targetResourceId: 'encrypted-grid-drive', targetQuantity: 1 }),
    difficultyBase: 3,
    rewardFor: (s, d) => ({ ...rewardBase(s, 150 + d * 30, 4), resourceBonusIds: ['encrypted-grid-drive'] }),
  },
  {
    kind: 'RECOVER_ECONOMY_INTEL',
    weight: 3,
    sponsors: ['TERRAN_GRID'],
    titlePrefix: 'Ledger Sweep',
    buildObjectiveText: (ctx) => (ctx.rng() < 0.5
      ? 'Extract The Smuggler\'s Ledger.'
      : 'Extract 3 Tarnished Dog Tags.'),
    pickResources: (ctx) => (ctx.rng() < 0.5
      ? { targetResourceId: 'smugglers-ledger', targetQuantity: 1 }
      : { targetResourceId: 'tarnished-dog-tags', targetQuantity: 3 }),
    difficultyBase: 2,
    rewardFor: (s, d) => rewardBase(s, 140 + d * 25, 3),
  },
  {
    kind: 'EXTRACT_UNSTABLE_CARGO',
    weight: 4,
    sponsors: ['SOLARIS', 'LEGION'],
    titlePrefix: 'Volatile Harvest',
    buildObjectiveText: (ctx) => {
      const a = pickOne(UNSTABLE_CARGO.filter((id) => id !== 'anomalous-core'), ctx.rng);
      const b = pickOne(UNSTABLE_CARGO.filter((id) => id !== 'anomalous-core' && id !== a), ctx.rng);
      return `Extract 1 ${a.replace(/-/g, ' ')} or 1 ${b.replace(/-/g, ' ')}.`;
    },
    pickResources: (ctx) => {
      const pool = UNSTABLE_CARGO.filter((id) => id !== 'anomalous-core');
      const a = pickOne(pool, ctx.rng);
      const b = pickOne(pool.filter((id) => id !== a), ctx.rng);
      return { targetResourceOptions: [a, b], targetQuantity: 1 };
    },
    requiredDepth: 2,
    difficultyBase: 4,
    rewardFor: (s, d) => rewardBase(s, 160 + d * 30, 4),
  },
  {
    kind: 'RECOVER_APEX_CARGO',
    weight: 1,
    sponsors: ['SOLARIS'],
    titlePrefix: 'Core Mandate',
    buildObjectiveText: () => 'Extract 1 Anomalous Core.',
    pickResources: () => ({ targetResourceId: 'anomalous-core', targetQuantity: 1 }),
    requiredDepth: 3,
    difficultyBase: 5,
    rewardFor: (s, d) => rewardBase(s, 250 + d * 40, 6),
  },
  {
    kind: 'RECOVER_CONTRABAND',
    weight: 2,
    sponsors: ['TERRAN_GRID', 'SOLARIS'],
    titlePrefix: 'Casket Recovery',
    buildObjectiveText: (ctx) => {
      const res = pickOne(CONTRABAND, ctx.rng);
      return res === 'blacksite-specimen-jar'
        ? 'Extract 1 Blacksite Specimen Jar.'
        : 'Extract 1 Sealed Containment Casket.';
    },
    pickResources: (ctx) => ({
      targetResourceId: pickOne(CONTRABAND, ctx.rng),
      targetQuantity: 1,
    }),
    difficultyBase: 4,
    rewardFor: (s, d) => rewardBase(s, 180 + d * 35, 4),
  },
  {
    kind: 'DEFEAT_ELITE',
    weight: 3,
    sponsors: ['LEGION', 'SOLARIS'],
    titlePrefix: 'Elite Suppression',
    buildObjectiveText: (ctx) => {
      const count = 1 + Math.floor(ctx.rng() * 2);
      return `Defeat ${count} elite encounter${count > 1 ? 's' : ''} before extracting.`;
    },
    requiredEliteKills: 2,
    difficultyBase: 3,
    rewardFor: (s, d) => rewardBase(s, 100 + d * 20, 3),
  },
  {
    kind: 'COMPLETE_EMERGENCY_RECALL',
    weight: 4,
    sponsors: ['LEGION'],
    titlePrefix: 'No Clean Exit',
    buildObjectiveText: () => 'Successfully complete an Emergency Recall extraction.',
    requiresEmergencyRecall: true,
    difficultyBase: 3,
    rewardFor: (s, d) => ({ ...rewardBase(s, 110 + d * 25, 3), rareLootBonusPct: 8 }),
  },
  {
    kind: 'DEFEAT_DEPTH_BOSS',
    weight: 3,
    sponsors: ['LEGION', 'SOLARIS'],
    titlePrefix: 'Depth Boss Suppression',
    buildObjectiveText: () => 'Defeat a depth boss before extracting.',
    requiredDepth: 1,
    difficultyBase: 4,
    rewardFor: (s, d) => rewardBase(s, 140 + d * 30, 4),
  },
  {
    kind: 'REACH_DEPTH_AND_EXTRACT',
    weight: 2,
    sponsors: ['TERRAN_GRID', 'LEGION', 'SOLARIS'],
    titlePrefix: 'Deep Breach',
    buildObjectiveText: (ctx) => {
      const depth = ctx.rng() < 0.6 ? 2 : 3;
      return `Reach Depth ${depth} and extract alive.`;
    },
    requiredDepth: 2,
    difficultyBase: 3,
    rewardFor: (s, d) => rewardBase(s, 90 + d * 20, 2),
  },
  {
    kind: 'CLEAR_OPERATION_TARGET',
    weight: 2,
    sponsors: ['TERRAN_GRID', 'SOLARIS'],
    titlePrefix: 'Signal Sweep',
    buildObjectiveText: () => 'Clear 1 Operation Target or Anchor Signal node before extracting.',
    requiredOperationTargets: 1,
    difficultyBase: 3,
    rewardFor: (s, d) => rewardBase(s, 120 + d * 25, 3),
  },
];

export const SPONSOR_CONTRACT_QUOTAS: Record<CabalEmployerId, number> = {
  TERRAN_GRID: 2,
  LEGION: 2,
  SOLARIS: 2,
};

export const RECOMMENDED_SECTORS_BY_RESOURCE: Partial<Record<ResourceItemId, SectorId[]>> = {
  'ley-slag': ['THE_SLAG_WORKS', 'THE_BLACKLINE_TERMINUS'],
  'legion-blood-iron': ['THE_SLAG_WORKS', 'THE_BLACKLINE_TERMINUS'],
  'encrypted-grid-drive': ['THE_NULL_ZONE', 'THE_BLACKLINE_TERMINUS'],
  'smugglers-ledger': ['THE_NULL_ZONE', 'THE_SLAG_WORKS'],
  'tarnished-dog-tags': ['THE_NULL_ZONE', 'THE_SLAG_WORKS'],
  'veil-ash-canister': ['THE_ASHEN_WASTES', 'THE_ABYSSAL_SINK', 'THE_BLACKLINE_TERMINUS'],
  'ossified-ley-knot': ['THE_ASHEN_WASTES', 'THE_ABYSSAL_SINK'],
  'anomalous-core': ['THE_ASHEN_WASTES', 'THE_ABYSSAL_SINK'],
  'sealed-containment-casket': ['THE_NULL_ZONE', 'THE_BLACKLINE_TERMINUS'],
  'sanguine-ampoule': ['THE_ASHEN_WASTES', 'THE_ABYSSAL_SINK'],
  'echo-glass-shard': ['THE_NULL_ZONE', 'THE_SLAG_WORKS'],
  'combustion-cylinder': ['THE_SLAG_WORKS', 'THE_BLACKLINE_TERMINUS'],
  'nullcrete-shard': ['THE_NULL_ZONE'],
  'mycelial-ichor': ['THE_ABYSSAL_SINK'],
  'cinder-wire': ['THE_ASHEN_WASTES'],
  'rail-capacitor': ['THE_SLAG_WORKS'],
  'containment-seal': ['THE_BLACKLINE_TERMINUS'],
  'resonant-filament': ['THE_NULL_ZONE', 'THE_ABYSSAL_SINK', 'THE_ASHEN_WASTES', 'THE_BLACKLINE_TERMINUS'],
  'anchor-marrow': ['THE_SLAG_WORKS', 'THE_ABYSSAL_SINK', 'THE_ASHEN_WASTES', 'THE_NULL_ZONE', 'THE_BLACKLINE_TERMINUS'],
  'breach-thread': ['THE_SLAG_WORKS', 'THE_ABYSSAL_SINK', 'THE_ASHEN_WASTES', 'THE_NULL_ZONE', 'THE_BLACKLINE_TERMINUS'],
  'blacksite-specimen-jar': ['THE_BLACKLINE_TERMINUS', 'THE_ABYSSAL_SINK'],
};

export function buildContractTitle(spec: ContractTemplateSpec, ctx: ContractTemplateContext): string {
  const titles: Record<CabalEmployerId, Record<string, string>> = {
    TERRAN_GRID: {
      RECOVER_INTEL: 'Recover Grid Evidence',
      RECOVER_ECONOMY_INTEL: 'Ledger Sweep',
      RECOVER_CONTRABAND: 'Containment Recovery',
      CLEAR_OPERATION_TARGET: 'Grid Signal Sweep',
    },
    LEGION: {
      EXTRACT_SPONSOR_RESOURCE: 'Blood-Iron Requisition',
      COMPLETE_EMERGENCY_RECALL: 'No Clean Exit',
      DEFEAT_DEPTH_BOSS: 'Boss Breaker',
      DEFEAT_ELITE: 'Elite Cull',
    },
    SOLARIS: {
      EXTRACT_UNSTABLE_CARGO: 'Volatile Harvest',
      RECOVER_APEX_CARGO: 'Core Mandate',
      EXTRACT_SPONSOR_RESOURCE: 'Occult Requisition',
    },
  };
  return titles[ctx.sponsorId]?.[spec.kind] ?? spec.titlePrefix;
}
