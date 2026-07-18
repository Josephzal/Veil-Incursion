import type {
  BreachGradePacketQuality,
  ExtractedYieldBand,
  ResourceRewardPacket,
  ResourceRewardPacketRollResult,
  ResourceRewardPacketType,
  ResourceRewardRarityBias,
  RewardNodeKind,
} from '../types/resourceRewardPacket';
import type { ResourceDepthIndex, ResourceItemId } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';
import type { BreachGradeId } from '../types/progression';
import type { VeilBiome } from '../types/encounterSpawn';
import type { RunRewardBias } from '../types/runWorldBrief';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import {
  ECONOMY_V1_CONTRABAND_IDS,
  ECONOMY_V1_INTEL_IDS,
  ECONOMY_V1_STABLE_IDS,
  ECONOMY_V1_UNSTABLE_IDS,
} from './economyRosterV1';
import { ECONOMY_TUNING_THRESHOLDS } from './balance/economyBalanceConfig';
import {
  filterResourcesForDepth,
  pickWeightedForDepth,
} from './depthResourceRulesEngine';
import {
  getSectorResourceTableByBiome,
  sectorFarmingPool,
  sectorPrimaryResourcePool,
  sectorRareResourcePool,
} from './sectorResourceTableEngine';
import { veilBiomeToSectorId } from './sectorBiomeBridge';
import { getDistrictFromDepth } from './districtPacing';
import { applyBriefResourceStressToPool } from './runWorldBriefBiasEngine';

/**
 * Phase 2F — reward packets + extracted yield targets.
 * Higher Breach Grades add better packet kinds/chances, not bigger piles.
 */

const COMMON_STABLE_CORE: readonly ResourceItemId[] = [
  'ley-slag',
  'echo-glass-shard',
  'nullcrete-shard',
  'cinder-wire',
  'combustion-cylinder',
  'sanguine-ampoule',
  'mycelial-ichor',
];

const ECHO_PACKET_POOL: readonly ResourceItemId[] = [
  'echo-glass-shard',
  'resonant-filament',
  'tarnished-dog-tags',
  'encrypted-grid-drive',
];

function packet(
  packetType: ResourceRewardPacketType,
  rolls: number,
  opts: Partial<Omit<ResourceRewardPacket, 'packetType' | 'rolls'>> & {
    rarityBias?: ResourceRewardRarityBias;
    minDepth?: ResourceDepthIndex;
  } = {},
): ResourceRewardPacket {
  return {
    packetType,
    rolls,
    rarityBias: opts.rarityBias ?? 'COMMON',
    sectorBias: opts.sectorBias ?? null,
    allowUnstable: opts.allowUnstable ?? false,
    allowContraband: opts.allowContraband ?? false,
    minDepth: opts.minDepth ?? 1,
    fireChance: opts.fireChance,
    note: opts.note,
  };
}

/** Base node recipes by district depth — grade bonuses applied separately. */
export function buildBaseNodeRewardPackets(
  nodeKind: RewardNodeKind,
  districtDepth: ResourceDepthIndex,
  sectorId?: SectorId | null,
): ResourceRewardPacket[] {
  const sectorBias = sectorId ?? null;

  switch (nodeKind) {
    case 'NORMAL_COMBAT':
      if (districtDepth === 1) {
        // Phase 2M — Threshold combat must teach sector identity (SECTOR packet), not only staples.
        return [
          packet('STABLE', 1, {
            fireChance: ECONOMY_TUNING_THRESHOLDS.d1StablePacketFireChance,
            rarityBias: 'COMMON',
            minDepth: 1,
          }),
          packet('SECTOR', 1, {
            fireChance: ECONOMY_TUNING_THRESHOLDS.d1SectorPacketFireChance,
            rarityBias: 'COMMON',
            sectorBias,
            minDepth: 1,
          }),
          packet('RARE', 1, { fireChance: 0.05, rarityBias: 'RARE', minDepth: 1 }),
        ];
      }
      if (districtDepth === 2) {
        return [
          packet('STABLE', 1, { rarityBias: 'COMMON', minDepth: 1 }),
          packet('SECTOR', 1, {
            fireChance: 0.45,
            rarityBias: 'UNCOMMON',
            sectorBias,
            minDepth: 1,
          }),
          packet('RARE', 1, { fireChance: 0.14, rarityBias: 'RARE', minDepth: 2 }),
        ];
      }
      return [
        packet('STABLE', 1, { rarityBias: 'COMMON', minDepth: 1 }),
        packet('STABLE', 1, { fireChance: 0.55, rarityBias: 'COMMON', minDepth: 1 }),
        packet('SECTOR', 1, {
          fireChance: 0.55,
          rarityBias: 'UNCOMMON',
          sectorBias,
          minDepth: 1,
        }),
        packet('RARE', 1, { fireChance: 0.22, rarityBias: 'RARE', minDepth: 2 }),
      ];

    case 'ELITE_COMBAT':
      if (districtDepth === 1) {
        return [
          packet('STABLE', 1, { rarityBias: 'COMMON', minDepth: 1 }),
          packet('SECTOR', 1, {
            fireChance: 0.55,
            rarityBias: 'UNCOMMON',
            sectorBias,
            minDepth: 1,
          }),
          packet('RARE', 1, { fireChance: 0.22, rarityBias: 'RARE', minDepth: 1 }),
        ];
      }
      if (districtDepth === 2) {
        return [
          packet('STABLE', 1, { rarityBias: 'COMMON', minDepth: 1 }),
          packet('SECTOR', 1, { rarityBias: 'UNCOMMON', sectorBias, minDepth: 1 }),
          packet('RARE', 1, { fireChance: 0.45, rarityBias: 'RARE', minDepth: 2 }),
          packet('UNSTABLE', 1, {
            fireChance: 0.12,
            rarityBias: 'RARE',
            allowUnstable: true,
            minDepth: 2,
          }),
        ];
      }
      return [
        packet('STABLE', 2, { rarityBias: 'COMMON', minDepth: 1 }),
        packet('SECTOR', 1, { rarityBias: 'UNCOMMON', sectorBias, minDepth: 1 }),
        packet('RARE', 1, { fireChance: 0.55, rarityBias: 'RARE', minDepth: 2 }),
        packet('UNSTABLE', 1, {
          fireChance: 0.28,
          rarityBias: 'RARE',
          allowUnstable: true,
          minDepth: 2,
        }),
      ];

    case 'RESOURCE_ANOMALY':
      if (districtDepth === 1) {
        return [
          packet('SECTOR_STABLE', 2, { rarityBias: 'COMMON', sectorBias, minDepth: 1 }),
          packet('STABLE', 1, { fireChance: 0.55, rarityBias: 'COMMON', minDepth: 1 }),
        ];
      }
      if (districtDepth === 2) {
        return [
          packet('SECTOR_STABLE', 3, { rarityBias: 'COMMON', sectorBias, minDepth: 1 }),
          packet('RARE', 1, { fireChance: 0.28, rarityBias: 'RARE', minDepth: 2 }),
          packet('UNSTABLE', 1, {
            fireChance: 0.14,
            rarityBias: 'RARE',
            allowUnstable: true,
            minDepth: 2,
          }),
        ];
      }
      return [
        packet('SECTOR_STABLE', 4, { rarityBias: 'COMMON', sectorBias, minDepth: 1 }),
        packet('RARE', 1, { fireChance: 0.4, rarityBias: 'RARE', minDepth: 2 }),
        packet('UNSTABLE', 1, {
          fireChance: 0.22,
          rarityBias: 'RARE',
          allowUnstable: true,
          minDepth: 2,
        }),
        packet('CONTRABAND', 1, {
          fireChance: 0.12,
          rarityBias: 'APEX',
          allowContraband: true,
          minDepth: 3,
        }),
      ];

    case 'ANCHOR_SIGNAL':
      return [
        packet('SECTOR', 1, { rarityBias: 'UNCOMMON', sectorBias, minDepth: 1 }),
        packet('ANCHOR', 1, {
          fireChance: districtDepth >= 2 ? 0.55 : 0.18,
          rarityBias: 'RARE',
          allowUnstable: true,
          minDepth: districtDepth >= 2 ? 2 : 1,
          note: 'Anchor Marrow chance on Anchor contexts',
        }),
        packet('OPERATION', 1, {
          fireChance: 0.35,
          rarityBias: 'UNCOMMON',
          minDepth: 1,
          note: 'Operation-aligned salvage when targets exist',
        }),
      ];

    case 'ECHO_SIGNAL':
      return [
        packet('ECHO', 2, { rarityBias: 'UNCOMMON', minDepth: 1 }),
        packet('INTEL', 1, {
          fireChance: districtDepth >= 2 ? 0.35 : 0.12,
          rarityBias: 'RARE',
          minDepth: 1,
          note: 'Rare Grid-Drive / intel peek',
        }),
      ];

    case 'BOSS':
      return [
        packet('SECTOR', 2, { rarityBias: 'UNCOMMON', sectorBias, minDepth: 1 }),
        packet('RARE', 1, { rarityBias: 'RARE', minDepth: 1 }),
        packet('INTEL', 1, {
          fireChance: 0.65,
          rarityBias: 'RARE',
          minDepth: 1,
        }),
        ...(districtDepth >= 2
          ? [packet('UNSTABLE', 1, {
            fireChance: districtDepth >= 3 ? 0.4 : 0.22,
            rarityBias: 'RARE',
            allowUnstable: true,
            minDepth: 2,
          })]
          : []),
        ...(districtDepth >= 3
          ? [
            packet('CONTRABAND', 1, {
              fireChance: 0.22,
              rarityBias: 'APEX',
              allowContraband: true,
              minDepth: 3,
            }),
            packet('APEX', 1, {
              fireChance: 0.1,
              rarityBias: 'APEX',
              allowUnstable: true,
              minDepth: 3,
              note: 'Marked high-risk / apex only',
            }),
          ]
          : []),
      ];

    default:
      return [packet('STABLE', 1, { rarityBias: 'COMMON', minDepth: 1 })];
  }
}

/** Breach Grade improves packet quality/chances — not raw pile size. */
export const BREACH_GRADE_PACKET_QUALITY: Record<BreachGradeId, BreachGradePacketQuality> = {
  I: {
    grade: 'I',
    valueMultiplier: 1,
    sectorPacketBonusChance: 0,
    rarePacketBonusChance: 0,
    intelPacketBonusChance: 0,
    unstablePacketBonusChance: 0,
    contrabandPacketBonusChance: 0,
    summary: 'Baseline rewards — mostly common stable; rare uncommon; unstable rare.',
  },
  II: {
    grade: 'II',
    valueMultiplier: 1.12,
    sectorPacketBonusChance: 0.1,
    rarePacketBonusChance: 0.08,
    intelPacketBonusChance: 0.05,
    unstablePacketBonusChance: 0.04,
    contrabandPacketBonusChance: 0,
    summary: '+10–15% value intent; better sector chance; rare chance up.',
  },
  III: {
    grade: 'III',
    valueMultiplier: 1.28,
    sectorPacketBonusChance: 0.14,
    rarePacketBonusChance: 0.14,
    intelPacketBonusChance: 0.12,
    unstablePacketBonusChance: 0.1,
    contrabandPacketBonusChance: 0.04,
    summary: '+25–30% value intent; more rare/intel; unstable more common.',
  },
  IV: {
    grade: 'IV',
    valueMultiplier: 1.42,
    sectorPacketBonusChance: 0.18,
    rarePacketBonusChance: 0.18,
    intelPacketBonusChance: 0.14,
    unstablePacketBonusChance: 0.12,
    contrabandPacketBonusChance: 0.12,
    summary: '+40–45% value intent; contraband in more contexts; stronger Deep Veil tables.',
  },
  V: {
    grade: 'V',
    valueMultiplier: 1.5,
    sectorPacketBonusChance: 0.2,
    rarePacketBonusChance: 0.22,
    intelPacketBonusChance: 0.16,
    unstablePacketBonusChance: 0.14,
    contrabandPacketBonusChance: 0.14,
    summary: 'Prestige quality — best packets; not required for normal progression.',
  },
};

export const EXTRACTED_YIELD_TARGETS: readonly ExtractedYieldBand[] = [
  {
    id: 'EARLY_D1',
    label: 'Early Depth 1 extract',
    stable: [4, 8],
    intelRare: [0, 1],
    unstable: [0, 0],
    contrabandApex: [0, 0],
  },
  {
    id: 'FULL_D1_BOSS',
    label: 'Full Depth 1 boss extract',
    stable: [8, 14],
    intelRare: [1, 2],
    unstable: [0, 1],
    contrabandApex: [0, 0],
  },
  {
    id: 'D2_PARTIAL',
    label: 'Depth 2 partial extract',
    stable: [13, 22],
    intelRare: [2, 5],
    unstable: [0, 2],
    contrabandApex: [0, 1],
  },
  {
    id: 'D3_EXTRACT',
    label: 'Depth 3 extract',
    stable: [20, 32],
    intelRare: [5, 9],
    unstable: [1, 4],
    contrabandApex: [0, 1],
  },
  {
    id: 'FULL_DEEP_CLEAR',
    label: 'Full deep clear',
    stable: [25, 40],
    intelRare: [6, 10],
    unstable: [2, 4],
    contrabandApex: [1, 1],
  },
];

export interface NodeRewardPacketContext {
  nodeKind: RewardNodeKind;
  depth: number;
  districtDepth?: ResourceDepthIndex;
  veilBiome?: VeilBiome | null;
  sectorId?: SectorId | null;
  breachGrade?: BreachGradeId | null;
  isElite?: boolean;
  highRisk?: boolean;
  highValue?: boolean;
  echoSignal?: boolean;
  anchorSignal?: boolean;
  contractTargetIds?: readonly ResourceItemId[];
  operationTargetIds?: readonly ResourceItemId[];
  stressedResourceIds?: readonly ResourceItemId[];
  briefRewardBias?: RunRewardBias | null;
  /** Extra rare-loot pressure from modifiers (pct → small fireChance bump). */
  rareLootBonusPct?: number;
  rng: () => number;
}

function resolveSectorId(ctx: NodeRewardPacketContext): SectorId | null {
  if (ctx.sectorId) return ctx.sectorId;
  if (ctx.veilBiome) return veilBiomeToSectorId(ctx.veilBiome);
  return null;
}

function rarityWeight(id: ResourceItemId, bias: ResourceRewardRarityBias): number {
  const rarity = RESOURCE_REGISTRY[id].rarity;
  switch (bias) {
    case 'COMMON':
      return rarity === 'COMMON' ? 3 : rarity === 'UNCOMMON' ? 1.2 : 0.25;
    case 'UNCOMMON':
      return rarity === 'UNCOMMON' ? 3 : rarity === 'COMMON' ? 1.4 : rarity === 'RARE' ? 1.1 : 0.3;
    case 'RARE':
      return rarity === 'RARE' ? 3 : rarity === 'UNCOMMON' ? 1.4 : rarity === 'APEX' ? 0.8 : 0.5;
    case 'APEX':
      return rarity === 'APEX' ? 3 : rarity === 'RARE' ? 1.2 : 0.4;
    default:
      return 1;
  }
}

function pickFromBiasedPool(
  pool: readonly ResourceItemId[],
  depth: ResourceDepthIndex,
  bias: ResourceRewardRarityBias,
  rng: () => number,
): ResourceItemId | null {
  if (pool.length === 0) return null;
  let total = 0;
  const weights = pool.map((id) => {
    const w = rarityWeight(id, bias) * (RESOURCE_REGISTRY[id].depthRules.preferredDepths.includes(depth) ? 1.35 : 1);
    total += w;
    return w;
  });
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

function depthOptsFromCtx(ctx: NodeRewardPacketContext) {
  return {
    isElite: ctx.isElite || ctx.nodeKind === 'ELITE_COMBAT' || ctx.nodeKind === 'BOSS',
    highRisk: Boolean(
      ctx.highRisk
      || ctx.highValue
      || ctx.nodeKind === 'BOSS',
    ),
  };
}

function buildPacketPool(
  pkt: ResourceRewardPacket,
  ctx: NodeRewardPacketContext,
  sectorId: SectorId | null,
): ResourceItemId[] {
  const depth = (ctx.districtDepth ?? getDistrictFromDepth(ctx.depth)) as ResourceDepthIndex;
  const opts = depthOptsFromCtx(ctx);
  const sector = pkt.sectorBias ?? sectorId;

  let pool: ResourceItemId[] = [];
  switch (pkt.packetType) {
    case 'STABLE':
      pool = [...COMMON_STABLE_CORE, ...ECONOMY_V1_STABLE_IDS.filter((id) => (
        RESOURCE_REGISTRY[id].rarity === 'COMMON' || RESOURCE_REGISTRY[id].rarity === 'UNCOMMON'
      ))];
      break;
    case 'SECTOR':
    case 'SECTOR_STABLE':
      if (sector) {
        pool = pkt.packetType === 'SECTOR_STABLE'
          ? [
            ...sectorPrimaryResourcePool(sector).filter((id) => RESOURCE_REGISTRY[id].category === 'STABLE'),
            ...COMMON_STABLE_CORE,
          ]
          : [...sectorPrimaryResourcePool(sector), ...sectorFarmingPool(sector)];
      } else {
        pool = [...COMMON_STABLE_CORE];
      }
      break;
    case 'INTEL':
      pool = [...ECONOMY_V1_INTEL_IDS];
      break;
    case 'RARE':
      pool = sector
        ? [...sectorRareResourcePool(sector)]
        : [
          ...ECONOMY_V1_STABLE_IDS.filter((id) => (
            RESOURCE_REGISTRY[id].rarity === 'RARE' || RESOURCE_REGISTRY[id].rarity === 'UNCOMMON'
          )),
          ...ECONOMY_V1_INTEL_IDS,
        ];
      break;
    case 'UNSTABLE':
      pool = [...ECONOMY_V1_UNSTABLE_IDS.filter((id) => id !== 'anomalous-core')];
      break;
    case 'CONTRABAND':
      pool = [...ECONOMY_V1_CONTRABAND_IDS];
      break;
    case 'CONTRACT':
      pool = [...(ctx.contractTargetIds ?? [])];
      if (pool.length === 0) pool = [...COMMON_STABLE_CORE];
      break;
    case 'OPERATION':
      pool = [...(ctx.operationTargetIds ?? [])];
      if (pool.length === 0 && sector) pool = sectorPrimaryResourcePool(sector);
      if (pool.length === 0) pool = [...COMMON_STABLE_CORE];
      break;
    case 'ECHO':
      pool = [...ECHO_PACKET_POOL];
      break;
    case 'ANCHOR':
      pool = depth >= 2 || opts.isElite
        ? ['anchor-marrow', 'ley-slag', ...(sector ? sectorPrimaryResourcePool(sector).slice(0, 2) : [])]
        : ['ley-slag', ...(sector ? sectorPrimaryResourcePool(sector).slice(0, 2) : [])];
      break;
    case 'APEX':
      pool = ['anomalous-core'];
      break;
    default:
      pool = [...COMMON_STABLE_CORE];
  }

  // Packet flags can further restrict categories.
  pool = pool.filter((id) => {
    const cat = RESOURCE_REGISTRY[id].category;
    if (!pkt.allowUnstable && cat === 'UNSTABLE') return false;
    if (!pkt.allowContraband && cat === 'CONTRABAND') return false;
    if (pkt.packetType === 'APEX') return id === 'anomalous-core';
    return true;
  });

  let eligible = filterResourcesForDepth(pool, depth, opts);
  if (ctx.stressedResourceIds?.length) {
    eligible = applyBriefResourceStressToPool(
      eligible,
      {
        resourceStress: {
          primaryResourceIds: [...ctx.stressedResourceIds],
          highDemandResourceIds: [...ctx.stressedResourceIds],
        },
      },
    );
  }
  return eligible;
}

export function applyBreachGradePacketBonuses(
  packets: ResourceRewardPacket[],
  grade: BreachGradeId,
  districtDepth: ResourceDepthIndex,
  sectorId?: SectorId | null,
): ResourceRewardPacket[] {
  const quality = BREACH_GRADE_PACKET_QUALITY[grade] ?? BREACH_GRADE_PACKET_QUALITY.I;
  const extras: ResourceRewardPacket[] = [];

  if (quality.sectorPacketBonusChance > 0) {
    extras.push(packet('SECTOR', 1, {
      fireChance: quality.sectorPacketBonusChance,
      rarityBias: 'UNCOMMON',
      sectorBias: sectorId ?? null,
      minDepth: 1,
      note: `Grade ${grade} sector quality bonus`,
    }));
  }
  if (quality.rarePacketBonusChance > 0) {
    extras.push(packet('RARE', 1, {
      fireChance: quality.rarePacketBonusChance,
      rarityBias: 'RARE',
      minDepth: districtDepth >= 2 ? 2 : 1,
      note: `Grade ${grade} rare quality bonus`,
    }));
  }
  if (quality.intelPacketBonusChance > 0) {
    extras.push(packet('INTEL', 1, {
      fireChance: quality.intelPacketBonusChance,
      rarityBias: 'RARE',
      minDepth: 1,
      note: `Grade ${grade} intel quality bonus`,
    }));
  }
  if (quality.unstablePacketBonusChance > 0 && districtDepth >= 2) {
    extras.push(packet('UNSTABLE', 1, {
      fireChance: quality.unstablePacketBonusChance,
      rarityBias: 'RARE',
      allowUnstable: true,
      minDepth: 2,
      note: `Grade ${grade} unstable quality bonus`,
    }));
  }
  if (quality.contrabandPacketBonusChance > 0 && districtDepth >= 3) {
    extras.push(packet('CONTRABAND', 1, {
      fireChance: quality.contrabandPacketBonusChance,
      rarityBias: 'APEX',
      allowContraband: true,
      minDepth: 3,
      note: `Grade ${grade} contraband quality bonus`,
    }));
  }

  return [...packets, ...extras];
}

/** Assemble the packet list for a node (base + signal overlays + grade quality). */
export function assembleNodeRewardPackets(ctx: NodeRewardPacketContext): ResourceRewardPacket[] {
  const districtDepth = (ctx.districtDepth ?? getDistrictFromDepth(ctx.depth)) as ResourceDepthIndex;
  const sectorId = resolveSectorId(ctx);
  let packets = buildBaseNodeRewardPackets(ctx.nodeKind, districtDepth, sectorId);

  // Signal overlays (combat nodes that aren't already echo/anchor kinds).
  if (ctx.nodeKind !== 'ECHO_SIGNAL' && ctx.echoSignal) {
    packets = packets.concat(buildBaseNodeRewardPackets('ECHO_SIGNAL', districtDepth, sectorId));
  }
  if (ctx.nodeKind !== 'ANCHOR_SIGNAL' && ctx.anchorSignal) {
    packets = packets.concat(buildBaseNodeRewardPackets('ANCHOR_SIGNAL', districtDepth, sectorId));
  }

  if (ctx.contractTargetIds?.length) {
    packets.push(packet('CONTRACT', 1, {
      fireChance: 0.35,
      rarityBias: 'UNCOMMON',
      minDepth: 1,
      note: 'Contract target salvage',
    }));
  }
  if (ctx.operationTargetIds?.length) {
    packets.push(packet('OPERATION', 1, {
      fireChance: 0.4,
      rarityBias: 'UNCOMMON',
      minDepth: 1,
      note: 'Operation target salvage',
    }));
  }

  const grade = ctx.breachGrade ?? 'I';
  packets = applyBreachGradePacketBonuses(packets, grade, districtDepth, sectorId);

  // rareLootBonusPct → slight rare fireChance bump (quality, not pile ×N).
  if ((ctx.rareLootBonusPct ?? 0) > 0) {
    const bump = Math.min(0.2, (ctx.rareLootBonusPct ?? 0) / 100);
    packets = packets.map((pkt) => (
      pkt.packetType === 'RARE' || pkt.packetType === 'INTEL'
        ? { ...pkt, fireChance: Math.min(0.95, (pkt.fireChance ?? 1) + bump) }
        : pkt
    ));
  }

  return packets.filter((pkt) => pkt.minDepth <= districtDepth && pkt.rolls > 0);
}

export function rollResourceRewardPackets(
  packets: readonly ResourceRewardPacket[],
  ctx: NodeRewardPacketContext,
): ResourceRewardPacketRollResult {
  const districtDepth = (ctx.districtDepth ?? getDistrictFromDepth(ctx.depth)) as ResourceDepthIndex;
  const sectorId = resolveSectorId(ctx);
  const resourceIds: ResourceItemId[] = [];
  const packetsFired: ResourceRewardPacket[] = [];
  const packetsSkipped: ResourceRewardPacket[] = [];

  packets.forEach((pkt) => {
    if (pkt.minDepth > districtDepth) {
      packetsSkipped.push(pkt);
      return;
    }
    const fireChance = pkt.fireChance ?? 1;
    if (ctx.rng() > fireChance) {
      packetsSkipped.push(pkt);
      return;
    }

    const pool = buildPacketPool(pkt, ctx, sectorId);
    if (pool.length === 0) {
      packetsSkipped.push(pkt);
      return;
    }

    packetsFired.push(pkt);
    for (let i = 0; i < pkt.rolls; i += 1) {
      const pick = pickFromBiasedPool(pool, districtDepth, pkt.rarityBias, ctx.rng)
        ?? pickWeightedForDepth(pool, districtDepth, ctx.rng);
      if (pick) resourceIds.push(pick);
    }
  });

  return { resourceIds, packetsFired, packetsSkipped };
}

export function rollNodeRewardPackets(ctx: NodeRewardPacketContext): ResourceRewardPacketRollResult {
  const packets = assembleNodeRewardPackets(ctx);
  return rollResourceRewardPackets(packets, ctx);
}

export function resolveCombatRewardNodeKind(args: {
  isElite?: boolean;
  isBoss?: boolean;
  isGatekeeper?: boolean;
  echoSignal?: boolean;
  anchorSignal?: boolean;
  resourceAnomaly?: boolean;
}): RewardNodeKind {
  if (args.resourceAnomaly) return 'RESOURCE_ANOMALY';
  if (args.isBoss || args.isGatekeeper) return 'BOSS';
  if (args.anchorSignal) return 'ANCHOR_SIGNAL';
  if (args.echoSignal) return 'ECHO_SIGNAL';
  if (args.isElite) return 'ELITE_COMBAT';
  return 'NORMAL_COMBAT';
}

export function classifyExtractedYieldCounts(resourceIds: readonly ResourceItemId[]): {
  stable: number;
  intelRare: number;
  unstable: number;
  contrabandApex: number;
} {
  let stable = 0;
  let intelRare = 0;
  let unstable = 0;
  let contrabandApex = 0;
  resourceIds.forEach((id) => {
    const def = RESOURCE_REGISTRY[id];
    if (def.category === 'STABLE') {
      if (def.rarity === 'RARE' || def.rarity === 'APEX') intelRare += 1;
      else stable += 1;
    } else if (def.category === 'INTEL') {
      intelRare += 1;
    } else if (def.category === 'UNSTABLE') {
      if (id === 'anomalous-core') contrabandApex += 1;
      else unstable += 1;
    } else if (def.category === 'CONTRABAND') {
      contrabandApex += 1;
    }
  });
  return { stable, intelRare, unstable, contrabandApex };
}

export function formatExtractedYieldTargetsBrief(): string {
  return EXTRACTED_YIELD_TARGETS.map((band) => (
    `${band.label}: stable ${band.stable[0]}–${band.stable[1]} · intel/rare ${band.intelRare[0]}–${band.intelRare[1]}`
    + ` · unstable ${band.unstable[0]}–${band.unstable[1]} · contraband/apex ${band.contrabandApex[0]}–${band.contrabandApex[1]}`
  )).join('\n');
}

export function formatPacketBrief(pkt: ResourceRewardPacket): string {
  const fire = pkt.fireChance != null ? ` @${Math.round(pkt.fireChance * 100)}%` : '';
  return `${pkt.packetType}×${pkt.rolls}${fire} [${pkt.rarityBias}] D≥${pkt.minDepth}`;
}

export function sectorIdFromVeilBiome(veilBiome: VeilBiome | null | undefined): SectorId | null {
  if (!veilBiome) return null;
  return veilBiomeToSectorId(veilBiome);
}

export { getSectorResourceTableByBiome };
