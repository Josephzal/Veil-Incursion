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
import type { AegisLoadout } from '../types/aegisCombat';
import { DEFAULT_AEGIS_LOADOUT } from '../types/aegisCombat';
import { normalizeAegisLoadout } from '../utils/aegisLoadoutUtils';
import { createDefaultBankedCargo } from '../types/cargoGrid';
import type { GlobalBankedCargo } from '../types/cargoGrid';
import { MacroSectorId, RegionalPresenceState } from '../types/regional';
import { createEmptyResourceStash, canAffordRecipe, deductRecipeFromStash } from '../data/resourceStashEngine';
import { getCraftingRecipe } from '../data/craftingRegistry';
import type { ResourceQuantity } from '../types/resourceItem';
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
    unlockedClasses: ['AEGIS'],
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
    resourceStash: {
      'ley-slag': 6,
      'echo-glass-shard': 10,
      'sanguine-ampoule': 2,
      'legion-blood-iron': 2,
      'encrypted-grid-drive': 1,
    },
    unlockedBlueprints: [],
    equippedBlueprintId: null,
    unidentifiedStash: [],
  };
}

function mergeStoredAccount(parsed: Partial<PlayerAccount>): PlayerAccount {
  const defaults = createDefaultPlayerAccount();
  const inventory = mergeInventory(parsed.inventory);
  const equipped = getEquippedWeapon(inventory.items);
  return {
    ...defaults,
    ...parsed,
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
    aegisLoadout: normalizeAegisLoadout(parsed.aegisLoadout),
    resourceStash: {
      ...createEmptyResourceStash(),
      ...parsed.resourceStash,
    },
    unlockedBlueprints: parsed.unlockedBlueprints ?? defaults.unlockedBlueprints,
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
  craftRecipe: (recipeId: string) => { success: boolean; logLine: string };
  depositResourceStash: (delta: ResourceQuantity) => void;
  addLockedContainer: (templateId: UnidentifiedTemplateId) => void;
  decryptUnidentifiedItem: (instanceId: string) => Promise<string[]>;
  setEquippedBlueprint: (blueprintId: BlueprintId | null) => void;
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
      if (account.unlockedBlueprints.includes(recipe.outputId)) {
        return { success: false, logLine: `>> ${recipe.label.toUpperCase()} ALREADY UNLOCKED.` };
      }
      if (!canAffordRecipe(account.resourceStash, recipe)) {
        return { success: false, logLine: '>> FABRICATION REJECTED — INSUFFICIENT RESOURCES.' };
      }
      const nextStash = deductRecipeFromStash(account.resourceStash, recipe);
      if (!nextStash) {
        return { success: false, logLine: '>> FABRICATION REJECTED — STASH DEDUCTION FAILED.' };
      }
      updateAccount((prev) => {
        const nextBlueprints = [...prev.unlockedBlueprints, recipe.outputId];
        const shouldEquip = isBlueprintId(recipe.outputId)
          && blueprintForClass(prev.activeClass) === recipe.outputId;
        return {
          ...prev,
          resourceStash: nextStash,
          unlockedBlueprints: nextBlueprints,
          equippedBlueprintId: shouldEquip ? (recipe.outputId as BlueprintId) : prev.equippedBlueprintId,
        };
      });
      return {
        success: true,
        logLine: `>> FABRICATION COMPLETE — ${recipe.outputId.replace(/_/g, ' ').toUpperCase()} UNLOCKED.`,
      };
    },
    [account.resourceStash, account.unlockedBlueprints, updateAccount],
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

  const decryptUnidentifiedItem = useCallback(
    async (instanceId: string): Promise<string[]> => {
      const item = account.unidentifiedStash.find((entry) => entry.instanceId === instanceId);
      if (!item || item.state === 'REVEALED') {
        return ['>> DECRYPTION REJECTED — CONTAINER NOT FOUND.'];
      }
      const costRecipe = {
        id: 'decrypt',
        label: 'Decrypt',
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
      craftRecipe,
      depositResourceStash,
      addLockedContainer,
      decryptUnidentifiedItem,
      setEquippedBlueprint,
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
      craftRecipe,
      depositResourceStash,
      addLockedContainer,
      decryptUnidentifiedItem,
      setEquippedBlueprint,
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
