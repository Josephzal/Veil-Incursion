import type { FactionType } from '../types/game';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type {
  CabalIpPool,
  SectorControlResult,
  ShadowWarBuffId,
  ShadowWarCycleReward,
  ShadowWarDonationDraft,
  ShadowWarPersistedState,
  ShadowWarRewardTier,
  ShadowWarSectorId,
} from '../types/shadowWar';
import { calculateDonationIpYield, getResourceIpValue } from './resourceRegistry';
import { getStashCount } from './resourceStashEngine';
import { createDefaultSectorIpState, getShadowWarSector, SHADOW_WAR_SECTORS } from './shadowWarSectors';

const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];
const CONTESTED_MARGIN = 0.05;
const QUALIFICATION_IP = 100;
const TIER2_IP = 250;
const TIER1_IP = 500;

export function getIsoWeekId(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function createDefaultShadowWarState(): ShadowWarPersistedState {
  return {
    sectorIp: createDefaultSectorIpState(),
    weeklyDonatedIP: 0,
    donationLog: [],
    cycleWeekId: getIsoWeekId(),
    lastRewardTier: 0,
  };
}

export function calculateSectorControl(ip: CabalIpPool): SectorControlResult {
  const totalIp = ip.TERRAN_GRID + ip.LEGION + ip.SOLARIS;
  if (totalIp <= 0) {
    return {
      status: 'CONTESTED',
      controllingFaction: null,
      displayInfluence: { TERRAN_GRID: 34, LEGION: 33, SOLARIS: 33 },
      totalIp: 0,
      margin: 0,
    };
  }

  const ranked = FACTION_ORDER
    .map((faction) => ({ faction, score: ip[faction] }))
    .sort((a, b) => b.score - a.score);
  const first = ranked[0];
  const second = ranked[1];
  const margin = (first.score - second.score) / totalIp;
  const displayInfluence: CabalIpPool = {
    TERRAN_GRID: Math.round((ip.TERRAN_GRID / totalIp) * 100),
    LEGION: Math.round((ip.LEGION / totalIp) * 100),
    SOLARIS: Math.round((ip.SOLARIS / totalIp) * 100),
  };

  if (margin > CONTESTED_MARGIN) {
    return {
      status: 'SECURED',
      controllingFaction: first.faction,
      displayInfluence,
      totalIp,
      margin,
    };
  }

  return {
    status: 'CONTESTED',
    controllingFaction: null,
    displayInfluence,
    totalIp,
    margin,
  };
}

export function calculateDonationDraftIp(draft: ShadowWarDonationDraft): number {
  const items = Object.entries(draft.items).flatMap(([id, quantity]) => {
    if (!quantity || quantity <= 0) return [];
    return [{ id: id as ResourceItemId, quantity }];
  });
  return calculateDonationIpYield(items);
}

export function validateDonationDraft(
  stash: ResourceQuantity,
  draft: ShadowWarDonationDraft,
): boolean {
  return Object.entries(draft.items).every(([id, quantity]) => {
    if (!quantity || quantity <= 0) return true;
    return getStashCount(stash, id as ResourceItemId) >= quantity;
  }) && calculateDonationDraftIp(draft) > 0;
}

export function applyDonationDraftToStash(
  stash: ResourceQuantity,
  draft: ShadowWarDonationDraft,
): ResourceQuantity | null {
  if (!validateDonationDraft(stash, draft)) return null;
  const next = { ...stash };
  for (const [id, quantity] of Object.entries(draft.items)) {
    if (!quantity || quantity <= 0) continue;
    const resourceId = id as ResourceItemId;
    const remaining = getStashCount(next, resourceId) - quantity;
    if (remaining <= 0) delete next[resourceId];
    else next[resourceId] = remaining;
  }
  return next;
}

export function applyDonationToSectorIp(
  sectorIp: CabalIpPool,
  faction: FactionType,
  ipGain: number,
): CabalIpPool {
  return {
    ...sectorIp,
    [faction]: sectorIp[faction] + ipGain,
  };
}

export function formatDonationLogLine(
  operative: string,
  sectorLabel: string,
  ipGain: number,
  faction: FactionType,
): string {
  return `>> UPLOAD // ${operative.toUpperCase()} +${ipGain} IP → ${sectorLabel.toUpperCase()} [${faction.replace('_', ' ')}]`;
}

export function resolveRewardTier(weeklyDonatedIP: number): ShadowWarRewardTier {
  if (weeklyDonatedIP < QUALIFICATION_IP) return 0;
  if (weeklyDonatedIP >= TIER1_IP) return 1;
  if (weeklyDonatedIP >= TIER2_IP) return 2;
  return 3;
}

export function resolveShadowWarCycle(
  state: ShadowWarPersistedState,
  playerFaction: FactionType | null,
): { nextState: ShadowWarPersistedState; reward: ShadowWarCycleReward } {
  const tier = resolveRewardTier(state.weeklyDonatedIP);
  const logLines: string[] = [
    '>> SHADOW WAR CYCLE RESOLVED — GLOBAL IP ARRAYS WIPED.',
    `>> OPERATIVE CONTRIBUTION: ${state.weeklyDonatedIP} IP // TIER ${tier}.`,
  ];

  let creditGrant = 0;
  const resourceGrants: Partial<Record<ResourceItemId, number>> = {};

  if (tier === 0) {
    logLines.push('>> QUALIFICATION FAILED — MINIMUM 100 IP REQUIRED FOR REWARDS.');
  } else {
    logLines.push('>> PASSIVE SECTOR BUFFS APPLIED FOR SECURED TERRITORIES.');
    if (tier === 3) {
      logLines.push('>> TIER 3 — PASSIVE BUFFS ONLY.');
    }
    if (tier === 2 || tier === 1) {
      creditGrant = tier === 1 ? 350 : 150;
      resourceGrants['ley-slag'] = tier === 1 ? 8 : 4;
      resourceGrants['echo-glass-shard'] = tier === 1 ? 6 : 3;
      resourceGrants['encrypted-grid-drive'] = tier === 1 ? 1 : 0;
      if (resourceGrants['encrypted-grid-drive'] === 0) delete resourceGrants['encrypted-grid-drive'];
      logLines.push(`>> REQUISITION CACHE — +${creditGrant} CR // MID-TIER MATERIALS.`);
    }
    if (tier === 1) {
      resourceGrants['anomalous-core'] = 1;
      logLines.push('>> TIER 1 — ANOMALOUS CORE ISSUED.');
    }
  }

  if (playerFaction) {
    SHADOW_WAR_SECTORS.forEach((sector) => {
      const control = calculateSectorControl(state.sectorIp[sector.id]);
      if (control.status === 'SECURED' && control.controllingFaction === playerFaction) {
        logLines.push(`>> ${sector.label.toUpperCase()} SECURED — ${sector.buffSummary.toUpperCase()}`);
      }
    });
  }

  return {
    nextState: {
      sectorIp: createDefaultSectorIpState(),
      weeklyDonatedIP: 0,
      donationLog: [`>> WEEK ${getIsoWeekId()} CYCLE COMPLETE — BOARD RESET.`],
      cycleWeekId: getIsoWeekId(),
      lastRewardTier: tier,
    },
    reward: { tier, logLines, creditGrant, resourceGrants },
  };
}

export function collectActiveShadowWarBuffs(
  sectorIp: Record<ShadowWarSectorId, CabalIpPool>,
  playerFaction: FactionType | null,
): ShadowWarBuffId[] {
  if (!playerFaction) return [];
  const buffs: ShadowWarBuffId[] = [];
  SHADOW_WAR_SECTORS.forEach((sector) => {
    const control = calculateSectorControl(sectorIp[sector.id]);
    if (control.status === 'SECURED' && control.controllingFaction === playerFaction) {
      buffs.push(sector.buffId);
    }
  });
  return buffs;
}

export function listDonatableStashResources(
  stash: ResourceQuantity,
): Array<{ resourceId: ResourceItemId; quantity: number; ipValue: number }> {
  return Object.entries(stash).flatMap(([id, quantity]) => {
    if (!quantity || quantity <= 0) return [];
    const resourceId = id as ResourceItemId;
    const ipValue = getResourceIpValue(resourceId);
    if (ipValue <= 0) return [];
    return [{ resourceId, quantity, ipValue }];
  });
}

export function getShadowWarSectorLabel(sectorId: ShadowWarSectorId): string {
  return getShadowWarSector(sectorId).label;
}

export function executeDonationUpload(
  state: ShadowWarPersistedState,
  stash: ResourceQuantity,
  sectorId: ShadowWarSectorId,
  faction: FactionType,
  operativeName: string,
  draft: ShadowWarDonationDraft,
): {
  nextState: ShadowWarPersistedState;
  nextStash: ResourceQuantity;
  ipGain: number;
  logLine: string;
} | null {
  const ipGain = calculateDonationDraftIp(draft);
  const nextStash = applyDonationDraftToStash(stash, draft);
  if (!nextStash || ipGain <= 0) return null;

  const sector = getShadowWarSector(sectorId);
  const nextSectorIp = applyDonationToSectorIp(state.sectorIp[sectorId], faction, ipGain);
  const logLine = formatDonationLogLine(operativeName, sector.label, ipGain, faction);

  return {
    nextState: {
      ...state,
      sectorIp: {
        ...state.sectorIp,
        [sectorId]: nextSectorIp,
      },
      weeklyDonatedIP: state.weeklyDonatedIP + ipGain,
      donationLog: [logLine, ...state.donationLog].slice(0, 24),
    },
    nextStash,
    ipGain,
    logLine,
  };
}

export function maybeResolveWeeklyCycle(
  state: ShadowWarPersistedState,
  playerFaction: FactionType | null,
): {
  state: ShadowWarPersistedState;
  cycleLogs: string[];
  creditGrant: number;
  resourceGrants: Partial<Record<ResourceItemId, number>>;
} {
  const currentWeek = getIsoWeekId();
  if (state.cycleWeekId === currentWeek) {
    return { state, cycleLogs: [], creditGrant: 0, resourceGrants: {} };
  }
  const { nextState, reward } = resolveShadowWarCycle(state, playerFaction);
  return {
    state: nextState,
    cycleLogs: reward.logLines,
    creditGrant: reward.creditGrant,
    resourceGrants: reward.resourceGrants,
  };
}
