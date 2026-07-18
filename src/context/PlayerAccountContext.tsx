import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFactionDefinition } from '../data/factions';
import {
  createDefaultInventory,
  getEquippedWeapon,
  mergeInventory,
  resolveWeaponCombatStats,
  rollTier1CacheDecrypt,
  type ResolvedWeaponCombatStats,
} from '../data/inventory';
import {
  ClassType,
  FactionModifiers,
  FactionType,
  InventoryItem,
  PlayerAccount,
} from '../types/game';
import type { AegisAbilityId, AegisLoadout } from '../types/aegisCombat';
import { DEFAULT_AEGIS_LOADOUT } from '../types/aegisCombat';
import {
  DEFAULT_ENVOY_LOADOUT,
  DEFAULT_ENVOY_UNLOCKED,
  DEFAULT_HEX_SHOT_LOADOUT,
  DEFAULT_HEX_SHOT_UNLOCKED,
  type EnvoyLoadout,
  type HexShotLoadout,
} from '../types/operativeClass';
import { normalizeClassAccountFields, cycleOperativeClass, getClassDisplayName } from '../data/classLoadoutEngine';
import {
  isHexShotAbilityUnlocked,
  isEnvoyAbilityUnlocked,
} from '../data/classAbilityUnlockEngine';
import { getHexShotAbilityDefinition } from '../data/hexShotAbilities';
import { getEnvoyAbilityDefinition } from '../data/envoyAbilities';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import { normalizeAegisLoadout } from '../utils/aegisLoadoutUtils';
import {
  normalizeEnvoyLoadoutForCommit,
  normalizeHexShotLoadoutForCommit,
} from '../utils/classLoadoutUtils';
import {
  deductAbilityUnlockCost,
  isAbilityUnlocked,
  normalizeUnlockedAegisAbilities,
} from '../data/aegisAbilityUnlockEngine';
import { getAbilityDefinition } from '../data/aegisAbilities';
import { createDefaultBankedCargo, createDefaultCargoRunState } from '../types/cargoGrid';
import type { GlobalBankedCargo, CargoRunState } from '../types/cargoGrid';
import {
  applyFenceSale,
  applyHubContrabandPurchase,
  loadHubConsumableIntoCargoAtCell,
  loadStashResourceIntoCargo,
  loadStashResourceIntoCargoAtCell,
  calculateStashUsed,
  clearTacticalSlotState,
  clearRunItemLoadoutSlotState,
  createDefaultTacticalLoadout,
  equipRunItemFromHub,
  equipTacticalFromHub,
  finalizeDescentLoadout,
  finalizeDescentRunItems,
  HUB_STASH_CAPACITY,
  returnAllPreRunContainmentToStash as applyReturnAllPreRunContainmentToStash,
  returnCargoItemToHubStash,
  stageStashItemToCargoContainment,
} from '../data/hubSafehouseEngine';
import { depositAllCargoToHubAccount, depositPhysicalBankSnapshot, resolveExtractionVeilResidueDeposit } from '../data/extractionPersistenceEngine';
import type { CargoRoutingDecision, PostRunRoutingDebriefState } from '../types/postRunCargoRouting';
import { applyCargoRoutingDecisions, buildDefaultRoutingDecisions, buildSecondaryRoutingPendingItems, mergeCargoRoutingResults } from '../data/postRunCargoRoutingEngine';
import { createDefaultCareerCargoRoutingStats, incrementCareerCargoRoutingFromResult } from '../data/postRunCargoRoutingRunState';
import { createDefaultCareerSealedCargoStats } from '../types/sealedCargo';
import {
  careerEntryFromTelemetry,
  createDefaultCareerBalanceHistory,
  pushCareerBalanceRun,
} from '../data/balance/balanceDashboardEngine';
import type { RunBalanceTelemetry } from '../data/runIntegration/runBalanceTelemetryEngine';
import { appraiseSealedCargoInStash, incrementCareerSealedFromRouting, openSealedCargoInStash, sellSealedCargoInStash, syncSealedStacksAfterRouting } from '../data/sealedCargoHubEngine';
import { debugGrantExpansionResources, debugGrantSealedCasket, debugGrantSpecimenJar } from '../data/sealedCargoDebugEngine';
import {
  debugClearResourceStash,
  debugGrantEconomyResources,
  debugUnlockAllSectors,
  type EconomyGrantMode,
} from '../data/economySpineDebugEngine';
import {
  createEmptyResourceDiscoveryState,
  markDiscoveriesFromStashDelta,
  seedDiscoveryFromStash,
} from '../data/resourceDiscoveryEngine';
import {
  debugClearResourceDiscovery,
  debugDiscoverAllEconomyResources,
} from '../data/resourceDiscoveryDebugEngine';
import { createDefaultCareerEconomyTelemetry } from '../types/economyRunTelemetry';
import {
  applyCareerCraftSpend,
  applyCareerFenceSale,
  applyCareerContractCompleted,
  finalizeCareerEconomyFromRun,
  finalizeUnstableCarryDuration,
} from '../data/economyRunTelemetryEngine';
import { migratePlayerAccountEconomy } from '../data/economySaveMigrationEngine';
import { applyBetrayalConsequencesToAccount } from '../data/betrayalConsequencesEngine';
import { buildBetrayalEventsFromRouting } from '../data/contractBetrayalResolver';
import { DEFAULT_UNLOCKED_KEEPSAKE_IDS, isKeepsakeId } from '../data/expeditionKeepsakeRegistry';
import { migrateTacticalRunItemsToLoadout } from '../data/runItemInventoryEngine';
import { createDefaultRunItemsSlotState } from '../types/runItem';
import type { RunItemsSlotState } from '../types/runItem';
import { createDefaultKeepsakeDeployment } from '../data/keepsakeRunState';
import type {
  KeepsakeAttunement,
  KeepsakeDeployment,
  KeepsakeId,
  KeepsakeMirrorCategory,
  KeepsakeRouteDoctrine,
} from '../types/expeditionKeepsake';
import {
  formatPostRunCargoRoutingValidationReport,
  validateCargoRoutingResultIntegrity,
} from '../data/postRunCargoRoutingValidation';
import { relocateCargoItem } from '../data/cargoGridEngine';
import { isResourceItemId } from '../data/resourceRegistry';
import type { FenceableResourceId, ResourceItemId } from '../types/resourceItem';
import { MacroSectorId, RegionalPresenceState } from '../types/regional';
import { createEmptyResourceStash, canAffordRecipe, deductRecipeFromStash } from '../data/resourceStashEngine';
import { getCraftingRecipe, isRecipeOutputOwned } from '../data/craftingRegistry';
import {
  buildRecipeVisibilityStatus,
  discoverRecipeSchematic,
  formatRecipeVisibilityReport,
  isRecipeFabricable,
  syncRecipeDiscoveriesFromStash,
} from '../data/recipeVisibilityEngine';
import type { ResourceQuantity } from '../types/resourceItem';
import type { BoundRequisitionId } from '../types/boundRequisition';
import type { CargoItemId } from '../types/cargoGrid';
import type { RunPhysicalBankSnapshot } from '../types/runResourceLedger';
import { rollDecryptionLoot } from '../data/decryptionLootEngine';
import {
  createDefaultWeaponProgression,
  equipWeaponForClass,
  getEquippedWeaponForClass,
  getWeaponTier,
  normalizeWeaponProgression,
  resolveWeaponState,
  unlockAllWeapons,
  unlockWeaponFamily,
  upgradeWeaponTier,
} from '../data/weaponProgressionEngine';
import {
  resolveWeaponCombatStatsFromState,
} from '../data/weaponCombatEngine';
import type { WeaponFamilyId } from '../types/weapon';
import { getWeaponFamily } from '../data/weaponRegistry';
import {
  DECRYPTION_COST,
  type UnidentifiedTemplateId,
} from '../types/unidentifiedItem';
import { createLockedContainer } from '../data/unidentifiedStashEngine';
import {
  DEFAULT_HOME_MACRO_SECTOR,
  DEFAULT_HOME_METROPOLITAN_NODE,
} from '../constants/homeSector';
import { createDefaultProgressionProfile, normalizeProgressionProfile } from '../data/progressionProfileEngine';
import {
  debugGrantProgressionUnlock,
  debugGrantRunnerClearanceXp,
  debugResetProgressionProfile,
  debugSetRunnerClearance,
  debugUnlockBreachGrade,
  debugUnlockSector,
  formatProgressionProfileReport,
  formatProgressionUnlockCatalogReport,
  getAccountProgressionProfile,
  withProgressionProfile,
} from '../data/progressionDebugEngine';
import {
  applyRunnerClearanceFromDebrief,
} from '../data/runnerClearanceEngine';
import {
  activateSectorAccessMandate,
  resolveSectorAccessFromRun,
  refreshSectorMandateAvailability,
  formatFailureRecoveryReport,
  debugSetRouteIntelFailCount,
} from '../data/sectorAccessMandateEngine';
import { FAILURE_RECOVERY_TUNING } from '../data/failureRecoveryEngine';
import {
  formatProgressionAuditReport,
  formatProgressionEconomySimulationReport,
  formatProgressionPacingScorecard,
  formatProgressionPacingTargetsReport,
  formatProgressionPerRunPreview,
  simulateProgressionCareer,
} from '../data/progressionEconomySimulationEngine';
import {
  formatBreachGradeLabel,
  recordSectorHighestGradeCleared,
} from '../data/breachGradeEngine';
import {
  evaluateAllPinnedGoals,
  listAvailableGoalsToPin,
  pinProgressionGoal,
  syncPinnedGoalsAfterRun,
  unpinProgressionGoal,
  type PinnedGoalStatus,
} from '../data/pinnedGoalEngine';
import {
  applyClassRankFromDebrief,
  applyClassRankXp,
  formatClassRankHookCatalog,
  type ClassRankApplyResult,
} from '../data/classRankEngine';
import {
  applyCabalRepFromDebrief,
  applyCabalRepXp,
  formatCabalTierHookCatalog,
  maxCabalTierForBreachGrade,
  type CabalRepApplyResult,
} from '../data/cabalRepEngine';
import type { BreachGradeId } from '../types/progression';
import type { SectorId } from '../types/worldState';
import { grantProgressionUnlock } from '../data/rewardGrantService';
import type { ContractExtractionKind } from '../types/contract';
import { veilBiomeDisplayName, sectorIdToVeilBiome } from '../data/sectorBiomeBridge';

const STORAGE_KEY = '@veil_incursion/player_account_v2';

const NEUTRAL_FACTION_PERKS: FactionModifiers = {
  maxHpBonus: 0,
  damageMitigation: 0,
  maxStaminaBonus: 0,
  critChanceBonus: 0,
  staminaRegenBonus: 0,
  calibrationBonus: 0,
};

export function createDefaultPlayerAccount(): PlayerAccount {
  const inventory = createDefaultInventory();
  const weaponProgression = createDefaultWeaponProgression();
  const resourceStash = {
    'ley-slag': 6,
    'echo-glass-shard': 10,
    'sanguine-ampoule': 2,
    'legion-blood-iron': 2,
    'encrypted-grid-drive': 1,
  };
  return {
    id: `operative-${Date.now()}`,
    username: 'OPERATIVE-7741',
    operativeRank: 1,
    experiencePoints: 0,
    cabalCredits: 500,
    veilResidueBalance: 0,
    alignedFaction: 'TERRAN_GRID',
    sponsorReputation: {},
    factionPerks: { ...NEUTRAL_FACTION_PERKS },
    activeClass: 'AEGIS',
    unlockedClasses: ['AEGIS', 'HEX_SHOT', 'ENVOY'],
    unlockedBiomes: ['HOSPITAL', 'ALLEYWAYS'],
    progressionMatrix: {
      maxDepthUnlocked: 1,
      activeCampaignCluster: null,
    },
    regionalPresence: {
      homeMacroSector: DEFAULT_HOME_MACRO_SECTOR,
      metropolitanNode: DEFAULT_HOME_METROPOLITAN_NODE,
      weaponCoatingUnlocks: [],
    },
    equipment: {
      weaponId: null,
      armorId: null,
      trinketId: null,
    },
    inventory,
    bankedCargo: createDefaultBankedCargo(),
    aegisLoadout: [...DEFAULT_AEGIS_LOADOUT],
    unlockedAegisAbilities: [...normalizeUnlockedAegisAbilities(undefined, DEFAULT_AEGIS_LOADOUT)],
    hexShotLoadout: [...DEFAULT_HEX_SHOT_LOADOUT] as HexShotLoadout,
    unlockedHexShotAbilities: [...DEFAULT_HEX_SHOT_UNLOCKED],
    envoyLoadout: [...DEFAULT_ENVOY_LOADOUT] as EnvoyLoadout,
    unlockedEnvoyAbilities: [...DEFAULT_ENVOY_UNLOCKED],
    resourceStash,
    weaponUnlocks: weaponProgression.weaponUnlocks,
    weaponTiers: weaponProgression.weaponTiers,
    equippedWeaponByClass: weaponProgression.equippedWeaponByClass,
    craftedAugments: [],
    hubCraftedConsumables: {},
    preRunCargo: createDefaultCargoRunState(),
    tacticalLoadout: createDefaultTacticalLoadout(),
    runItemLoadout: createDefaultRunItemsSlotState(),
    unidentifiedStash: [],
    careerCargoRouting: createDefaultCareerCargoRoutingStats(),
    sponsorTrustStats: {},
    betrayalHistory: [],
    sealedCargoStacks: [],
    careerSealedCargo: createDefaultCareerSealedCargoStats(),
    equippedKeepsakeId: null,
    unlockedKeepsakeIds: [...DEFAULT_UNLOCKED_KEEPSAKE_IDS],
    keepsakeDeployment: createDefaultKeepsakeDeployment(),
    careerBalanceHistory: createDefaultCareerBalanceHistory(),
    resourceDiscovery: seedDiscoveryFromStash(resourceStash),
    careerEconomyTelemetry: createDefaultCareerEconomyTelemetry(),
    progressionProfile: createDefaultProgressionProfile(),
  };
}

function mergeStoredAccount(parsed: Partial<PlayerAccount>): PlayerAccount {
  const defaults = createDefaultPlayerAccount();
  const inventory = mergeInventory(parsed.inventory);
  const classFields = normalizeClassAccountFields(parsed);
  const economy = migratePlayerAccountEconomy({
    resourceStash: parsed.resourceStash,
    resourceDiscovery: parsed.resourceDiscovery,
    careerEconomyTelemetry: parsed.careerEconomyTelemetry,
    sealedCargoStacks: parsed.sealedCargoStacks,
    craftedAugments: parsed.craftedAugments,
    weaponUnlocks: parsed.weaponUnlocks,
  });
  return {
    ...defaults,
    ...parsed,
    ...classFields,
    factionPerks: { ...defaults.factionPerks, ...parsed.factionPerks },
    progressionMatrix: {
      ...defaults.progressionMatrix,
      ...parsed.progressionMatrix,
      maxDepthUnlocked:
        parsed.progressionMatrix?.maxDepthUnlocked
        ?? (parsed.progressionMatrix as { maxTierUnlocked?: number } | undefined)?.maxTierUnlocked
        ?? defaults.progressionMatrix.maxDepthUnlocked,
    },
    regionalPresence: {
      ...defaults.regionalPresence,
      ...parsed.regionalPresence,
      homeMacroSector: DEFAULT_HOME_MACRO_SECTOR,
      metropolitanNode: DEFAULT_HOME_METROPOLITAN_NODE,
    },
    equipment: {
      ...defaults.equipment,
      weaponId: null,
    },
    inventory,
    bankedCargo: {
      ...createDefaultBankedCargo(),
      ...parsed.bankedCargo,
    },
    resourceStash: economy.resourceStash,
    alignedFaction: parsed.alignedFaction ?? defaults.alignedFaction ?? 'TERRAN_GRID',
    sponsorReputation: { ...defaults.sponsorReputation, ...parsed.sponsorReputation },
    ...normalizeWeaponProgression({
      weaponUnlocks: parsed.weaponUnlocks,
      weaponTiers: parsed.weaponTiers,
      equippedWeaponByClass: parsed.equippedWeaponByClass,
    }),
    craftedAugments: parsed.craftedAugments ?? defaults.craftedAugments,
    hubCraftedConsumables: {
      ...defaults.hubCraftedConsumables,
      ...parsed.hubCraftedConsumables,
    },
    preRunCargo: parsed.preRunCargo ?? defaults.preRunCargo,
    ...(() => {
      const migrated = migrateTacticalRunItemsToLoadout(
        parsed.tacticalLoadout ?? defaults.tacticalLoadout,
        parsed.runItemLoadout ?? defaults.runItemLoadout,
      );
      return {
        tacticalLoadout: migrated.tacticalLoadout as PlayerAccount['tacticalLoadout'],
        runItemLoadout: migrated.runItemLoadout,
      };
    })(),
    unidentifiedStash: parsed.unidentifiedStash ?? defaults.unidentifiedStash,
    careerCargoRouting: {
      ...defaults.careerCargoRouting,
      ...parsed.careerCargoRouting,
    },
    sponsorTrustStats: {
      ...defaults.sponsorTrustStats,
      ...parsed.sponsorTrustStats,
    },
    betrayalHistory: parsed.betrayalHistory ?? defaults.betrayalHistory,
    sealedCargoStacks: economy.sealedCargoStacks,
    careerSealedCargo: {
      ...defaults.careerSealedCargo,
      ...parsed.careerSealedCargo,
    },
    equippedKeepsakeId:
      parsed.equippedKeepsakeId && isKeepsakeId(parsed.equippedKeepsakeId)
        ? parsed.equippedKeepsakeId
        : defaults.equippedKeepsakeId,
    unlockedKeepsakeIds: parsed.unlockedKeepsakeIds?.length
      ? parsed.unlockedKeepsakeIds.filter((id): id is KeepsakeId => isKeepsakeId(id))
      : [...defaults.unlockedKeepsakeIds],
    keepsakeDeployment: {
      ...defaults.keepsakeDeployment,
      ...parsed.keepsakeDeployment,
    },
    careerBalanceHistory: {
      runs: [
        ...(parsed.careerBalanceHistory?.runs
          ?? defaults.careerBalanceHistory.runs),
      ].slice(-10),
    },
    veilResidueBalance: parsed.veilResidueBalance ?? defaults.veilResidueBalance,
    resourceDiscovery: economy.resourceDiscovery,
    careerEconomyTelemetry: economy.careerEconomyTelemetry,
    progressionProfile: normalizeProgressionProfile(parsed.progressionProfile),
  };
}

/** XP threshold to advance from current rank to the next. */
export function xpRequiredForRank(rank: number): number {
  return rank * 500;
}

export function xpProgressForAccount(account: PlayerAccount): {
  current: number;
  required: number;
  percent: number;
} {
  const required = xpRequiredForRank(account.operativeRank);
  const percent = required > 0 ? Math.min((account.experiencePoints / required) * 100, 100) : 0;
  return { current: account.experiencePoints, required, percent };
}

interface PlayerAccountContextType {
  account: PlayerAccount;
  isHydrated: boolean;
  hubLog: string[];
  commitFactionAlignment: (faction: FactionType) => void;
  addCredits: (amount: number) => void;
  addRiftIron: (amount: number) => void;
  grantContractRewards: (result: import('../types/contract').ContractResult) => void;
  addExperience: (amount: number) => void;
  equipInventoryItem: (itemId: string) => void;
  decryptTier1Cache: () => Promise<string[]>;
  appendHubLog: (text: string) => void;
  clearHubLog: () => void;
  getEquippedWeaponItem: () => InventoryItem | null;
  getWeaponCombatStats: (classId?: ClassType) => ResolvedWeaponCombatStats;
  resetAccount: () => void;
  unlockRegionalWeaponCoating: (slotId: string) => void;
  setMetropolitanNode: (node: string, sectorId?: MacroSectorId) => void;
  depositBankedCargo: (delta: GlobalBankedCargo) => void;
  setAegisLoadout: (loadout: AegisLoadout) => void;
  setHexShotLoadout: (loadout: HexShotLoadout) => void;
  setEnvoyLoadout: (loadout: EnvoyLoadout) => void;
  setActiveClass: (classId: ClassType) => void;
  cycleActiveClass: (direction: 1 | -1) => void;
  unlockAegisAbility: (abilityId: AegisAbilityId) => {
    success: boolean;
    logLine: string;
  };
  unlockHexShotAbility: (abilityId: HexShotAbilityId) => {
    success: boolean;
    logLine: string;
  };
  unlockEnvoyAbility: (abilityId: EnvoyAbilityId) => {
    success: boolean;
    logLine: string;
  };
  craftRecipe: (recipeId: string) => { success: boolean; logLine: string };
  depositResourceStash: (delta: ResourceQuantity) => void;
  addLockedContainer: (templateId: UnidentifiedTemplateId) => void;
  decryptUnidentifiedItem: (instanceId: string) => Promise<string[]>;
  equipWeaponFamily: (familyId: WeaponFamilyId) => { success: boolean; logLine: string };
  unlockWeaponFamilyAccount: (familyId: WeaponFamilyId) => { success: boolean; logLine: string };
  upgradeWeaponFamilyTier: (familyId: WeaponFamilyId) => { success: boolean; logLine: string };
  unlockAllWeaponFamilies: () => void;
  resetWeaponFamilies: () => void;
  grantWeaponUnlockResources: () => void;
  setEquippedKeepsake: (keepsakeId: KeepsakeId | null) => void;
  setKeepsakeAttunement: (attunement: KeepsakeAttunement | null) => void;
  setKeepsakeRouteDoctrine: (routeDoctrine: KeepsakeRouteDoctrine | null) => void;
  setKeepsakeMirrorCategory: (mirrorCategory: KeepsakeMirrorCategory | null) => void;
  unlockAllKeepsakes: () => void;
  relocatePreRunCargoItem: (instanceId: string, row: number, col: number) => boolean;
  loadStashResourceToCargo: (resourceId: ResourceItemId) => { success: boolean; logLine: string };
  loadStashItemToCargoAtCell: (
    itemId: CargoItemId,
    row: number,
    col: number,
  ) => { success: boolean; logLine: string };
  returnPreRunCargoToStash: (instanceId: string) => { success: boolean; logLine: string };
  stageStashItemToPreRunCargo: (itemId: CargoItemId) => { success: boolean; logLine: string };
  returnAllPreRunContainmentToStash: () => void;
  equipTacticalSlot: (slotIndex: 0 | 1 | 2, itemId: CargoItemId) => { success: boolean; logLine: string };
  clearTacticalSlot: (slotIndex: 0 | 1 | 2) => void;
  equipRunItemLoadoutSlot: (
    slotType: 'COMBAT' | 'FIELD',
    slotIndex: 0 | 1,
    itemId: CargoItemId,
  ) => { success: boolean; logLine: string };
  clearRunItemLoadoutSlot: (slotType: 'COMBAT' | 'FIELD', slotIndex: 0 | 1) => void;
  purchaseHubContraband: (cargoId: CargoItemId, discountPct?: number) => { success: boolean; logLine: string };
  sellFenceResource: (resourceId: FenceableResourceId, quantity?: number) => { success: boolean; logLine: string };
  commitDescentLoadout: () => { cargo: CargoRunState; runItems: RunItemsSlotState };
  persistRunExtraction: (payload: {
    cargo: CargoRunState;
    aegisLoadout: AegisLoadout;
    hexShotLoadout: HexShotLoadout;
    envoyLoadout: EnvoyLoadout;
    sessionVeilResidueCollected?: number;
    /** @deprecated Prefer sessionVeilResidueCollected — cargo residue is resolved automatically. */
    veilResidueCollected?: number;
    excludeResourceIds?: ReadonlySet<ResourceItemId>;
  }) => void;
  applyPostRunCargoRouting: (payload: {
    decisions: CargoRoutingDecision[];
    routingState: PostRunRoutingDebriefState;
    autoStashAlreadyDeposited?: boolean;
    keepsakeRuntime?: import('../types/expeditionKeepsake').KeepsakeRuntime | null;
    routingAppraisalCount?: number;
  }) => import('../types/postRunCargoRouting').CargoRoutingResult;
  /** Phase B — push completed-run balance telemetry into the last-10 career buffer. */
  recordCareerBalanceTelemetry: (
    telemetry: RunBalanceTelemetry,
    economy?: {
      run: import('../types/economyRunTelemetry').EconomyRunTelemetry;
      ledger: import('../types/runResourceLedger').RunResourceLedger;
    },
  ) => void;
  applyBetrayalConsequences: (payload: {
    contractResult: import('../types/contract').ContractResult;
    routingResult: import('../types/postRunCargoRouting').CargoRoutingResult;
    routingState: PostRunRoutingDebriefState;
    decisions: CargoRoutingDecision[];
    runId?: string;
    playerClass?: import('../types/game').ClassType;
    depthReached?: number;
  }) => void;
  /** Routes safehouse-banked run cargo into hub stash (e.g. after death with banked payload). */
  persistRunBankedSnapshot: (bank: RunPhysicalBankSnapshot) => void;
  depositVeilResidueBalance: (amount: number) => number;
  /** Moves vaulted residue into the active run canister at descent. */
  transferVeilResidueIntoRun: (amount: number) => void;
  /** Returns carried-in residue after a failed or aborted run. */
  restoreVeilResidueBaseline: (amount: number) => void;
  applyShadowWarDonationAccount: (
    nextStash: ResourceQuantity,
    nextVeilResidueBalance: number,
  ) => void;
  getStashCapacitySnapshot: () => { used: number; max: number };
  replaceResourceStash: (stash: ResourceQuantity) => void;
  appraiseSealedCargoInHub: (stackId: string) => { success: boolean; logLine: string };
  openSealedCargoInHub: (stackId: string) => { success: boolean; logLine: string };
  sellSealedCargoInHub: (stackId: string) => { success: boolean; logLine: string };
  grantSealedCasketInHub: (quantity?: number) => void;
  grantSpecimenJarInHub: (quantity?: number) => void;
  grantExpansionResourcesInHub: () => void;
  /** Phase 2H — grant economy stash buckets. */
  debugGrantEconomyResourcesInHub: (mode: EconomyGrantMode, quantity?: number) => string;
  /** Phase 2H — clear hub resource stash. */
  debugClearEconomyStashInHub: () => string;
  /** Phase 2H — unlock every sector in progression. */
  debugUnlockAllEconomySectorsInHub: () => string;
  /** Phase 2I — mark all economy resources discovered. */
  debugDiscoverAllResourcesInHub: () => string;
  /** Phase 2I — clear resource discovery state. */
  debugClearResourceDiscoveryInHub: () => string;
  /** Phase 1A — print progression profile to hub log. */
  logProgressionProfile: () => string;
  /** Phase 1A — print unlock registry status vs current profile. */
  logProgressionUnlockCatalog: () => string;
  /** Phase 1A — force-grant a catalog unlock (debug). */
  debugGrantProgressionUnlockId: (unlockId: string) => void;
  /** Phase 1A — set runner clearance rank (debug). */
  debugSetRunnerClearanceRank: (rank: number) => void;
  /** Phase 1A — unlock a sector (debug). */
  debugUnlockProgressionSector: (sectorId: SectorId) => void;
  /** Phase 1A — unlock a breach grade (debug). */
  debugUnlockProgressionBreachGrade: (grade: BreachGradeId) => void;
  /** Phase 1A — reset progression profile only (debug). */
  debugResetProgression: () => void;
  /** Phase 1A — attempt to grant unlock with requirement checks. */
  tryGrantProgressionUnlock: (unlockId: string) => { success: boolean; logLine: string };
  /** Phase 1B — award Runner Clearance XP from a finished run. */
  applyRunnerClearanceFromRun: (input: {
    runOutcome: 'EXTRACTED' | 'FAILED';
    extractionKind?: ContractExtractionKind;
    depthReached: number;
    contractSucceeded?: boolean;
    breachGrade?: import('../types/progression').BreachGradeId;
  }) => { xpGained: number; ranksGained: number; newRank: number; logLines: string[] };
  /** Phase 1B — debug grant clearance XP. */
  debugGrantRunnerClearanceXpAmount: (xpAmount: number) => string;
  /** Phase 1C — accept a sector access mandate (AVAILABLE → ACTIVE). */
  activateSectorAccessMandate: (sectorId: SectorId) => { ok: boolean; logLine: string };
  /** Phase 1C — resolve sector unlocks / fail tracking from a finished run. */
  applySectorAccessFromRun: (input: {
    extractedSuccessfully: boolean;
    extracted: import('../types/resourceItem').ResourceQuantity;
    lostOnDeath: import('../types/resourceItem').ResourceQuantity;
    runSectorId?: SectorId | null;
  }) => { unlockedSectorIds: SectorId[]; unlockLines: string[]; logLines: string[] };
  /** Phase 1D — record highest Breach Grade cleared for a sector after extract. */
  applyBreachGradeClearFromRun: (input: {
    extractedSuccessfully: boolean;
    sectorId?: SectorId | null;
    breachGrade?: import('../types/progression').BreachGradeId;
  }) => { updated: boolean; logLine: string | null };
  /** Phase 1E — pin a progression goal (1–3 slots). */
  pinProgressionGoalId: (goalDefId: string) => { ok: boolean; logLine: string };
  /** Phase 1E — unpin a progression goal. */
  unpinProgressionGoalId: (goalDefId: string) => { ok: boolean; logLine: string };
  /** Phase 1E — evaluate + auto-clear completed pinned goals after a run. */
  syncPinnedGoalsFromRun: () => {
    statuses: PinnedGoalStatus[];
    completed: PinnedGoalStatus[];
    logLines: string[];
  };
  /** Phase 1E — list pin-able goals not yet complete. */
  listPinableProgressionGoals: () => ReturnType<typeof listAvailableGoalsToPin>;
  /** Phase 1E — current pinned goal statuses. */
  getPinnedGoalStatuses: () => PinnedGoalStatus[];
  /** Phase 1E — debug grant recipe unlock for recipe goals. */
  debugGrantRecipeGoalUnlock: (recipeId: string) => string;
  /** Phase 1G — sync Known discoveries from current stash contents. */
  syncRecipeVisibilityFromStash: () => { newlyKnown: string[]; logLines: string[] };
  /** Phase 1G — force-discover a schematic as Known. */
  discoverRecipeSchematicId: (recipeId: string) => { discovered: boolean; logLine: string };
  /** Phase 1G — print Known / Rumored / Unknown report. */
  logRecipeVisibilityReport: () => string;
  /** Phase 1F — award class XP / rank hooks from a finished run. */
  applyClassRankFromRun: (input: {
    classId?: ClassType;
    runOutcome: 'EXTRACTED' | 'FAILED';
    depthReached: number;
    contractSucceeded?: boolean;
    breachGrade?: BreachGradeId;
  }) => ClassRankApplyResult;
  /** Phase 1F — award cabal rep / tier hooks from a sponsored contract. */
  applyCabalRepFromRun: (input: {
    contractSucceeded: boolean;
    reputationAwarded: number;
    sponsorId: FactionType;
    breachGrade?: BreachGradeId;
  }) => CabalRepApplyResult;
  /** Phase 1F — debug grant class XP. */
  debugGrantClassRankXpAmount: (classId: ClassType, xpAmount: number) => string;
  /** Phase 1F — debug grant cabal rep XP. */
  debugGrantCabalRepXpAmount: (cabalId: FactionType, xpAmount: number, breachGrade?: BreachGradeId) => string;
  /** Phase 1F — print class/cabal hook catalogs. */
  logClassCabalHookCatalog: () => string;
  /** Phase 1I — print route-intel pity / failure recovery report. */
  logFailureRecoveryReport: () => string;
  /** Phase 1I — set route-intel fail count (activates mandate if needed). */
  debugSetRouteIntelFailCountForSector: (sectorId: SectorId, failCount: number) => string;
  /** Phase 1J — simulate N abstracted progression runs (does not mutate account). */
  simulateProgressionEconomyRuns: (runCount?: number, seed?: string) => string;
  /** Phase 1J — print pacing targets + scorecard from a fresh sim. */
  logProgressionPacingScorecard: (runCount?: number) => string;
  /** Phase 1J — recipe/resource + soft-lock audit for current profile. */
  logProgressionEconomyAudit: () => string;
  /** Phase 1J — single-run XP/rep preview. */
  logProgressionPerRunPreview: () => string;
}

const PlayerAccountContext = createContext<PlayerAccountContextType | undefined>(undefined);

export function PlayerAccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<PlayerAccount>(createDefaultPlayerAccount);
  const [hubLog, setHubLog] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw =
          (await AsyncStorage.getItem(STORAGE_KEY)) ??
          (await AsyncStorage.getItem('@veil_incursion/player_account_v1'));
        if (raw && mounted) {
          const parsed = JSON.parse(raw) as Partial<PlayerAccount>;
          setAccount(mergeStoredAccount(parsed));
        }
      } catch {
        // Fresh deployment profile on read failure.
      } finally {
        if (mounted) setIsHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persistAccount = useCallback((next: PlayerAccount) => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }, 120);
  }, []);

  const updateAccount = useCallback(
    (updater: (prev: PlayerAccount) => PlayerAccount) => {
      setAccount((prev) => {
        const next = updater(prev);
        persistAccount(next);
        return next;
      });
    },
    [persistAccount],
  );

  const appendHubLog = useCallback((text: string) => {
    setHubLog((prev) => [...prev, text]);
  }, []);

  const clearHubLog = useCallback(() => setHubLog([]), []);

  const commitFactionAlignment = useCallback(
    (faction: FactionType) => {
      const def = getFactionDefinition(faction);
      updateAccount((prev) => ({
        ...prev,
        alignedFaction: faction,
        factionPerks: { ...def.perks },
        cabalCredits: prev.cabalCredits + def.alignmentBonusCredits,
      }));
    },
    [updateAccount],
  );

  const addCredits = useCallback(
    (amount: number) => {
      updateAccount((prev) => ({ ...prev, cabalCredits: prev.cabalCredits + amount }));
    },
    [updateAccount],
  );

  const addRiftIron = useCallback(
    (amount: number) => {
      updateAccount((prev) => ({
        ...prev,
        inventory: {
          ...prev.inventory,
          materials: {
            ...prev.inventory.materials,
            riftIron: prev.inventory.materials.riftIron + amount,
          },
        },
      }));
    },
    [updateAccount],
  );

  const grantContractRewards = useCallback(
    (result: import('../types/contract').ContractResult) => {
      if (result.status !== 'SUCCESS' || !result.sponsorId) return;
      updateAccount((prev) => {
        const nextStash = { ...prev.resourceStash };
        result.resourceBonusIds.forEach((resourceId) => {
          nextStash[resourceId] = (nextStash[resourceId] ?? 0) + 1;
        });
        const totalCredits = result.creditsAwarded + result.bonusCreditsAwarded;
        const totalReputation = result.reputationAwarded + result.bonusReputationAwarded;
        return {
          ...prev,
          cabalCredits: prev.cabalCredits + totalCredits,
          sponsorReputation: {
            ...prev.sponsorReputation,
            [result.sponsorId!]: (prev.sponsorReputation[result.sponsorId!] ?? 0) + totalReputation,
          },
          resourceStash: nextStash,
        };
      });
    },
    [updateAccount],
  );

  const addExperience = useCallback(
    (amount: number) => {
      updateAccount((prev) => {
        let xp = prev.experiencePoints + amount;
        let rank = prev.operativeRank;
        while (xp >= xpRequiredForRank(rank)) {
          xp -= xpRequiredForRank(rank);
          rank += 1;
        }
        return { ...prev, experiencePoints: xp, operativeRank: rank };
      });
    },
    [updateAccount],
  );

  const getEquippedWeaponItem = useCallback((): InventoryItem | null => {
    return getEquippedWeapon(account.inventory.items);
  }, [account.inventory.items]);

  const getWeaponCombatStats = useCallback((classId?: ClassType): ResolvedWeaponCombatStats => {
    const activeClass = classId ?? account.activeClass;
    const progression = {
      weaponUnlocks: account.weaponUnlocks,
      weaponTiers: account.weaponTiers,
      equippedWeaponByClass: account.equippedWeaponByClass,
    };
    const familyId = getEquippedWeaponForClass(progression, activeClass);
    const tier = getWeaponTier(progression, familyId);
    const weapon = resolveWeaponState(familyId, tier);
    return resolveWeaponCombatStatsFromState(weapon);
  }, [account.activeClass, account.equippedWeaponByClass, account.weaponTiers, account.weaponUnlocks]);

  const equipInventoryItem = useCallback(
    (itemId: string) => {
      updateAccount((prev) => {
        const target = prev.inventory.items.find((i) => i.id === itemId);
        if (!target || target.type !== 'WEAPON') return prev;

        const items = prev.inventory.items.map((item) => {
          if (item.type !== 'WEAPON') return item;
          return { ...item, isEquipped: item.id === itemId };
        });

        return {
          ...prev,
          equipment: { ...prev.equipment, weaponId: itemId },
          inventory: { ...prev.inventory, items },
        };
      });
    },
    [updateAccount],
  );

  const decryptTier1Cache = useCallback(async (): Promise<string[]> => {
    if (account.inventory.unopenedCaches.tier1Caches <= 0) {
      return ['>> ERROR: No Tier 1 caches available for decryption.'];
    }

    const ownedIds = new Set(account.inventory.items.map((i) => i.id));
    const roll = rollTier1CacheDecrypt(ownedIds);

    updateAccount((prev) => {
      const items = roll.newWeapon
        ? [...prev.inventory.items, roll.newWeapon]
        : prev.inventory.items;

      return {
        ...prev,
        cabalCredits: prev.cabalCredits + roll.credits,
        inventory: {
          ...prev.inventory,
          items,
          materials: {
            ...prev.inventory.materials,
            riftIron: prev.inventory.materials.riftIron + roll.riftIron,
          },
          unopenedCaches: {
            ...prev.inventory.unopenedCaches,
            tier1Caches: prev.inventory.unopenedCaches.tier1Caches - 1,
          },
        },
      };
    });

    return ['>> CACHE DECRYPTION COMPLETE.', ...roll.logLines];
  }, [account.inventory, updateAccount]);

  const resetAccount = useCallback(() => {
    const fresh = createDefaultPlayerAccount();
    setAccount(fresh);
    setHubLog([]);
    persistAccount(fresh);
  }, [persistAccount]);

  const unlockRegionalWeaponCoating = useCallback(
    (slotId: string) => {
      updateAccount((prev) => {
        if (prev.regionalPresence.weaponCoatingUnlocks.includes(slotId)) return prev;
        return {
          ...prev,
          regionalPresence: {
            ...prev.regionalPresence,
            weaponCoatingUnlocks: [...prev.regionalPresence.weaponCoatingUnlocks, slotId],
          },
        };
      });
    },
    [updateAccount],
  );

  const setMetropolitanNode = useCallback(
    (node: string, _sectorId?: MacroSectorId) => {
      updateAccount((prev) => ({
        ...prev,
        regionalPresence: {
          ...prev.regionalPresence,
          metropolitanNode: node,
        },
      }));
    },
    [updateAccount],
  );

  const depositBankedCargo = useCallback(
    (delta: GlobalBankedCargo) => {
      updateAccount((prev) => ({
        ...prev,
        bankedCargo: {
          totalValue: prev.bankedCargo.totalValue + delta.totalValue,
          lastTransferValue: delta.lastTransferValue,
        },
      }));
    },
    [updateAccount],
  );

  const setAegisLoadout = useCallback(
    (loadout: AegisLoadout) => {
      updateAccount((prev) => ({
        ...prev,
        aegisLoadout: [...loadout],
      }));
    },
    [updateAccount],
  );

  const setHexShotLoadout = useCallback(
    (loadout: HexShotLoadout) => {
      updateAccount((prev) => ({
        ...prev,
        hexShotLoadout: [...loadout],
      }));
    },
    [updateAccount],
  );

  const setEnvoyLoadout = useCallback(
    (loadout: EnvoyLoadout) => {
      updateAccount((prev) => ({
        ...prev,
        envoyLoadout: [...loadout],
      }));
    },
    [updateAccount],
  );

  const setActiveClass = useCallback(
    (classId: ClassType) => {
      updateAccount((prev) => {
        if (!prev.unlockedClasses.includes(classId) || prev.activeClass === classId) {
          return prev;
        }
        appendHubLog(`>> CLASS MODULE LOCKED — ${getClassDisplayName(classId).toUpperCase()} ACTIVE.`);
        return {
          ...prev,
          activeClass: classId,
        };
      });
    },
    [appendHubLog, updateAccount],
  );

  const cycleActiveClass = useCallback(
    (direction: 1 | -1) => {
      updateAccount((prev) => {
        const nextClass = cycleOperativeClass(prev.activeClass, prev.unlockedClasses, direction);
        if (nextClass === prev.activeClass) return prev;
        appendHubLog(`>> CLASS MODULE LOCKED — ${getClassDisplayName(nextClass).toUpperCase()} ACTIVE.`);
        return {
          ...prev,
          activeClass: nextClass,
        };
      });
    },
    [appendHubLog, updateAccount],
  );

  const unlockAegisAbility = useCallback(
    (abilityId: AegisAbilityId): { success: boolean; logLine: string } => {
      const def = getAbilityDefinition(abilityId);
      if (isAbilityUnlocked(account.unlockedAegisAbilities, abilityId)) {
        return { success: false, logLine: `>> ${def.label} ALREADY UNLOCKED.` };
      }
      const nextStash = deductAbilityUnlockCost(account.resourceStash, def.unlockCost);
      if (!nextStash) {
        return { success: false, logLine: `>> UNLOCK REJECTED — INSUFFICIENT RESOURCES FOR ${def.label}.` };
      }
      updateAccount((prev) => ({
        ...prev,
        resourceStash: nextStash,
        unlockedAegisAbilities: [...prev.unlockedAegisAbilities, abilityId],
      }));
      return { success: true, logLine: `>> ${def.label} UNLOCKED — COMBAT PROTOCOL INTEGRATED.` };
    },
    [account.resourceStash, account.unlockedAegisAbilities, updateAccount],
  );

  const unlockHexShotAbility = useCallback(
    (abilityId: HexShotAbilityId): { success: boolean; logLine: string } => {
      const def = getHexShotAbilityDefinition(abilityId);
      if (isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, abilityId)) {
        return { success: false, logLine: `>> ${def.label} ALREADY UNLOCKED.` };
      }
      const nextStash = deductAbilityUnlockCost(account.resourceStash, def.unlockCost);
      if (!nextStash) {
        return { success: false, logLine: `>> UNLOCK REJECTED — INSUFFICIENT RESOURCES FOR ${def.label}.` };
      }
      updateAccount((prev) => ({
        ...prev,
        resourceStash: nextStash,
        unlockedHexShotAbilities: [...prev.unlockedHexShotAbilities, abilityId],
      }));
      return { success: true, logLine: `>> ${def.label} UNLOCKED — BALLISTIC PROTOCOL INTEGRATED.` };
    },
    [account.resourceStash, account.unlockedHexShotAbilities, updateAccount],
  );

  const unlockEnvoyAbility = useCallback(
    (abilityId: EnvoyAbilityId): { success: boolean; logLine: string } => {
      const def = getEnvoyAbilityDefinition(abilityId);
      if (isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, abilityId)) {
        return { success: false, logLine: `>> ${def.label} ALREADY UNLOCKED.` };
      }
      const nextStash = deductAbilityUnlockCost(account.resourceStash, def.unlockCost);
      if (!nextStash) {
        return { success: false, logLine: `>> UNLOCK REJECTED — INSUFFICIENT RESOURCES FOR ${def.label}.` };
      }
      updateAccount((prev) => ({
        ...prev,
        resourceStash: nextStash,
        unlockedEnvoyAbilities: [...prev.unlockedEnvoyAbilities, abilityId],
      }));
      return { success: true, logLine: `>> ${def.label} UNLOCKED — SPELL PROTOCOL INTEGRATED.` };
    },
    [account.resourceStash, account.unlockedEnvoyAbilities, updateAccount],
  );

  const depositResourceStash = useCallback(
    (delta: ResourceQuantity) => {
      updateAccount((prev) => {
        const nextStash = { ...prev.resourceStash };
        Object.entries(delta).forEach(([id, count]) => {
          if (!count || count <= 0) return;
          const resourceId = id as import('../types/resourceItem').ResourceItemId;
          nextStash[resourceId] = (nextStash[resourceId] ?? 0) + count;
        });
        return { ...prev, resourceStash: nextStash };
      });
    },
    [updateAccount],
  );

  const craftRecipe = useCallback(
    (recipeId: string): { success: boolean; logLine: string } => {
      const recipe = getCraftingRecipe(recipeId);
      if (!recipe) {
        return { success: false, logLine: '>> FABRICATION REJECTED — UNKNOWN SCHEMATIC.' };
      }
      const profile = getAccountProgressionProfile(account);
      if (!isRecipeFabricable(profile, account, recipeId)) {
        const status = buildRecipeVisibilityStatus(profile, account, recipe);
        if (status.visibility === 'RUMORED') {
          return {
            success: false,
            logLine: `>> FABRICATION REJECTED — ${recipe.label.toUpperCase()} IS RUMORED (COSTS SEALED).`,
          };
        }
        return {
          success: false,
          logLine: '>> FABRICATION REJECTED — SCHEMATIC UNKNOWN.',
        };
      }
      if (
        recipe.kind !== 'CONSUMABLE'
        && isRecipeOutputOwned(
          recipe.outputId,
          [],
          account.craftedAugments,
        )
      ) {
        return { success: false, logLine: `>> ${recipe.label.toUpperCase()} ALREADY FORGED.` };
      }
      if (!canAffordRecipe(account.resourceStash, recipe)) {
        return { success: false, logLine: '>> FABRICATION REJECTED — INSUFFICIENT RESOURCES.' };
      }
      const nextStash = deductRecipeFromStash(account.resourceStash, recipe);
      if (!nextStash) {
        return { success: false, logLine: '>> FABRICATION REJECTED — STASH DEDUCTION FAILED.' };
      }

      const spentUnits = recipe.requirements.reduce((sum, req) => sum + req.quantity, 0);

      updateAccount((prev) => {
        const discovered = discoverRecipeSchematic(
          getAccountProgressionProfile(prev),
          recipe.id,
        );
        const withProfile = withProgressionProfile(prev, discovered.profile);
        const base = {
          ...withProfile,
          resourceStash: nextStash,
          careerEconomyTelemetry: applyCareerCraftSpend(prev.careerEconomyTelemetry, spentUnits),
        };
        if (recipe.kind === 'AUGMENT') {
          const augmentId = recipe.outputId as BoundRequisitionId;
          if (prev.craftedAugments.includes(augmentId)) return base;
          return {
            ...base,
            craftedAugments: [...prev.craftedAugments, augmentId],
          };
        }
        const consumableId = recipe.outputId as CargoItemId;
        const nextConsumables = { ...prev.hubCraftedConsumables };
        nextConsumables[consumableId] = (nextConsumables[consumableId] ?? 0) + 1;
        return {
          ...base,
          hubCraftedConsumables: nextConsumables,
        };
      });

      if (recipe.kind === 'AUGMENT') {
        return {
          success: true,
          logLine: `>> AUGMENT FORGED — ${recipe.label.toUpperCase()} STAGED FOR DEPLOYMENT.`,
        };
      }
      return {
        success: true,
        logLine: `>> CONSUMABLE FABRICATED — ${recipe.label.toUpperCase()} ADDED TO HUB STAGING.`,
      };
    },
    [
      account,
      updateAccount,
    ],
  );

  const addLockedContainer = useCallback(
    (templateId: UnidentifiedTemplateId) => {
      updateAccount((prev) => ({
        ...prev,
        unidentifiedStash: [...prev.unidentifiedStash, createLockedContainer(templateId)],
      }));
    },
    [updateAccount],
  );

  const equipWeaponFamily = useCallback(
    (familyId: WeaponFamilyId): { success: boolean; logLine: string } => {
      const def = getWeaponFamily(familyId);
      const nextState = equipWeaponForClass(
        {
          weaponUnlocks: account.weaponUnlocks,
          weaponTiers: account.weaponTiers,
          equippedWeaponByClass: account.equippedWeaponByClass,
        },
        def.classId,
        familyId,
      );
      if (!nextState) {
        return { success: false, logLine: '>> WEAPON LINK REJECTED — FAMILY LOCKED OR CLASS MISMATCH.' };
      }
      updateAccount((prev) => ({
        ...prev,
        equippedWeaponByClass: nextState.equippedWeaponByClass,
      }));
      const tier = getWeaponTier(nextState, familyId);
      return {
        success: true,
        logLine: `>> WEAPON LINKED — ${resolveWeaponState(familyId, tier).displayName.toUpperCase()}.`,
      };
    },
    [account.equippedWeaponByClass, account.weaponTiers, account.weaponUnlocks, updateAccount],
  );

  const unlockWeaponFamilyAccount = useCallback(
    (familyId: WeaponFamilyId): { success: boolean; logLine: string } => {
      const progression = {
        weaponUnlocks: account.weaponUnlocks,
        weaponTiers: account.weaponTiers,
        equippedWeaponByClass: account.equippedWeaponByClass,
      };
      const result = unlockWeaponFamily(account.resourceStash, progression, familyId);
      if (!result) {
        return { success: false, logLine: '>> WEAPON UNLOCK REJECTED — INSUFFICIENT RESOURCES OR ALREADY OWNED.' };
      }
      updateAccount((prev) => ({
        ...prev,
        resourceStash: result.nextStash,
        weaponUnlocks: result.nextState.weaponUnlocks,
        weaponTiers: result.nextState.weaponTiers,
      }));
      return {
        success: true,
        logLine: `>> WEAPON BLUEPRINT UNLOCKED — ${resolveWeaponState(familyId, 1).displayName.toUpperCase()}.`,
      };
    },
    [account.equippedWeaponByClass, account.resourceStash, account.weaponTiers, account.weaponUnlocks, updateAccount],
  );

  const upgradeWeaponFamilyTier = useCallback(
    (familyId: WeaponFamilyId): { success: boolean; logLine: string } => {
      const progression = {
        weaponUnlocks: account.weaponUnlocks,
        weaponTiers: account.weaponTiers,
        equippedWeaponByClass: account.equippedWeaponByClass,
      };
      const result = upgradeWeaponTier(account.resourceStash, progression, familyId);
      if (!result) {
        return { success: false, logLine: '>> WEAPON UPGRADE REJECTED — INSUFFICIENT RESOURCES OR MAX TIER.' };
      }
      const tier = getWeaponTier(result.nextState, familyId);
      updateAccount((prev) => ({
        ...prev,
        resourceStash: result.nextStash,
        weaponTiers: result.nextState.weaponTiers,
      }));
      return {
        success: true,
        logLine: `>> WEAPON UPGRADED — ${resolveWeaponState(familyId, tier).displayName.toUpperCase()}.`,
      };
    },
    [account.equippedWeaponByClass, account.resourceStash, account.weaponTiers, account.weaponUnlocks, updateAccount],
  );

  const unlockAllWeaponFamilies = useCallback(() => {
    updateAccount((prev) => ({
      ...prev,
      ...unlockAllWeapons(),
    }));
  }, [updateAccount]);

  const resetWeaponFamilies = useCallback(() => {
    updateAccount((prev) => ({
      ...prev,
      ...createDefaultWeaponProgression(),
    }));
  }, [updateAccount]);

  const grantWeaponUnlockResources = useCallback(() => {
    updateAccount((prev) => ({
      ...prev,
      resourceStash: {
        ...prev.resourceStash,
        'ley-slag': 20,
        'echo-glass-shard': 20,
        'sanguine-ampoule': 10,
        'legion-blood-iron': 10,
        'encrypted-grid-drive': 5,
        'combustion-cylinder': 5,
        'ossified-ley-knot': 5,
        'rail-capacitor': 6,
        'containment-seal': 4,
        'resonant-filament': 8,
        'mycelial-ichor': 4,
        'breach-thread': 3,
        'nullcrete-shard': 6,
        'cinder-wire': 6,
        'anchor-marrow': 3,
      },
    }));
  }, [updateAccount]);

  const setEquippedKeepsake = useCallback(
    (keepsakeId: KeepsakeId | null) => {
      updateAccount((prev) => {
        if (keepsakeId && !prev.unlockedKeepsakeIds.includes(keepsakeId)) {
          return prev;
        }
        return { ...prev, equippedKeepsakeId: keepsakeId };
      });
    },
    [updateAccount],
  );

  const setKeepsakeAttunement = useCallback(
    (attunement: KeepsakeAttunement | null) => {
      updateAccount((prev) => ({
        ...prev,
        keepsakeDeployment: { ...prev.keepsakeDeployment, attunement },
      }));
    },
    [updateAccount],
  );

  const setKeepsakeRouteDoctrine = useCallback(
    (routeDoctrine: KeepsakeRouteDoctrine | null) => {
      updateAccount((prev) => ({
        ...prev,
        keepsakeDeployment: { ...prev.keepsakeDeployment, routeDoctrine },
      }));
    },
    [updateAccount],
  );

  const setKeepsakeMirrorCategory = useCallback(
    (mirrorCategory: KeepsakeMirrorCategory | null) => {
      updateAccount((prev) => ({
        ...prev,
        keepsakeDeployment: { ...prev.keepsakeDeployment, mirrorCategory },
      }));
    },
    [updateAccount],
  );

  const unlockAllKeepsakes = useCallback(() => {
    updateAccount((prev) => ({
      ...prev,
      unlockedKeepsakeIds: [...DEFAULT_UNLOCKED_KEEPSAKE_IDS],
    }));
  }, [updateAccount]);

  const relocatePreRunCargoItem = useCallback(
    (instanceId: string, row: number, col: number): boolean => {
      let moved = false;
      updateAccount((prev) => {
        const nextCargo = relocateCargoItem(prev.preRunCargo, instanceId, row, col);
        if (!nextCargo) return prev;
        moved = true;
        return { ...prev, preRunCargo: nextCargo };
      });
      return moved;
    },
    [updateAccount],
  );

  const loadStashResourceToCargo = useCallback(
    (resourceId: ResourceItemId): { success: boolean; logLine: string } => {
      let success = false;
      updateAccount((prev) => {
        const result = loadStashResourceIntoCargo(prev.resourceStash, prev.preRunCargo, resourceId);
        if (!result) return prev;
        success = true;
        return {
          ...prev,
          resourceStash: result.stash,
          preRunCargo: result.cargo,
        };
      });
      return success
        ? { success: true, logLine: `>> STASH → CARGO — ${resourceId.replace(/-/g, ' ').toUpperCase()} LOADED.` }
        : { success: false, logLine: '>> CARGO TRANSFER REJECTED — STASH EMPTY OR GRID FULL.' };
    },
    [updateAccount],
  );

  const loadStashItemToCargoAtCell = useCallback(
    (itemId: CargoItemId, row: number, col: number): { success: boolean; logLine: string } => {
      let success = false;
      updateAccount((prev) => {
        if (isResourceItemId(itemId)) {
          const result = loadStashResourceIntoCargoAtCell(prev.resourceStash, prev.preRunCargo, itemId, row, col);
          if (!result) return prev;
          success = true;
          return {
            ...prev,
            resourceStash: result.stash,
            preRunCargo: result.cargo,
          };
        }
        const result = loadHubConsumableIntoCargoAtCell(prev.hubCraftedConsumables, prev.preRunCargo, itemId, row, col);
        if (!result) return prev;
        success = true;
        return {
          ...prev,
          hubCraftedConsumables: result.hubCraftedConsumables,
          preRunCargo: result.cargo,
        };
      });
      const label = itemId.replace(/-/g, ' ').toUpperCase();
      return success
        ? { success: true, logLine: `>> STASH → CARGO [${row},${col}] — ${label} LOADED.` }
        : { success: false, logLine: '>> CARGO TRANSFER REJECTED — STASH EMPTY OR SLOT INVALID.' };
    },
    [updateAccount],
  );

  const returnPreRunCargoToStash = useCallback(
    (instanceId: string): { success: boolean; logLine: string } => {
      let success = false;
      let itemId: CargoItemId | undefined;
      updateAccount((prev) => {
        const result = returnCargoItemToHubStash(
          prev.resourceStash,
          prev.hubCraftedConsumables,
          prev.preRunCargo,
          instanceId,
        );
        if (!result) return prev;
        success = true;
        itemId = result.itemId;
        return {
          ...prev,
          resourceStash: result.resourceStash,
          hubCraftedConsumables: result.hubCraftedConsumables,
          preRunCargo: result.cargo,
        };
      });
      const label = itemId?.replace(/-/g, ' ').toUpperCase() ?? 'ITEM';
      return success
        ? { success: true, logLine: `>> CARGO → STASH — ${label} RETURNED TO VAULT.` }
        : { success: false, logLine: '>> RETURN REJECTED — ITEM NOT FOUND IN CARGO.' };
    },
    [updateAccount],
  );

  const stageStashItemToPreRunCargo = useCallback(
    (itemId: CargoItemId): { success: boolean; logLine: string } => {
      let success = false;
      updateAccount((prev) => {
        const result = stageStashItemToCargoContainment(
          prev.resourceStash,
          prev.hubCraftedConsumables,
          prev.preRunCargo,
          itemId,
        );
        if (!result) return prev;
        success = true;
        return {
          ...prev,
          resourceStash: result.resourceStash,
          hubCraftedConsumables: result.hubCraftedConsumables,
          preRunCargo: result.cargo,
        };
      });
      const label = itemId.replace(/-/g, ' ').toUpperCase();
      return success
        ? { success: true, logLine: `>> STASH → PACK — ${label} STAGED FOR PLACEMENT.` }
        : { success: false, logLine: '>> STAGING REJECTED — STASH EMPTY OR ITEM UNAVAILABLE.' };
    },
    [updateAccount],
  );

  const returnAllPreRunContainmentToStash = useCallback(() => {
    updateAccount((prev) => {
      if (prev.preRunCargo.containment.length === 0) return prev;
      const result = applyReturnAllPreRunContainmentToStash(
        prev.resourceStash,
        prev.hubCraftedConsumables,
        prev.preRunCargo,
      );
      return {
        ...prev,
        resourceStash: result.resourceStash,
        hubCraftedConsumables: result.hubCraftedConsumables,
        preRunCargo: result.cargo,
      };
    });
  }, [updateAccount]);

  const equipTacticalSlot = useCallback(
    (slotIndex: 0 | 1 | 2, itemId: CargoItemId): { success: boolean; logLine: string } => {
      let success = false;
      updateAccount((prev) => {
        const result = equipTacticalFromHub(
          prev.hubCraftedConsumables,
          prev.tacticalLoadout,
          slotIndex,
          itemId,
        );
        if (!result) return prev;
        success = true;
        return {
          ...prev,
          hubCraftedConsumables: result.hubCraftedConsumables,
          tacticalLoadout: result.tacticalLoadout,
        };
      });
      return success
        ? { success: true, logLine: `>> TACTICAL SLOT ${slotIndex + 1} ARMED — ${itemId.replace(/-/g, ' ').toUpperCase()}.` }
        : { success: false, logLine: '>> TACTICAL EQUIP REJECTED — CONSUMABLE NOT IN STAGING.' };
    },
    [updateAccount],
  );

  const clearTacticalSlot = useCallback(
    (slotIndex: 0 | 1 | 2) => {
      updateAccount((prev) => {
        const result = clearTacticalSlotState(
          prev.hubCraftedConsumables,
          prev.tacticalLoadout,
          slotIndex,
        );
        return {
          ...prev,
          hubCraftedConsumables: result.hubCraftedConsumables,
          tacticalLoadout: result.tacticalLoadout,
        };
      });
    },
    [updateAccount],
  );

  const equipRunItemLoadoutSlot = useCallback(
    (
      slotType: 'COMBAT' | 'FIELD',
      slotIndex: 0 | 1,
      itemId: CargoItemId,
    ): { success: boolean; logLine: string } => {
      let success = false;
      updateAccount((prev) => {
        const result = equipRunItemFromHub(
          prev.hubCraftedConsumables,
          prev.runItemLoadout,
          slotType,
          slotIndex,
          itemId,
        );
        if (!result) return prev;
        success = true;
        return {
          ...prev,
          hubCraftedConsumables: result.hubCraftedConsumables,
          runItemLoadout: result.runItemLoadout,
        };
      });
      return success
        ? {
          success: true,
          logLine: `>> RUN ITEM SLOT ARMED — ${itemId.replace(/-/g, ' ').toUpperCase()}.`,
        }
        : { success: false, logLine: '>> RUN ITEM EQUIP REJECTED — CHECK STASH AND SLOT TYPE.' };
    },
    [updateAccount],
  );

  const clearRunItemLoadoutSlot = useCallback(
    (slotType: 'COMBAT' | 'FIELD', slotIndex: 0 | 1) => {
      updateAccount((prev) => {
        const result = clearRunItemLoadoutSlotState(
          prev.hubCraftedConsumables,
          prev.runItemLoadout,
          slotType,
          slotIndex,
        );
        return {
          ...prev,
          hubCraftedConsumables: result.hubCraftedConsumables,
          runItemLoadout: result.runItemLoadout,
        };
      });
    },
    [updateAccount],
  );

  const purchaseHubContraband = useCallback(
    (cargoId: CargoItemId, discountPct = 0): { success: boolean; logLine: string } => {
      let success = false;
      updateAccount((prev) => {
        const result = applyHubContrabandPurchase(
          prev.cabalCredits,
          prev.hubCraftedConsumables,
          cargoId,
          discountPct,
        );
        if (!result) return prev;
        success = true;
        return {
          ...prev,
          cabalCredits: result.cabalCredits,
          hubCraftedConsumables: result.hubCraftedConsumables,
        };
      });
      return success
        ? { success: true, logLine: `>> CONTRABAND ACQUIRED — ${cargoId.replace(/-/g, ' ').toUpperCase()} STAGED.` }
        : { success: false, logLine: '>> PURCHASE REJECTED — INSUFFICIENT CABAL CREDITS.' };
    },
    [updateAccount],
  );

  const sellFenceResource = useCallback(
    (resourceId: FenceableResourceId, quantity = 1): { success: boolean; logLine: string } => {
      let creditsEarned = 0;
      updateAccount((prev) => {
        const result = applyFenceSale(prev.resourceStash, prev.cabalCredits, resourceId, quantity);
        if (!result) return prev;
        creditsEarned = result.creditsEarned;
        return {
          ...prev,
          resourceStash: result.stash,
          cabalCredits: result.cabalCredits,
          careerEconomyTelemetry: applyCareerFenceSale(
            prev.careerEconomyTelemetry,
            quantity,
            result.creditsEarned,
          ),
        };
      });
      return creditsEarned > 0
        ? { success: true, logLine: `>> FENCE PAYOUT — +${creditsEarned} CABAL CREDITS.` }
        : { success: false, logLine: '>> SALE REJECTED — INSUFFICIENT STASH QUANTITY.' };
    },
    [updateAccount],
  );

  const commitDescentLoadout = useCallback((): { cargo: CargoRunState; runItems: RunItemsSlotState } => {
    const returned = applyReturnAllPreRunContainmentToStash(
      account.resourceStash,
      account.hubCraftedConsumables,
      account.preRunCargo,
    );
    const cargo = finalizeDescentLoadout(returned.cargo, account.tacticalLoadout);
    const runItems = finalizeDescentRunItems(account.runItemLoadout);
    updateAccount((prev) => ({
      ...prev,
      resourceStash: returned.resourceStash,
      hubCraftedConsumables: returned.hubCraftedConsumables,
      preRunCargo: createDefaultCargoRunState(),
      tacticalLoadout: createDefaultTacticalLoadout(),
      runItemLoadout: createDefaultRunItemsSlotState(),
    }));
    return { cargo, runItems };
  }, [
    account.hubCraftedConsumables,
    account.preRunCargo,
    account.resourceStash,
    account.runItemLoadout,
    account.tacticalLoadout,
    updateAccount,
  ]);

  const persistRunBankedSnapshot = useCallback(
    (bank: RunPhysicalBankSnapshot) => {
      updateAccount((prev) => ({
        ...prev,
        ...depositPhysicalBankSnapshot(bank, prev),
      }));
    },
    [updateAccount],
  );

  const persistRunExtraction = useCallback(
    (payload: {
      cargo: CargoRunState;
      aegisLoadout: AegisLoadout;
      hexShotLoadout: HexShotLoadout;
      envoyLoadout: EnvoyLoadout;
      sessionVeilResidueCollected?: number;
      veilResidueCollected?: number;
      excludeResourceIds?: ReadonlySet<ResourceItemId>;
    }) => {
      const sessionCollected = payload.sessionVeilResidueCollected ?? payload.veilResidueCollected ?? 0;
      const { totalDeposit, cargoForStash } = resolveExtractionVeilResidueDeposit(
        payload.cargo,
        sessionCollected,
      );
      updateAccount((prev) => {
        const deposited = depositAllCargoToHubAccount(cargoForStash, prev, {
          aegisLoadout: payload.aegisLoadout,
          hexShotLoadout: payload.hexShotLoadout,
          envoyLoadout: payload.envoyLoadout,
        }, {
          excludeResourceIds: payload.excludeResourceIds,
        });
        return {
          ...prev,
          resourceStash: deposited.resourceStash,
          hubCraftedConsumables: deposited.hubCraftedConsumables,
          aegisLoadout: normalizeAegisLoadout(deposited.aegisLoadout),
          hexShotLoadout: normalizeHexShotLoadoutForCommit(deposited.hexShotLoadout),
          envoyLoadout: normalizeEnvoyLoadoutForCommit(deposited.envoyLoadout),
          veilResidueBalance: prev.veilResidueBalance + totalDeposit,
        };
      });
    },
    [updateAccount],
  );

  const applyPostRunCargoRouting = useCallback(
    (payload: {
      decisions: CargoRoutingDecision[];
      routingState: PostRunRoutingDebriefState;
      autoStashAlreadyDeposited?: boolean;
      keepsakeRuntime?: import('../types/expeditionKeepsake').KeepsakeRuntime | null;
      routingAppraisalCount?: number;
    }) => {
      let result = null as ReturnType<typeof applyCargoRoutingDecisions> | null;
      let finalResult = null as import('../types/postRunCargoRouting').CargoRoutingResult | null;
      updateAccount((prev) => {
        const applied = applyCargoRoutingDecisions({
          decisions: payload.decisions,
          items: payload.routingState.pendingItems,
          autoStashed: payload.autoStashAlreadyDeposited ? {} : payload.routingState.autoStashed,
          stash: prev.resourceStash,
          cabalCredits: prev.cabalCredits,
          operationContributionPerStack: payload.routingState.operationContributionPerStack,
          keepsakeRuntime: payload.keepsakeRuntime ?? null,
          routingContext: payload.routingState.routingContext,
        });
        result = applied;

        let mergedResult = applied.result;
        let mergedStash = applied.stash;
        let mergedCredits = applied.cabalCredits;

        const secondaryItems = buildSecondaryRoutingPendingItems(
          applied.result.generatedSpecialResources,
          payload.routingState.routingContext,
          payload.routingState.bribeOfferSeed,
        );
        if (secondaryItems.length > 0) {
          const secondaryDecisions = buildDefaultRoutingDecisions(secondaryItems);
          const secondaryApplied = applyCargoRoutingDecisions({
            decisions: secondaryDecisions,
            items: secondaryItems,
            autoStashed: {},
            stash: mergedStash,
            cabalCredits: mergedCredits,
            operationContributionPerStack: payload.routingState.operationContributionPerStack,
            keepsakeRuntime: payload.keepsakeRuntime ?? null,
            routingContext: payload.routingState.routingContext,
          });
          mergedResult = mergeCargoRoutingResults(mergedResult, secondaryApplied.result);
          mergedStash = secondaryApplied.stash;
          mergedCredits = secondaryApplied.cabalCredits;
        }

        const sealedStacks = syncSealedStacksAfterRouting(
          prev,
          mergedStash,
          payload.routingState.pendingItems,
          mergedResult,
          payload.routingState.sealedAppraisalByItemKey,
        );

        const discoveryUpdate = markDiscoveriesFromStashDelta(
          prev.resourceDiscovery,
          prev.resourceStash,
          mergedStash,
        );

        const fencedUnits = Object.values(mergedResult.fenced ?? {}).reduce(
          (sum, n) => sum + (n ?? 0),
          0,
        );
        const fenceCredits = mergedResult.creditsFromFence ?? 0;

        finalResult = mergedResult;

        return {
          ...prev,
          resourceStash: mergedStash,
          cabalCredits: mergedCredits,
          sealedCargoStacks: sealedStacks,
          resourceDiscovery: discoveryUpdate.state,
          careerEconomyTelemetry: fencedUnits > 0
            ? applyCareerFenceSale(prev.careerEconomyTelemetry, fencedUnits, fenceCredits)
            : prev.careerEconomyTelemetry,
          careerSealedCargo: incrementCareerSealedFromRouting(
            prev.careerSealedCargo ?? createDefaultCareerSealedCargoStats(),
            mergedResult,
            payload.routingAppraisalCount ?? 0,
          ),
        };
      });
      if (!result || !finalResult) {
        throw new Error('Post-run cargo routing failed to apply.');
      }
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        const integrityIssues = validateCargoRoutingResultIntegrity(
          payload.routingState.pendingItems,
          payload.decisions,
          finalResult,
        );
        if (integrityIssues.length > 0) {
          console.warn(formatPostRunCargoRoutingValidationReport(integrityIssues));
        }
      }
      return finalResult;
    },
    [updateAccount],
  );

  const appraiseSealedCargoInHub = useCallback(
    (stackId: string): { success: boolean; logLine: string } => {
      let logLine = '>> APPRAISAL FAILED — STACK NOT FOUND.';
      updateAccount((prev) => {
        const action = appraiseSealedCargoInStash(prev, stackId);
        if (!action.ok || !action.accountPatch) return prev;
        logLine = action.logLine ?? logLine;
        return { ...prev, ...action.accountPatch };
      });
      return { success: logLine.includes('APPRAISED'), logLine };
    },
    [updateAccount],
  );

  const openSealedCargoInHub = useCallback(
    (stackId: string): { success: boolean; logLine: string } => {
      let logLine = '>> OPEN FAILED — STACK NOT FOUND.';
      updateAccount((prev) => {
        const action = openSealedCargoInStash(prev, stackId);
        if (!action.ok || !action.accountPatch) return prev;
        logLine = action.logLine ?? logLine;
        return { ...prev, ...action.accountPatch };
      });
      return { success: logLine.includes('CASKET OPENED'), logLine };
    },
    [updateAccount],
  );

  const sellSealedCargoInHub = useCallback(
    (stackId: string): { success: boolean; logLine: string } => {
      let logLine = '>> SALE FAILED — STACK NOT FOUND.';
      updateAccount((prev) => {
        const action = sellSealedCargoInStash(prev, stackId);
        if (!action.ok || !action.accountPatch) return prev;
        logLine = action.logLine ?? logLine;
        return { ...prev, ...action.accountPatch };
      });
      return { success: logLine.includes('SOLD SEALED'), logLine };
    },
    [updateAccount],
  );

  const grantSealedCasketInHub = useCallback(
    (quantity = 1) => {
      updateAccount((prev) => debugGrantSealedCasket(prev, quantity));
    },
    [updateAccount],
  );

  const grantSpecimenJarInHub = useCallback(
    (quantity = 1) => {
      updateAccount((prev) => debugGrantSpecimenJar(prev, quantity));
    },
    [updateAccount],
  );

  const grantExpansionResourcesInHub = useCallback(() => {
    updateAccount((prev) => debugGrantExpansionResources(prev));
  }, [updateAccount]);

  const debugGrantEconomyResourcesInHub = useCallback((mode: EconomyGrantMode, quantity = 8) => {
    let logLine = '';
    updateAccount((prev) => {
      const result = debugGrantEconomyResources(prev, mode, quantity);
      const discoveryUpdate = markDiscoveriesFromStashDelta(
        prev.resourceDiscovery,
        prev.resourceStash,
        result.account.resourceStash,
      );
      logLine = result.logLine;
      return {
        ...result.account,
        resourceDiscovery: discoveryUpdate.state,
      };
    });
    appendHubLog(logLine);
    return logLine;
  }, [appendHubLog, updateAccount]);

  const debugClearEconomyStashInHub = useCallback(() => {
    let logLine = '';
    updateAccount((prev) => {
      const result = debugClearResourceStash(prev);
      logLine = result.logLine;
      return result.account;
    });
    appendHubLog(logLine);
    return logLine;
  }, [appendHubLog, updateAccount]);

  const debugUnlockAllEconomySectorsInHub = useCallback(() => {
    let logLine = '';
    updateAccount((prev) => {
      const result = debugUnlockAllSectors(prev);
      logLine = result.logLine;
      return result.account;
    });
    appendHubLog(logLine);
    return logLine;
  }, [appendHubLog, updateAccount]);

  const debugDiscoverAllResourcesInHub = useCallback(() => {
    const state = debugDiscoverAllEconomyResources();
    updateAccount((prev) => ({ ...prev, resourceDiscovery: state }));
    const logLine = `>> DEBUG DISCOVERY — marked all economy resources discovered.`;
    appendHubLog(logLine);
    return logLine;
  }, [appendHubLog, updateAccount]);

  const debugClearResourceDiscoveryInHub = useCallback(() => {
    updateAccount((prev) => ({
      ...prev,
      resourceDiscovery: debugClearResourceDiscovery(),
    }));
    const logLine = '>> DEBUG DISCOVERY — cleared resource discovery state.';
    appendHubLog(logLine);
    return logLine;
  }, [appendHubLog, updateAccount]);

  const logProgressionProfile = useCallback((): string => {
    const report = formatProgressionProfileReport(getAccountProgressionProfile(account));
    report.split('\n').forEach((line) => {
      if (line.trim()) appendHubLog(line);
    });
    return report;
  }, [account, appendHubLog]);

  const logProgressionUnlockCatalog = useCallback((): string => {
    const report = formatProgressionUnlockCatalogReport(getAccountProgressionProfile(account));
    report.split('\n').forEach((line) => {
      if (line.trim()) appendHubLog(line);
    });
    return report;
  }, [account, appendHubLog]);

  const debugGrantProgressionUnlockId = useCallback((unlockId: string) => {
    let logLine = '';
    updateAccount((prev) => {
      const result = debugGrantProgressionUnlock(prev, unlockId);
      logLine = result.logLine;
      return result.account;
    });
    appendHubLog(logLine);
  }, [appendHubLog, updateAccount]);

  const debugSetRunnerClearanceRank = useCallback((rank: number) => {
    let logLine = '';
    updateAccount((prev) => {
      const result = debugSetRunnerClearance(prev, rank);
      logLine = result.logLine;
      return result.account;
    });
    appendHubLog(logLine);
  }, [appendHubLog, updateAccount]);

  const debugUnlockProgressionSector = useCallback((sectorId: SectorId) => {
    let logLine = '';
    updateAccount((prev) => {
      const result = debugUnlockSector(prev, sectorId);
      logLine = result.logLine;
      return result.account;
    });
    appendHubLog(logLine);
  }, [appendHubLog, updateAccount]);

  const debugUnlockProgressionBreachGrade = useCallback((grade: BreachGradeId) => {
    let logLine = '';
    updateAccount((prev) => {
      const result = debugUnlockBreachGrade(prev, grade);
      logLine = result.logLine;
      return result.account;
    });
    appendHubLog(logLine);
  }, [appendHubLog, updateAccount]);

  const debugResetProgression = useCallback(() => {
    let logLine = '';
    updateAccount((prev) => {
      const result = debugResetProgressionProfile(prev);
      logLine = result.logLine;
      return result.account;
    });
    appendHubLog(logLine);
  }, [appendHubLog, updateAccount]);

  const tryGrantProgressionUnlock = useCallback((unlockId: string): { success: boolean; logLine: string } => {
    let logLine = '';
    let success = false;
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const result = grantProgressionUnlock(profile, unlockId);
      success = result.applied.length > 0;
      logLine = success
        ? `>> PROGRESSION — granted ${unlockId}.`
        : `>> PROGRESSION — could not grant ${unlockId} (${result.skipped[0]?.reason ?? 'blocked'}).`;
      return withProgressionProfile(prev, result.profile);
    });
    appendHubLog(logLine);
    return { success, logLine };
  }, [appendHubLog, updateAccount]);

  const applyRunnerClearanceFromRun = useCallback((input: {
    runOutcome: 'EXTRACTED' | 'FAILED';
    extractionKind?: ContractExtractionKind;
    depthReached: number;
    contractSucceeded?: boolean;
    breachGrade?: import('../types/progression').BreachGradeId;
  }): { xpGained: number; ranksGained: number; newRank: number; logLines: string[] } => {
    let summary = {
      xpGained: 0,
      ranksGained: 0,
      newRank: 1,
      logLines: [] as string[],
    };
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const result = applyRunnerClearanceFromDebrief(profile, input);
      summary = {
        xpGained: result.xpGained,
        ranksGained: result.ranksGained,
        newRank: result.newRank,
        logLines: result.logLines,
      };
      return withProgressionProfile(prev, result.profile);
    });
    summary.logLines.forEach((line) => appendHubLog(line));
    return summary;
  }, [appendHubLog, updateAccount]);

  const debugGrantRunnerClearanceXpAmount = useCallback((xpAmount: number): string => {
    let report = '';
    let logLine = '';
    updateAccount((prev) => {
      const result = debugGrantRunnerClearanceXp(prev, xpAmount);
      logLine = result.logLine;
      report = result.report;
      return result.account;
    });
    appendHubLog(logLine);
    return report;
  }, [appendHubLog, updateAccount]);

  const activateSectorAccessMandateFn = useCallback((sectorId: SectorId): { ok: boolean; logLine: string } => {
    let ok = false;
    let logLine = '';
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const result = activateSectorAccessMandate(profile, sectorId);
      ok = result.ok;
      logLine = result.logLine;
      return withProgressionProfile(prev, result.profile);
    });
    appendHubLog(logLine);
    return { ok, logLine };
  }, [appendHubLog, updateAccount]);

  const applySectorAccessFromRun = useCallback((input: {
    extractedSuccessfully: boolean;
    extracted: ResourceQuantity;
    lostOnDeath: ResourceQuantity;
    runSectorId?: SectorId | null;
  }): { unlockedSectorIds: SectorId[]; unlockLines: string[]; logLines: string[] } => {
    let summary = {
      unlockedSectorIds: [] as SectorId[],
      unlockLines: [] as string[],
      logLines: [] as string[],
    };
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const result = resolveSectorAccessFromRun(profile, input);
      summary = {
        unlockedSectorIds: result.unlockedSectorIds,
        unlockLines: result.unlockLines,
        logLines: result.logLines,
      };
      return withProgressionProfile(prev, refreshSectorMandateAvailability(result.profile));
    });
    summary.logLines.forEach((line) => appendHubLog(line));
    return summary;
  }, [appendHubLog, updateAccount]);

  const applyBreachGradeClearFromRun = useCallback((input: {
    extractedSuccessfully: boolean;
    sectorId?: SectorId | null;
    breachGrade?: BreachGradeId;
  }): { updated: boolean; logLine: string | null } => {
    if (!input.extractedSuccessfully || !input.sectorId || !input.breachGrade) {
      return { updated: false, logLine: null };
    }
    let updated = false;
    let logLine: string | null = null;
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const result = recordSectorHighestGradeCleared(
        profile,
        input.sectorId!,
        input.breachGrade!,
      );
      updated = result.updated;
      if (result.updated) {
        const name = veilBiomeDisplayName(sectorIdToVeilBiome(input.sectorId!));
        const nextHigh = result.profile.sectors[input.sectorId!]?.highestGradeCleared ?? null;
        logLine = nextHigh && nextHigh !== result.previous
          ? `>> BREACH GRADE — ${name.toUpperCase()} CLEARED ${formatBreachGradeLabel(nextHigh, true).toUpperCase()}`
          : `>> SECTOR MASTERY — ${name.toUpperCase()} +XP // ${formatBreachGradeLabel(input.breachGrade!, true).toUpperCase()} EXTRACT`;
      }
      return withProgressionProfile(prev, result.profile);
    });
    if (logLine) appendHubLog(logLine);
    return { updated, logLine };
  }, [appendHubLog, updateAccount]);

  const pinProgressionGoalId = useCallback((goalDefId: string): { ok: boolean; logLine: string } => {
    let ok = false;
    let logLine = '';
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const result = pinProgressionGoal(profile, goalDefId);
      ok = result.ok;
      logLine = result.logLine;
      return withProgressionProfile(prev, result.profile);
    });
    appendHubLog(logLine);
    return { ok, logLine };
  }, [appendHubLog, updateAccount]);

  const unpinProgressionGoalId = useCallback((goalDefId: string): { ok: boolean; logLine: string } => {
    let ok = false;
    let logLine = '';
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const result = unpinProgressionGoal(profile, goalDefId);
      ok = result.ok;
      logLine = result.logLine;
      return withProgressionProfile(prev, result.profile);
    });
    appendHubLog(logLine);
    return { ok, logLine };
  }, [appendHubLog, updateAccount]);

  const syncPinnedGoalsFromRun = useCallback((): {
    statuses: PinnedGoalStatus[];
    completed: PinnedGoalStatus[];
    logLines: string[];
  } => {
    let summary = {
      statuses: [] as PinnedGoalStatus[],
      completed: [] as PinnedGoalStatus[],
      logLines: [] as string[],
    };
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const result = syncPinnedGoalsAfterRun(profile);
      summary = {
        statuses: result.statuses,
        completed: result.completed,
        logLines: result.logLines,
      };
      return withProgressionProfile(prev, result.profile);
    });
    summary.logLines.forEach((line) => appendHubLog(line));
    return summary;
  }, [appendHubLog, updateAccount]);

  const listPinableProgressionGoals = useCallback(() => {
    return listAvailableGoalsToPin(getAccountProgressionProfile(account));
  }, [account]);

  const getPinnedGoalStatuses = useCallback(() => {
    return evaluateAllPinnedGoals(getAccountProgressionProfile(account));
  }, [account]);

  const debugGrantRecipeGoalUnlock = useCallback((recipeId: string): string => {
    let report = '';
    updateAccount((prev) => {
      const result = discoverRecipeSchematic(getAccountProgressionProfile(prev), recipeId);
      report = result.discovered
        ? `Discovered Known schematic: ${result.label}`
        : `Already Known / missing: ${result.label}`;
      return withProgressionProfile(prev, result.profile);
    });
    appendHubLog(`>> DEBUG — RECIPE KNOWN ${recipeId}`);
    return report;
  }, [appendHubLog, updateAccount]);

  const syncRecipeVisibilityFromStash = useCallback((): {
    newlyKnown: string[];
    logLines: string[];
  } => {
    let newlyKnown: string[] = [];
    updateAccount((prev) => {
      const result = syncRecipeDiscoveriesFromStash(
        getAccountProgressionProfile(prev),
        prev,
      );
      newlyKnown = result.newlyKnown;
      return withProgressionProfile(prev, result.profile);
    });
    const logLines = newlyKnown.map(
      (label) => `>> SCHEMATIC KNOWN — ${label.toUpperCase()}`,
    );
    logLines.forEach((line) => appendHubLog(line));
    return { newlyKnown, logLines };
  }, [appendHubLog, updateAccount]);

  const discoverRecipeSchematicId = useCallback((recipeId: string): {
    discovered: boolean;
    logLine: string;
  } => {
    let discovered = false;
    let label = recipeId;
    updateAccount((prev) => {
      const result = discoverRecipeSchematic(getAccountProgressionProfile(prev), recipeId);
      discovered = result.discovered;
      label = result.label;
      return withProgressionProfile(prev, result.profile);
    });
    const logLine = discovered
      ? `>> SCHEMATIC KNOWN — ${label.toUpperCase()}`
      : `>> SCHEMATIC — ${label.toUpperCase()} ALREADY KNOWN OR MISSING`;
    appendHubLog(logLine);
    return { discovered, logLine };
  }, [appendHubLog, updateAccount]);

  const logRecipeVisibilityReport = useCallback((): string => {
    return formatRecipeVisibilityReport(
      getAccountProgressionProfile(account),
      account,
    );
  }, [account]);

  const applyClassRankFromRun = useCallback((input: {
    classId?: ClassType;
    runOutcome: 'EXTRACTED' | 'FAILED';
    depthReached: number;
    contractSucceeded?: boolean;
    breachGrade?: BreachGradeId;
  }): ClassRankApplyResult => {
    let summary: ClassRankApplyResult = {
      profile: getAccountProgressionProfile(account),
      classId: input.classId ?? account.activeClass,
      xpGained: 0,
      ranksGained: 0,
      previousRank: 1,
      newRank: 1,
      previousXp: 0,
      newXp: 0,
      hooksGranted: [],
      logLines: [],
    };
    updateAccount((prev) => {
      const classId = input.classId ?? prev.activeClass;
      const profile = getAccountProgressionProfile(prev);
      const result = applyClassRankFromDebrief(profile, classId, {
        runOutcome: input.runOutcome,
        depthReached: input.depthReached,
        contractSucceeded: input.contractSucceeded,
        breachGrade: input.breachGrade,
      });
      summary = result;
      return withProgressionProfile(prev, result.profile);
    });
    summary.logLines.forEach((line) => appendHubLog(line));
    return summary;
  }, [account, appendHubLog, updateAccount]);

  const applyCabalRepFromRun = useCallback((input: {
    contractSucceeded: boolean;
    reputationAwarded: number;
    sponsorId: FactionType;
    breachGrade?: BreachGradeId;
  }): CabalRepApplyResult => {
    let summary: CabalRepApplyResult = {
      profile: getAccountProgressionProfile(account),
      cabalId: input.sponsorId,
      repGained: 0,
      tiersGained: 0,
      previousTier: 0,
      newTier: 0,
      previousXp: 0,
      newXp: 0,
      cappedByGrade: false,
      maxTierAllowed: maxCabalTierForBreachGrade(input.breachGrade),
      hooksGranted: [],
      logLines: [],
      legacyRepDelta: 0,
    };
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const result = applyCabalRepFromDebrief(profile, input);
      summary = result;
      return withProgressionProfile(prev, result.profile);
    });
    summary.logLines.forEach((line) => appendHubLog(line));
    return summary;
  }, [account, appendHubLog, updateAccount]);

  const debugGrantClassRankXpAmount = useCallback((classId: ClassType, xpAmount: number): string => {
    let report = '';
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const forced = applyClassRankXp(profile, classId, xpAmount);
      report = [
        `${classId} +${forced.xpGained} XP → Rank ${forced.newRank}`,
        ...forced.logLines,
        `Hooks: ${forced.hooksGranted.join(', ') || 'none'}`,
      ].join('\n');
      return withProgressionProfile(prev, forced.profile);
    });
    appendHubLog(`>> DEBUG — CLASS XP ${classId} +${xpAmount}`);
    return report;
  }, [appendHubLog, updateAccount]);

  const debugGrantCabalRepXpAmount = useCallback((
    cabalId: FactionType,
    xpAmount: number,
    breachGrade: BreachGradeId = 'I',
  ): string => {
    let report = '';
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const forced = applyCabalRepXp(profile, cabalId, xpAmount, breachGrade);
      report = [
        `${cabalId} +${forced.repGained} XP → Tier ${forced.newTier} (cap ${forced.maxTierAllowed})`,
        ...forced.logLines,
        `Hooks: ${forced.hooksGranted.join(', ') || 'none'}`,
      ].join('\n');
      const nextAccount = withProgressionProfile(prev, forced.profile);
      return {
        ...nextAccount,
        sponsorReputation: {
          ...nextAccount.sponsorReputation,
          [cabalId]: (nextAccount.sponsorReputation[cabalId] ?? 0) + forced.legacyRepDelta,
        },
      };
    });
    appendHubLog(`>> DEBUG — CABAL REP ${cabalId} +${xpAmount} @ GRADE ${breachGrade}`);
    return report;
  }, [appendHubLog, updateAccount]);

  const logClassCabalHookCatalog = useCallback((): string => {
    return [
      '=== CLASS RANK HOOKS (PHASE 1F) ===',
      formatClassRankHookCatalog('AEGIS'),
      '',
      '=== CABAL TIER HOOKS (PHASE 1F) ===',
      formatCabalTierHookCatalog('TERRAN_GRID'),
    ].join('\n');
  }, []);

  const logFailureRecoveryReport = useCallback((): string => {
    return formatFailureRecoveryReport(getAccountProgressionProfile(account));
  }, [account]);

  const debugSetRouteIntelFailCountForSector = useCallback((
    sectorId: SectorId,
    failCount: number,
  ): string => {
    let report = '';
    updateAccount((prev) => {
      const profile = getAccountProgressionProfile(prev);
      const next = debugSetRouteIntelFailCount(profile, sectorId, failCount);
      report = formatFailureRecoveryReport(next);
      return withProgressionProfile(prev, next);
    });
    const line = `>> DEBUG — ROUTE INTEL FAILS ${sectorId} = ${failCount} (boost@${FAILURE_RECOVERY_TUNING.boostFailCount} / guarantee@${FAILURE_RECOVERY_TUNING.guaranteeFailCount})`;
    appendHubLog(line);
    return `${line}\n\n${report}`;
  }, [appendHubLog, updateAccount]);

  const simulateProgressionEconomyRuns = useCallback((runCount = 100, seed?: string): string => {
    const result = simulateProgressionCareer({
      runCount,
      seed: seed ?? `devtest:${Date.now()}`,
      classId: account.activeClass,
      sponsorId: account.alignedFaction ?? 'TERRAN_GRID',
    });
    return [
      formatProgressionEconomySimulationReport(result),
      '',
      formatProgressionPacingScorecard(result),
    ].join('\n');
  }, [account.activeClass, account.alignedFaction]);

  const logProgressionPacingScorecard = useCallback((runCount = 100): string => {
    const result = simulateProgressionCareer({
      runCount,
      seed: `pacing:${Date.now()}`,
      classId: account.activeClass,
      sponsorId: account.alignedFaction ?? 'TERRAN_GRID',
    });
    return [
      formatProgressionPacingTargetsReport(),
      '',
      formatProgressionPacingScorecard(result),
    ].join('\n');
  }, [account.activeClass, account.alignedFaction]);

  const logProgressionEconomyAudit = useCallback((): string => {
    return formatProgressionAuditReport(getAccountProgressionProfile(account));
  }, [account]);

  const logProgressionPerRunPreviewFn = useCallback((): string => {
    return formatProgressionPerRunPreview({
      depth: 2,
      breachGrade: 'II',
      classId: account.activeClass,
      sponsorId: account.alignedFaction ?? 'TERRAN_GRID',
    });
  }, [account.activeClass, account.alignedFaction]);

  const recordCareerBalanceTelemetry = useCallback((
    telemetry: RunBalanceTelemetry,
    economy?: {
      run: import('../types/economyRunTelemetry').EconomyRunTelemetry;
      ledger: import('../types/runResourceLedger').RunResourceLedger;
    },
  ) => {
    updateAccount((prev) => {
      let next = {
        ...prev,
        careerBalanceHistory: pushCareerBalanceRun(
          prev.careerBalanceHistory ?? createDefaultCareerBalanceHistory(),
          careerEntryFromTelemetry(telemetry),
        ),
      };
      if (economy) {
        const finalizedRun = finalizeUnstableCarryDuration(economy.run);
        next = {
          ...next,
          careerEconomyTelemetry: finalizeCareerEconomyFromRun(
            prev.careerEconomyTelemetry,
            finalizedRun,
            economy.ledger,
            { contractCompleted: telemetry.contractCompleted },
          ),
        };
      } else if (telemetry.contractCompleted) {
        next = {
          ...next,
          careerEconomyTelemetry: applyCareerContractCompleted(prev.careerEconomyTelemetry),
        };
      }
      return next;
    });
  }, [updateAccount]);

  const applyBetrayalConsequences = useCallback(
    (payload: {
      contractResult: import('../types/contract').ContractResult;
      routingResult: import('../types/postRunCargoRouting').CargoRoutingResult;
      routingState: PostRunRoutingDebriefState;
      decisions: CargoRoutingDecision[];
      runId?: string;
      playerClass?: import('../types/game').ClassType;
      depthReached?: number;
    }) => {
      updateAccount((prev) => {
        const contract = payload.routingState.activeContract;
        const betrayalEvents = contract
          ? buildBetrayalEventsFromRouting({
            items: payload.routingState.pendingItems,
            decisions: payload.decisions,
            routingResult: payload.routingResult,
            contract,
            context: {
              runId: payload.runId,
              playerClass: payload.playerClass ?? prev.activeClass,
              depthReached: payload.depthReached ?? payload.routingState.contractProgress.highestDepthReached,
            },
          })
          : [];

        const contractBetrayed = payload.contractResult.betrayalSeverity === 'HARD_BETRAYAL'
          || payload.contractResult.betrayalSeverity === 'SOFT_BETRAYAL';

        const withConsequences = applyBetrayalConsequencesToAccount(
          prev,
          payload.contractResult,
          payload.routingResult,
          betrayalEvents,
        );

        return {
          ...withConsequences,
          careerCargoRouting: incrementCareerCargoRoutingFromResult(
            withConsequences.careerCargoRouting,
            payload.routingResult,
            contractBetrayed,
          ),
        };
      });
    },
    [updateAccount],
  );

  const transferVeilResidueIntoRun = useCallback(
    (amount: number) => {
      const transfer = Math.max(0, Math.floor(amount));
      if (transfer <= 0) return;
      updateAccount((prev) => ({
        ...prev,
        veilResidueBalance: Math.max(0, prev.veilResidueBalance - transfer),
      }));
    },
    [updateAccount],
  );

  const restoreVeilResidueBaseline = useCallback(
    (amount: number) => {
      const restore = Math.max(0, Math.floor(amount));
      if (restore <= 0) return;
      updateAccount((prev) => ({
        ...prev,
        veilResidueBalance: prev.veilResidueBalance + restore,
      }));
    },
    [updateAccount],
  );

  const depositVeilResidueBalance = useCallback(
    (amount: number): number => {
      const deposit = Math.max(0, Math.floor(amount));
      if (deposit <= 0) return 0;
      updateAccount((prev) => ({
        ...prev,
        veilResidueBalance: prev.veilResidueBalance + deposit,
      }));
      return deposit;
    },
    [updateAccount],
  );

  const applyShadowWarDonationAccount = useCallback(
    (nextStash: ResourceQuantity, nextVeilResidueBalance: number) => {
      updateAccount((prev) => ({
        ...prev,
        resourceStash: { ...nextStash },
        veilResidueBalance: Math.max(0, nextVeilResidueBalance),
      }));
    },
    [updateAccount],
  );

  const getStashCapacitySnapshot = useCallback(
    () => ({
      used: calculateStashUsed(account.resourceStash),
      max: HUB_STASH_CAPACITY,
    }),
    [account.resourceStash],
  );

  const replaceResourceStash = useCallback(
    (stash: ResourceQuantity) => {
      updateAccount((prev) => ({ ...prev, resourceStash: { ...stash } }));
    },
    [updateAccount],
  );

  const decryptUnidentifiedItem = useCallback(
    async (instanceId: string): Promise<string[]> => {
      const item = account.unidentifiedStash.find((entry) => entry.instanceId === instanceId);
      if (!item || item.state === 'REVEALED') {
        return ['>> DECRYPTION REJECTED — CONTAINER NOT FOUND.'];
      }
      const costRecipe = {
        id: 'decrypt',
        label: 'Decrypt',
        kind: 'CONSUMABLE' as const,
        outputId: item.templateId,
        requirements: DECRYPTION_COST[item.templateId],
      };
      if (!canAffordRecipe(account.resourceStash, costRecipe)) {
        return ['>> DECRYPTION REJECTED — INSUFFICIENT ECHO-GLASS SHARDS.'];
      }
      const nextStash = deductRecipeFromStash(account.resourceStash, costRecipe);
      if (!nextStash) {
        return ['>> DECRYPTION REJECTED — STASH DEDUCTION FAILED.'];
      }

      const outcome = rollDecryptionLoot(item.templateId, [], instanceId);
      const logLines = ['>> DECRYPTING...', outcome.logLine];

      updateAccount((prev) => {
        let next: PlayerAccount = {
          ...prev,
          resourceStash: nextStash,
          unidentifiedStash: prev.unidentifiedStash.filter((entry) => entry.instanceId !== instanceId),
        };
        if (outcome.kind === 'RESOURCES') {
          outcome.bundle.items.forEach(({ id, quantity }) => {
            next.resourceStash[id] = (next.resourceStash[id] ?? 0) + quantity;
          });
        } else if (outcome.kind === 'CREDITS') {
          next = { ...next, cabalCredits: next.cabalCredits + outcome.amount };
        }
        return next;
      });

      return logLines;
    },
    [account.resourceStash, account.unidentifiedStash, updateAccount],
  );

  const value = useMemo(
    () => ({
      account,
      isHydrated,
      hubLog,
      commitFactionAlignment,
      addCredits,
      addRiftIron,
      grantContractRewards,
      addExperience,
      equipInventoryItem,
      decryptTier1Cache,
      appendHubLog,
      clearHubLog,
      getEquippedWeaponItem,
      getWeaponCombatStats,
      resetAccount,
      unlockRegionalWeaponCoating,
      setMetropolitanNode,
      depositBankedCargo,
      setAegisLoadout,
      setHexShotLoadout,
      setEnvoyLoadout,
      setActiveClass,
      cycleActiveClass,
      unlockAegisAbility,
      unlockHexShotAbility,
      unlockEnvoyAbility,
      craftRecipe,
      depositResourceStash,
      addLockedContainer,
      decryptUnidentifiedItem,
      equipWeaponFamily,
      unlockWeaponFamilyAccount,
      upgradeWeaponFamilyTier,
      unlockAllWeaponFamilies,
      resetWeaponFamilies,
      grantWeaponUnlockResources,
      setEquippedKeepsake,
      setKeepsakeAttunement,
      setKeepsakeRouteDoctrine,
      setKeepsakeMirrorCategory,
      unlockAllKeepsakes,
      relocatePreRunCargoItem,
      loadStashResourceToCargo,
      loadStashItemToCargoAtCell,
      returnPreRunCargoToStash,
      stageStashItemToPreRunCargo,
      returnAllPreRunContainmentToStash,
      equipTacticalSlot,
      clearTacticalSlot,
      equipRunItemLoadoutSlot,
      clearRunItemLoadoutSlot,
      purchaseHubContraband,
      sellFenceResource,
      commitDescentLoadout,
      persistRunExtraction,
      applyPostRunCargoRouting,
      recordCareerBalanceTelemetry,
      applyBetrayalConsequences,
      persistRunBankedSnapshot,
      depositVeilResidueBalance,
      transferVeilResidueIntoRun,
      restoreVeilResidueBaseline,
      applyShadowWarDonationAccount,
      getStashCapacitySnapshot,
      replaceResourceStash,
      appraiseSealedCargoInHub,
      openSealedCargoInHub,
      sellSealedCargoInHub,
      grantSealedCasketInHub,
      grantSpecimenJarInHub,
      grantExpansionResourcesInHub,
      debugGrantEconomyResourcesInHub,
      debugClearEconomyStashInHub,
      debugUnlockAllEconomySectorsInHub,
      debugDiscoverAllResourcesInHub,
      debugClearResourceDiscoveryInHub,
      logProgressionProfile,
      logProgressionUnlockCatalog,
      debugGrantProgressionUnlockId,
      debugSetRunnerClearanceRank,
      debugUnlockProgressionSector,
      debugUnlockProgressionBreachGrade,
      debugResetProgression,
      tryGrantProgressionUnlock,
      applyRunnerClearanceFromRun,
      debugGrantRunnerClearanceXpAmount,
      activateSectorAccessMandate: activateSectorAccessMandateFn,
      applySectorAccessFromRun,
      applyBreachGradeClearFromRun,
      pinProgressionGoalId,
      unpinProgressionGoalId,
      syncPinnedGoalsFromRun,
      listPinableProgressionGoals,
      getPinnedGoalStatuses,
      debugGrantRecipeGoalUnlock,
      syncRecipeVisibilityFromStash,
      discoverRecipeSchematicId,
      logRecipeVisibilityReport,
      applyClassRankFromRun,
      applyCabalRepFromRun,
      debugGrantClassRankXpAmount,
      debugGrantCabalRepXpAmount,
      logClassCabalHookCatalog,
      logFailureRecoveryReport,
      debugSetRouteIntelFailCountForSector,
      simulateProgressionEconomyRuns,
      logProgressionPacingScorecard,
      logProgressionEconomyAudit,
      logProgressionPerRunPreview: logProgressionPerRunPreviewFn,
    }),
    [
      account,
      isHydrated,
      hubLog,
      commitFactionAlignment,
      addCredits,
      addRiftIron,
      grantContractRewards,
      addExperience,
      equipInventoryItem,
      decryptTier1Cache,
      appendHubLog,
      clearHubLog,
      getEquippedWeaponItem,
      getWeaponCombatStats,
      resetAccount,
      unlockRegionalWeaponCoating,
      setMetropolitanNode,
      depositBankedCargo,
      setAegisLoadout,
      setHexShotLoadout,
      setEnvoyLoadout,
      setActiveClass,
      cycleActiveClass,
      unlockAegisAbility,
      unlockHexShotAbility,
      unlockEnvoyAbility,
      craftRecipe,
      depositResourceStash,
      addLockedContainer,
      decryptUnidentifiedItem,
      equipWeaponFamily,
      unlockWeaponFamilyAccount,
      upgradeWeaponFamilyTier,
      unlockAllWeaponFamilies,
      resetWeaponFamilies,
      grantWeaponUnlockResources,
      setEquippedKeepsake,
      setKeepsakeAttunement,
      setKeepsakeRouteDoctrine,
      setKeepsakeMirrorCategory,
      unlockAllKeepsakes,
      relocatePreRunCargoItem,
      loadStashResourceToCargo,
      loadStashItemToCargoAtCell,
      returnPreRunCargoToStash,
      stageStashItemToPreRunCargo,
      returnAllPreRunContainmentToStash,
      equipTacticalSlot,
      clearTacticalSlot,
      equipRunItemLoadoutSlot,
      clearRunItemLoadoutSlot,
      purchaseHubContraband,
      sellFenceResource,
      commitDescentLoadout,
      persistRunExtraction,
      applyPostRunCargoRouting,
      recordCareerBalanceTelemetry,
      applyBetrayalConsequences,
      persistRunBankedSnapshot,
      depositVeilResidueBalance,
      transferVeilResidueIntoRun,
      restoreVeilResidueBaseline,
      applyShadowWarDonationAccount,
      getStashCapacitySnapshot,
      replaceResourceStash,
      appraiseSealedCargoInHub,
      openSealedCargoInHub,
      sellSealedCargoInHub,
      grantSealedCasketInHub,
      grantSpecimenJarInHub,
      grantExpansionResourcesInHub,
      debugGrantEconomyResourcesInHub,
      debugClearEconomyStashInHub,
      debugUnlockAllEconomySectorsInHub,
      debugDiscoverAllResourcesInHub,
      debugClearResourceDiscoveryInHub,
      logProgressionProfile,
      logProgressionUnlockCatalog,
      debugGrantProgressionUnlockId,
      debugSetRunnerClearanceRank,
      debugUnlockProgressionSector,
      debugUnlockProgressionBreachGrade,
      debugResetProgression,
      tryGrantProgressionUnlock,
      applyRunnerClearanceFromRun,
      debugGrantRunnerClearanceXpAmount,
      activateSectorAccessMandateFn,
      applySectorAccessFromRun,
      applyBreachGradeClearFromRun,
      pinProgressionGoalId,
      unpinProgressionGoalId,
      syncPinnedGoalsFromRun,
      listPinableProgressionGoals,
      getPinnedGoalStatuses,
      debugGrantRecipeGoalUnlock,
      syncRecipeVisibilityFromStash,
      discoverRecipeSchematicId,
      logRecipeVisibilityReport,
      applyClassRankFromRun,
      applyCabalRepFromRun,
      debugGrantClassRankXpAmount,
      debugGrantCabalRepXpAmount,
      logClassCabalHookCatalog,
      logFailureRecoveryReport,
      debugSetRouteIntelFailCountForSector,
      simulateProgressionEconomyRuns,
      logProgressionPacingScorecard,
      logProgressionEconomyAudit,
      logProgressionPerRunPreviewFn,
    ],
  );

  return (
    <PlayerAccountContext.Provider value={value}>{children}</PlayerAccountContext.Provider>
  );
}

export function usePlayerAccount() {
  const context = useContext(PlayerAccountContext);
  if (!context) {
    throw new Error('usePlayerAccount must be used within a PlayerAccountProvider');
  }
  return context;
}

export type { ClassType, FactionType, PlayerAccount, ResolvedWeaponCombatStats };
