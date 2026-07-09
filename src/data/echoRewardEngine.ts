import type { EchoEliteTemplate, EchoTier, HostileEchoRewardProfileId } from '../types/echoElite';
import type { ResourceItemId } from '../types/resourceItem';
import { seededRandom } from './encounterGenerator';
import { getResourceDisplayName } from './resourceRegistry';

export interface HostileEchoRewardContext {
  depthIndex: 1 | 2 | 3;
  tier: EchoTier;
  isEchoRecoveryOp: boolean;
  seed: string;
}

export interface HostileEchoRewardRoll {
  resources: Array<{ resourceId: ResourceItemId; quantity: number }>;
  credits: number;
  operationProgress: number;
  logLines: string[];
  echoGlassTotal: number;
}

interface RewardProfile {
  guaranteed: ResourceItemId[];
  bonusRolls: Array<{ resourceId: ResourceItemId; chance: number }>;
  creditRange: [number, number];
  legendaryCreditBonus: number;
  legendaryExtraGlass: number;
}

const REWARD_PROFILES: Record<HostileEchoRewardProfileId, RewardProfile> = {
  AEGIS_ECHO: {
    guaranteed: ['echo-glass-shard'],
    bonusRolls: [
      { resourceId: 'ley-slag', chance: 0.4 },
      { resourceId: 'tarnished-dog-tags', chance: 0.15 },
    ],
    creditRange: [10, 28],
    legendaryCreditBonus: 15,
    legendaryExtraGlass: 1,
  },
  HEX_SHOT_ECHO: {
    guaranteed: ['echo-glass-shard'],
    bonusRolls: [
      { resourceId: 'tarnished-dog-tags', chance: 0.3 },
      { resourceId: 'encrypted-grid-drive', chance: 0.12 },
    ],
    creditRange: [18, 42],
    legendaryCreditBonus: 20,
    legendaryExtraGlass: 1,
  },
  ENVOY_ECHO: {
    guaranteed: ['echo-glass-shard'],
    bonusRolls: [
      { resourceId: 'sanguine-ampoule', chance: 0.3 },
      { resourceId: 'ossified-ley-knot', chance: 0.08 },
    ],
    creditRange: [8, 22],
    legendaryCreditBonus: 12,
    legendaryExtraGlass: 1,
  },
};

export const HOSTILE_ECHO_REWARD_PROFILE_IDS = Object.keys(REWARD_PROFILES) as HostileEchoRewardProfileId[];

const GENERIC_ECHO_PROFILE: RewardProfile = {
  guaranteed: ['echo-glass-shard'],
  bonusRolls: [
    { resourceId: 'tarnished-dog-tags', chance: 0.2 },
    { resourceId: 'ley-slag', chance: 0.25 },
  ],
  creditRange: [12, 30],
  legendaryCreditBonus: 18,
  legendaryExtraGlass: 1,
};

function resolveProfile(template: EchoEliteTemplate): RewardProfile {
  if (template.rewardProfileId) {
    return REWARD_PROFILES[template.rewardProfileId];
  }
  return GENERIC_ECHO_PROFILE;
}

/** Every resource id an echo reward profile can grant — for validation. */
export const HOSTILE_ECHO_REWARD_RESOURCE_IDS: readonly ResourceItemId[] = Array.from(
  new Set<ResourceItemId>([
    ...Object.values(REWARD_PROFILES).flatMap((profile) => [
      ...profile.guaranteed,
      ...profile.bonusRolls.map((roll) => roll.resourceId),
    ]),
    ...GENERIC_ECHO_PROFILE.guaranteed,
    ...GENERIC_ECHO_PROFILE.bonusRolls.map((roll) => roll.resourceId),
  ]),
);

export function rollHostileEchoRewards(
  template: EchoEliteTemplate,
  ctx: HostileEchoRewardContext,
): HostileEchoRewardRoll {
  const profile = resolveProfile(template);
  const rand = seededRandom(`${ctx.seed}:${template.id}:${ctx.depthIndex}`);
  const resources: Array<{ resourceId: ResourceItemId; quantity: number }> = [];
  const logLines: string[] = ['>> HOSTILE ECHO SALVAGE — residue catalogued.'];

  profile.guaranteed.forEach((resourceId) => {
    resources.push({ resourceId, quantity: 1 });
  });

  if (ctx.tier === 'LEGENDARY') {
    for (let i = 0; i < profile.legendaryExtraGlass; i += 1) {
      resources.push({ resourceId: 'echo-glass-shard', quantity: 1 });
    }
    logLines.push('>> CORRUPTED ECHO — additional echo-glass recovered.');
  }

  profile.bonusRolls.forEach((roll) => {
    const depthBoost = ctx.depthIndex >= 3 ? 1.15 : 1;
    if (rand() < roll.chance * depthBoost) {
      resources.push({ resourceId: roll.resourceId, quantity: 1 });
    }
  });

  if (ctx.isEchoRecoveryOp && rand() < 0.35) {
    resources.push({ resourceId: 'echo-glass-shard', quantity: 1 });
    logLines.push('>> ECHO RECOVERY BONUS — extra shard secured.');
  }

  const creditMin = profile.creditRange[0];
  const creditMax = profile.creditRange[1] + (ctx.tier === 'LEGENDARY' ? profile.legendaryCreditBonus : 0);
  const credits = creditMin + Math.floor(rand() * (creditMax - creditMin + 1));

  const grouped = resources.reduce<Partial<Record<ResourceItemId, number>>>((acc, entry) => {
    acc[entry.resourceId] = (acc[entry.resourceId] ?? 0) + entry.quantity;
    return acc;
  }, {});

  (Object.keys(grouped) as ResourceItemId[]).forEach((resourceId) => {
    const quantity = grouped[resourceId] ?? 0;
    logLines.push(
      `>> +${quantity}× ${getResourceDisplayName(resourceId, true).toUpperCase()}`,
    );
  });
  if (credits > 0) {
    logLines.push(`>> +${credits} RUN CREDITS — echo imprint bounty.`);
  }

  const echoGlassTotal = grouped['echo-glass-shard'] ?? 0;

  const operationProgress = ctx.isEchoRecoveryOp
    ? (ctx.tier === 'LEGENDARY' ? 4 : 3)
    : 0;

  return {
    resources: (Object.keys(grouped) as ResourceItemId[]).map((resourceId) => ({
      resourceId,
      quantity: grouped[resourceId] ?? 0,
    })),
    credits,
    operationProgress,
    logLines,
    echoGlassTotal,
  };
}
