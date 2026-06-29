import type { FactionType } from '../types/game';
import type { EnemyCombatProfile } from '../types/run';
import type { ResourceItemId } from '../types/resourceItem';
import { factionForDistrict } from './districtFactionMap';
import type { DistrictId } from './districtPacing';

export type FactionTraitId = 'ENTRENCHED' | 'COLD_VACUUM' | 'VOLATILE_CORE';

export const FACTION_TRAIT_LOOT: Record<FactionType, ResourceItemId> = {
  TERRAN_GRID: 'encrypted-grid-drive',
  LEGION: 'legion-blood-iron',
  SOLARIS: 'sanguine-ampoule',
};

const FACTION_LABEL: Record<FactionType, string> = {
  TERRAN_GRID: 'TERRAN GRID',
  LEGION: 'LEGION',
  SOLARIS: 'SOLARIS',
};

const ALL_FACTIONS: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/** Mirror guard — player never fights their own cabal faction. */
export function rollFactionControl(
  district: DistrictId,
  playerFaction: FactionType | null | undefined,
  seed: string,
): FactionType {
  const defaultFaction = factionForDistrict(district);
  if (playerFaction == null || defaultFaction !== playerFaction) {
    return defaultFaction;
  }
  const others = ALL_FACTIONS.filter((f) => f !== playerFaction);
  const rand = seededRandom(`${seed}:faction-control:${district}`);
  return others[Math.floor(rand() * others.length)] ?? 'TERRAN_GRID';
}

export function factionTraitFor(faction: FactionType): FactionTraitId {
  if (faction === 'TERRAN_GRID') return 'ENTRENCHED';
  if (faction === 'LEGION') return 'COLD_VACUUM';
  return 'VOLATILE_CORE';
}

export function formatCabalDesignation(
  cabalClassLabel: string,
  faction: FactionType,
): string {
  return `${FACTION_LABEL[faction]} ${cabalClassLabel}`;
}

export function applyFactionTrait(
  profile: EnemyCombatProfile,
  faction: FactionType,
): EnemyCombatProfile {
  if (!profile.isCabalHuman) return profile;

  const trait = factionTraitFor(faction);
  let next: EnemyCombatProfile = {
    ...profile,
    cabalFaction: faction,
    factionTrait: trait,
    factionLootId: FACTION_TRAIT_LOOT[faction],
    designation: formatCabalDesignation(
      profile.designation.replace(/^(TERRAN GRID|LEGION|SOLARIS)\s+/i, ''),
      faction,
    ),
  };

  if (trait === 'ENTRENCHED') {
    next = {
      ...next,
      kineticArmor: (next.kineticArmor ?? 0) + 1,
      baseKineticArmor: (next.baseKineticArmor ?? next.kineticArmor ?? 0) + 1,
    };
  }

  return next;
}

export function isLightKillingBlow(damage: number, source?: string): boolean {
  if (source === 'EVISCERATE' || source === 'RUIN' || source === 'GRAVE_BIND') return false;
  return damage < 25;
}

export const SOLARIS_VOLATILE_TRUE_DAMAGE = 14;
export const LEGION_COLD_VACUUM_STAMINA = 5;
export const BREACHER_STAMINA_DRAIN = 22;
export const SPOTTER_ARTILLERY_TRUE_DAMAGE = 35;
