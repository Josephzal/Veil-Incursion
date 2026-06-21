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
  createDefaultTacticalLoadout,
  equipTacticalFromHub,
  finalizeDescentLoadout,
  HUB_STASH_CAPACITY,
  returnCargoItemToHubStash,
} from '../data/hubSafehouseEngine';
import { depositAllCargoToHubAccount } from '../data/extractionPersistenceEngine';
import { relocateCargoItem } from '../data/cargoGridEngine';
import { isResourceItemId } from '../data/resourceRegistry';
import type { FenceableResourceId, ResourceItemId } from '../types/resourceItem';
import { MacroSectorId, RegionalPresenceState } from '../types/regional';
import { createEmptyResourceStash, canAffordRecipe, deductRecipeFromStash } from '../data/resourceStashEngine';
import { getCraftingRecipe, isRecipeOutputOwned } from '../data/craftingRegistry';
import type { ResourceQuantity } from '../types/resourceItem';
import type { BoundRequisitionId } from '../types/boundRequisition';
import type { CargoItemId } from '../types/cargoGrid';
import { rollDecryptionLoot } from '../data/decryptionLootEngine';
import {
  blueprintForClass,
  isBlueprintId,
  type BlueprintId,
} from '../types/equipmentBlueprint';
import {
  DECRYPTION_COST,
  type UnidentifiedTemplateId,
} from '../types/unidentifiedItem';
import { createLockedContainer } from '../data/unidentifiedStashEngine';
import {
  DEFAULT_HOME_MACRO_SECTOR,
  DEFAULT_HOME_METROPOLITAN_NODE,
} from '../constants/homeSector';

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
  const equipped = getEquippedWeapon(inventory.items);
  return {
    id: `operative-${Date.now()}`,
    username: 'OPERATIVE-7741',
    operativeRank: 1,
    experiencePoints: 0,
    cabalCredits: 500,
    alignedFaction: null,
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
      weaponId: equipped?.id ?? 'dull-training-katana',
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
    resourceStash: {
      'ley-slag': 6,
      'echo-glass-shard': 10,
      'sanguine-ampoule': 2,
      'legion-blood-iron': 2,
      'encrypted-grid-drive': 1,
    },
    unlockedBlueprints: [],
    craftedAugments: [],
    hubCraftedConsumables: {},
    preRunCargo: createDefaultCargoRunState(),
    tacticalLoadout: createDefaultTacticalLoadout(),
    equippedBlueprintId: null,
    unidentifiedStash: [],
  };
}

function mergeStoredAccount(parsed: Partial<PlayerAccount>): PlayerAccount {
  const defaults = createDefaultPlayerAccount();
  const inventory = mergeInventory(parsed.inventory);
  const equipped = getEquippedWeapon(inventory.items);
  const classFields = normalizeClassAccountFields(parsed);
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
      ...parsed.equipment,
      weaponId: equipped?.id ?? parsed.equipment?.weaponId ?? defaults.equipment.weaponId,
    },
    inventory,
    bankedCargo: {
      ...createDefaultBankedCargo(),
      ...parsed.bankedCargo,
    },
    resourceStash: {
      ...createEmptyResourceStash(),
      ...parsed.resourceStash,
    },
    unlockedBlueprints: parsed.unlockedBlueprints ?? defaults.unlockedBlueprints,
    craftedAugments: parsed.craftedAugments ?? defaults.craftedAugments,
    hubCraftedConsumables: {
      ...defaults.hubCraftedConsumables,
      ...parsed.hubCraftedConsumables,
    },
    preRunCargo: parsed.preRunCargo ?? defaults.preRunCargo,
    tacticalLoadout: parsed.tacticalLoadout ?? defaults.tacticalLoadout,
    equippedBlueprintId: parsed.equippedBlueprintId ?? defaults.equippedBlueprintId,
    unidentifiedStash: parsed.unidentifiedStash ?? defaults.unidentifiedStash,
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
  addExperience: (amount: number) => void;
  equipInventoryItem: (itemId: string) => void;
  decryptTier1Cache: () => Promise<string[]>;
  appendHubLog: (text: string) => void;
  clearHubLog: () => void;
  getEquippedWeaponItem: () => InventoryItem | null;
  getWeaponCombatStats: () => ResolvedWeaponCombatStats;
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
  setEquippedBlueprint: (blueprintId: BlueprintId | null) => void;
  relocatePreRunCargoItem: (instanceId: string, row: number, col: number) => boolean;
  loadStashResourceToCargo: (resourceId: ResourceItemId) => { success: boolean; logLine: string };
  loadStashItemToCargoAtCell: (
    itemId: CargoItemId,
    row: number,
    col: number,
  ) => { success: boolean; logLine: string };
  returnPreRunCargoToStash: (instanceId: string) => { success: boolean; logLine: string };
  equipTacticalSlot: (slotIndex: 0 | 1 | 2, itemId: CargoItemId) => { success: boolean; logLine: string };
  clearTacticalSlot: (slotIndex: 0 | 1 | 2) => void;
  purchaseHubContraband: (cargoId: CargoItemId, discountPct?: number) => { success: boolean; logLine: string };
  sellFenceResource: (resourceId: FenceableResourceId, quantity?: number) => { success: boolean; logLine: string };
  commitDescentLoadout: () => CargoRunState;
  persistRunExtraction: (payload: {
    cargo: CargoRunState;
    aegisLoadout: AegisLoadout;
    hexShotLoadout: HexShotLoadout;
    envoyLoadout: EnvoyLoadout;
  }) => void;
  getStashCapacitySnapshot: () => { used: number; max: number };
  replaceResourceStash: (stash: ResourceQuantity) => void;
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

  const getWeaponCombatStats = useCallback((): ResolvedWeaponCombatStats => {
    const weapon = getEquippedWeapon(account.inventory.items);
    return resolveWeaponCombatStats(weapon?.modifiers ?? {}, weapon?.name ?? 'Standard Blade');
  }, [account.inventory.items]);

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
        const ownedBlueprint = blueprintForClass(classId);
        const canEquipBlueprint = ownedBlueprint != null && prev.unlockedBlueprints.includes(ownedBlueprint);
        appendHubLog(`>> CLASS MODULE LOCKED — ${getClassDisplayName(classId).toUpperCase()} ACTIVE.`);
        return {
          ...prev,
          activeClass: classId,
          equippedBlueprintId: canEquipBlueprint ? ownedBlueprint : null,
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
        const ownedBlueprint = blueprintForClass(nextClass);
        const canEquipBlueprint = ownedBlueprint != null && prev.unlockedBlueprints.includes(ownedBlueprint);
        appendHubLog(`>> CLASS MODULE LOCKED — ${getClassDisplayName(nextClass).toUpperCase()} ACTIVE.`);
        return {
          ...prev,
          activeClass: nextClass,
          equippedBlueprintId: canEquipBlueprint ? ownedBlueprint : null,
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
      if (
        recipe.kind !== 'CONSUMABLE'
        && isRecipeOutputOwned(
          recipe.outputId,
          account.unlockedBlueprints,
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

      updateAccount((prev) => {
        const base = { ...prev, resourceStash: nextStash };
        if (recipe.kind === 'LOADOUT') {
          const nextBlueprints = [...prev.unlockedBlueprints, recipe.outputId];
          const shouldEquip = isBlueprintId(recipe.outputId)
            && blueprintForClass(prev.activeClass) === recipe.outputId;
          return {
            ...base,
            unlockedBlueprints: nextBlueprints,
            equippedBlueprintId: shouldEquip
              ? (recipe.outputId as BlueprintId)
              : prev.equippedBlueprintId,
          };
        }
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

      if (recipe.kind === 'LOADOUT') {
        return {
          success: true,
          logLine: `>> FABRICATION COMPLETE — ${recipe.outputId.replace(/_/g, ' ').toUpperCase()} UNLOCKED.`,
        };
      }
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
      account.craftedAugments,
      account.resourceStash,
      account.unlockedBlueprints,
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

  const setEquippedBlueprint = useCallback(
    (blueprintId: BlueprintId | null) => {
      updateAccount((prev) => ({ ...prev, equippedBlueprintId: blueprintId }));
    },
    [updateAccount],
  );

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
        };
      });
      return creditsEarned > 0
        ? { success: true, logLine: `>> FENCE PAYOUT — +${creditsEarned} CABAL CREDITS.` }
        : { success: false, logLine: '>> SALE REJECTED — INSUFFICIENT STASH QUANTITY.' };
    },
    [updateAccount],
  );

  const commitDescentLoadout = useCallback((): CargoRunState => {
    const cargo = finalizeDescentLoadout(account.preRunCargo, account.tacticalLoadout);
    updateAccount((prev) => ({
      ...prev,
      preRunCargo: createDefaultCargoRunState(),
      tacticalLoadout: createDefaultTacticalLoadout(),
    }));
    return cargo;
  }, [account.preRunCargo, account.tacticalLoadout, updateAccount]);

  const persistRunExtraction = useCallback(
    (payload: {
      cargo: CargoRunState;
      aegisLoadout: AegisLoadout;
      hexShotLoadout: HexShotLoadout;
      envoyLoadout: EnvoyLoadout;
    }) => {
      updateAccount((prev) => {
        const deposited = depositAllCargoToHubAccount(payload.cargo, prev, {
          aegisLoadout: payload.aegisLoadout,
          hexShotLoadout: payload.hexShotLoadout,
          envoyLoadout: payload.envoyLoadout,
        });
        return {
          ...prev,
          resourceStash: deposited.resourceStash,
          hubCraftedConsumables: deposited.hubCraftedConsumables,
          aegisLoadout: normalizeAegisLoadout(deposited.aegisLoadout),
          hexShotLoadout: normalizeHexShotLoadoutForCommit(deposited.hexShotLoadout),
          envoyLoadout: normalizeEnvoyLoadoutForCommit(deposited.envoyLoadout),
        };
      });
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
        kind: 'LOADOUT' as const,
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

      const outcome = rollDecryptionLoot(item.templateId, account.unlockedBlueprints, instanceId);
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
        } else if (outcome.kind === 'GEAR' || outcome.kind === 'MASTERWORK') {
          if (!next.unlockedBlueprints.includes(outcome.blueprintId)) {
            next = {
              ...next,
              unlockedBlueprints: [...next.unlockedBlueprints, outcome.blueprintId],
            };
          }
          if (blueprintForClass(next.activeClass) === outcome.blueprintId) {
            next = { ...next, equippedBlueprintId: outcome.blueprintId };
          }
        } else if (outcome.kind === 'CREDITS') {
          next = { ...next, cabalCredits: next.cabalCredits + outcome.amount };
        }
        return next;
      });

      return logLines;
    },
    [account.resourceStash, account.unidentifiedStash, account.unlockedBlueprints, updateAccount],
  );

  const value = useMemo(
    () => ({
      account,
      isHydrated,
      hubLog,
      commitFactionAlignment,
      addCredits,
      addRiftIron,
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
      setEquippedBlueprint,
      relocatePreRunCargoItem,
      loadStashResourceToCargo,
      loadStashItemToCargoAtCell,
      returnPreRunCargoToStash,
      equipTacticalSlot,
      clearTacticalSlot,
      purchaseHubContraband,
      sellFenceResource,
      commitDescentLoadout,
      persistRunExtraction,
      getStashCapacitySnapshot,
      replaceResourceStash,
    }),
    [
      account,
      isHydrated,
      hubLog,
      commitFactionAlignment,
      addCredits,
      addRiftIron,
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
      setEquippedBlueprint,
      relocatePreRunCargoItem,
      loadStashResourceToCargo,
      loadStashItemToCargoAtCell,
      returnPreRunCargoToStash,
      equipTacticalSlot,
      clearTacticalSlot,
      purchaseHubContraband,
      sellFenceResource,
      commitDescentLoadout,
      persistRunExtraction,
      getStashCapacitySnapshot,
      replaceResourceStash,
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
