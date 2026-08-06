/**
 * Dev Test Hub — one-click god unlock / restore.
 * Snapshots the full PlayerAccount in memory; second toggle restores it.
 */
import type { ClassType, FactionType, PlayerAccount } from '../types/game';
import type { BreachGradeId } from '../types/progression';
import { ALL_AEGIS_ABILITIES, DEFAULT_AEGIS_TECHNIQUE_LOADOUT } from '../types/aegisCombat';
import {
  DEFAULT_ENVOY_LOADOUT,
  DEFAULT_ENVOY_UNLOCKED,
  DEFAULT_HEX_SHOT_LOADOUT,
  DEFAULT_HEX_SHOT_UNLOCKED,
  type EnvoyLoadout,
  type HexShotLoadout,
} from '../types/operativeClass';
import { ALL_KEEPSAKE_IDS } from './expeditionKeepsakeRegistry';
import { createDefaultKeepsakeDeployment } from './keepsakeRunState';
import {
  createDefaultWeaponProgression,
  unlockAllWeapons,
} from './weaponProgressionEngine';
import {
  getAssignableEnvoyAbilities,
  getAssignableHexShotAbilities,
  HEX_SHOT_ANCHOR,
  ENVOY_ANCHOR,
} from './classAbilityUnlockEngine';
import { normalizeUnlockedAegisAbilities } from './aegisAbilityUnlockEngine';
import { CLASS_RANK_MAX } from './classRankEngine';
import { CABAL_REP_TIER_MAX } from './cabalRepEngine';
import { CRAFTING_REGISTRY } from './craftingRegistry';
import { buildRunItemCraftingRecipes } from './runItemCraftingBridge';
import { discoverRecipeSchematic } from './recipeVisibilityEngine';
import { ALL_PROGRESSION_UNLOCK_IDS } from './unlockRegistry';
import { grantProgressionUnlock } from './rewardGrantService';
import {
  debugUnlockAllSectors,
  debugGrantEconomyResources,
} from './economySpineDebugEngine';
import {
  getAccountProgressionProfile,
  withProgressionProfile,
} from './progressionDebugEngine';
import { createDefaultProgressionProfile } from './progressionProfileEngine';
import {
  debugDiscoverAllEconomyResources,
} from './resourceDiscoveryDebugEngine';
import {
  createEmptyResourceDiscoveryState,
  seedDiscoveryFromStash,
} from './resourceDiscoveryEngine';
import { syncRunnerClearanceUnlocks } from './runnerClearanceEngine';
import { appendProgressionEvent } from './progressionEventLog';

const CLASS_IDS: readonly ClassType[] = ['AEGIS', 'HEX_SHOT', 'ENVOY'];
const CABAL_IDS: readonly FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];
const ALL_BREACH_GRADES: readonly BreachGradeId[] = ['I', 'II', 'III', 'IV', 'V'];
const ALL_BIOMES = [
  'HOSPITAL',
  'ALLEYWAYS',
  'SEWERS',
  'CHURCH',
  'FOREST',
  'CANYON',
] as const;

/** In-memory pre-god snapshot. Null when inactive. */
let godModeSnapshot: PlayerAccount | null = null;

export function isDevGodModeActive(): boolean {
  return godModeSnapshot != null;
}

function cloneAccount(account: PlayerAccount): PlayerAccount {
  if (typeof structuredClone === 'function') {
    return structuredClone(account);
  }
  return JSON.parse(JSON.stringify(account)) as PlayerAccount;
}

function discoverAllRecipes(account: PlayerAccount): PlayerAccount {
  let profile = getAccountProgressionProfile(account);
  const recipes = [...CRAFTING_REGISTRY, ...buildRunItemCraftingRecipes()];
  recipes.forEach((recipe) => {
    profile = discoverRecipeSchematic(profile, recipe.id).profile;
  });
  return withProgressionProfile(account, profile);
}

function grantAllProgressionUnlocks(account: PlayerAccount): PlayerAccount {
  let profile = getAccountProgressionProfile(account);
  ALL_PROGRESSION_UNLOCK_IDS.forEach((unlockId) => {
    profile = grantProgressionUnlock(profile, unlockId, { force: true }).profile;
  });
  return withProgressionProfile(account, profile);
}

function maxCharacterProgression(account: PlayerAccount): PlayerAccount {
  let profile = getAccountProgressionProfile(account);

  const classes = { ...profile.classes };
  CLASS_IDS.forEach((classId) => {
    classes[classId] = {
      ...classes[classId]!,
      rank: CLASS_RANK_MAX,
      xp: 0,
    };
  });

  const cabals = { ...profile.cabals };
  CABAL_IDS.forEach((cabalId) => {
    cabals[cabalId] = {
      ...cabals[cabalId]!,
      repTier: CABAL_REP_TIER_MAX,
      repXp: 0,
    };
  });

  profile = {
    ...profile,
    classes,
    cabals,
    runner: {
      ...profile.runner,
      clearanceRank: 10,
      clearanceXp: 0,
      unlockedBreachGrades: [...ALL_BREACH_GRADES],
    },
  };

  profile = appendProgressionEvent(profile, {
    kind: 'DEBUG_GRANT',
    message: 'Dev god mode — max class ranks, cabal tiers, clearance, breach grades.',
  });
  profile = syncRunnerClearanceUnlocks(profile).profile;

  return withProgressionProfile(account, profile);
}

/** Apply full unlocks + max progression onto a live account (does not snapshot). */
export function applyDevGodModeUnlocks(account: PlayerAccount): PlayerAccount {
  const weapons = unlockAllWeapons();
  let next: PlayerAccount = {
    ...account,
    ...weapons,
    operativeRank: Math.max(account.operativeRank, 99),
    experiencePoints: Math.max(account.experiencePoints, 999_999),
    cabalCredits: Math.max(account.cabalCredits, 50_000),
    unlockedClasses: ['AEGIS', 'HEX_SHOT', 'ENVOY'],
    unlockedBiomes: [...ALL_BIOMES],
    progressionMatrix: {
      ...account.progressionMatrix,
      maxDepthUnlocked: 3,
    },
    unlockedAegisAbilities: [...ALL_AEGIS_ABILITIES],
    unlockedHexShotAbilities: [HEX_SHOT_ANCHOR, ...getAssignableHexShotAbilities()],
    unlockedEnvoyAbilities: [ENVOY_ANCHOR, ...getAssignableEnvoyAbilities()],
    unlockedKeepsakeIds: [...ALL_KEEPSAKE_IDS],
    resourceDiscovery: debugDiscoverAllEconomyResources(),
  };

  next = debugUnlockAllSectors(next).account;
  next = maxCharacterProgression(next);
  next = grantAllProgressionUnlocks(next);
  next = discoverAllRecipes(next);
  next = debugGrantEconomyResources(next, 'ALL', 40).account;

  return next;
}

/**
 * Toggle god unlocks. First call snapshots + unlocks; second restores snapshot.
 */
export function toggleDevGodMode(account: PlayerAccount): {
  account: PlayerAccount;
  active: boolean;
  logLine: string;
} {
  if (godModeSnapshot != null) {
    const restored = godModeSnapshot;
    godModeSnapshot = null;
    return {
      account: restored,
      active: false,
      logLine: '>> DEV GOD MODE OFF — restored previous unlocks, ranks, and stash.',
    };
  }

  godModeSnapshot = cloneAccount(account);
  return {
    account: applyDevGodModeUnlocks(account),
    active: true,
    logLine: [
      '>> DEV GOD MODE ON — unlocked weapons, relics, abilities, recipes/blueprints,',
      'sectors, resources; classes at rank 20; cabals max; clearance 10; breach I–V.',
      'Click again to restore the previous account state.',
    ].join(' '),
  };
}

/**
 * Reset ranks / unlocks / progression to fresh level-1 defaults.
 * Preserves owned items: stash, inventory, banked/pre-run cargo, crafted goods,
 * run-item & tactical loadouts, sealed/unidentified containers, credits, residue.
 */
export function resetDevProgressionKeepItems(account: PlayerAccount): {
  account: PlayerAccount;
  logLine: string;
} {
  // Level-1 reset invalidates any pending god-mode restore snapshot.
  godModeSnapshot = null;

  const weapons = createDefaultWeaponProgression();
  const aegisTechniqueLoadout = [...DEFAULT_AEGIS_TECHNIQUE_LOADOUT] as PlayerAccount['aegisTechniqueLoadout'];
  let profile = createDefaultProgressionProfile();
  profile = appendProgressionEvent(profile, {
    kind: 'PROFILE_RESET',
    message: 'Dev reset — level 1 / no unlocks (items kept).',
  });

  const next: PlayerAccount = {
    ...account,
    ...weapons,
    operativeRank: 1,
    experiencePoints: 0,
    unlockedBiomes: ['HOSPITAL', 'ALLEYWAYS'],
    progressionMatrix: {
      ...account.progressionMatrix,
      maxDepthUnlocked: 1,
      activeCampaignCluster: null,
    },
    regionalPresence: {
      ...account.regionalPresence,
      weaponCoatingUnlocks: [],
    },
    aegisTechniqueLoadout,
    unlockedAegisAbilities: [...normalizeUnlockedAegisAbilities(undefined, aegisTechniqueLoadout)],
    hexShotLoadout: [...DEFAULT_HEX_SHOT_LOADOUT] as HexShotLoadout,
    unlockedHexShotAbilities: [...DEFAULT_HEX_SHOT_UNLOCKED],
    envoyLoadout: [...DEFAULT_ENVOY_LOADOUT] as EnvoyLoadout,
    unlockedEnvoyAbilities: [...DEFAULT_ENVOY_UNLOCKED],
    weaponBriefAcknowledged: [],
    equippedKeepsakeId: null,
    unlockedKeepsakeIds: [],
    keepsakeDeployment: createDefaultKeepsakeDeployment(),
    progressionProfile: profile,
    resourceDiscovery: seedDiscoveryFromStash(
      account.resourceStash,
      createEmptyResourceDiscoveryState(),
    ),
    // Explicitly retained (spread already keeps them; listed for clarity):
    // resourceStash, inventory, bankedCargo, preRunCargo, hubCraftedConsumables,
    // craftedAugments, tacticalLoadout, runItemLoadout, unidentifiedStash,
    // sealedCargoStacks, cabalCredits, veilResidueBalance
  };

  return {
    account: next,
    logLine: [
      '>> DEV RESET — level 1, starter weapons/abilities, Null Zone + Grade I only,',
      'no relics/recipes/sector unlocks. Stash, cargo, inventory, and credits kept.',
    ].join(' '),
  };
}
