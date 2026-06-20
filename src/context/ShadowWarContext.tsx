import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collectActiveShadowWarBuffs,
  createDefaultShadowWarState,
  executeDonationUpload,
  maybeResolveWeeklyCycle,
} from '../data/shadowWarEngine';
import type { FactionType } from '../types/game';
import type { ResourceQuantity } from '../types/resourceItem';
import type {
  ShadowWarDonationDraft,
  ShadowWarPersistedState,
  ShadowWarSectorId,
} from '../types/shadowWar';
import type { ShadowWarBuffId } from '../types/shadowWar';
import { usePlayerAccount } from './PlayerAccountContext';

const STORAGE_KEY = '@veil_incursion/shadow_war_v1';

interface ShadowWarContextType {
  state: ShadowWarPersistedState;
  isHydrated: boolean;
  activeBuffs: ShadowWarBuffId[];
  donateToSector: (
    sectorId: ShadowWarSectorId,
    faction: FactionType,
    operativeName: string,
    stash: ResourceQuantity,
    draft: ShadowWarDonationDraft,
  ) => Promise<{ success: boolean; logLine: string; nextStash?: ResourceQuantity }>;
  refreshCycleIfNeeded: (
    playerFaction: FactionType | null,
  ) => Promise<{ logs: string[]; creditGrant: number; resourceGrants: Partial<Record<string, number>> }>;
}

const ShadowWarContext = createContext<ShadowWarContextType | undefined>(undefined);

function mergeStoredState(parsed: Partial<ShadowWarPersistedState>): ShadowWarPersistedState {
  const defaults = createDefaultShadowWarState();
  return {
    ...defaults,
    ...parsed,
    sectorIp: { ...defaults.sectorIp, ...parsed.sectorIp },
    donationLog: parsed.donationLog ?? defaults.donationLog,
  };
}

export function ShadowWarProvider({ children }: { children: React.ReactNode }) {
  const { account, isHydrated: accountHydrated } = usePlayerAccount();
  const [state, setState] = useState<ShadowWarPersistedState>(createDefaultShadowWarState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [playerFaction, setPlayerFaction] = useState<FactionType | null>(null);

  useEffect(() => {
    if (!accountHydrated) return;
    setPlayerFaction(account.alignedFaction);
  }, [accountHydrated, account.alignedFaction]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            setState(mergeStoredState(JSON.parse(raw)));
          } catch {
            setState(createDefaultShadowWarState());
          }
        }
        setIsHydrated(true);
      })
      .catch(() => {
        if (mounted) setIsHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, isHydrated]);

  const refreshCycleIfNeeded = useCallback(async (faction: FactionType | null) => {
    setPlayerFaction(faction);
    let result = { logs: [] as string[], creditGrant: 0, resourceGrants: {} as Partial<Record<string, number>> };
    setState((prev) => {
      const resolved = maybeResolveWeeklyCycle(prev, faction);
      result = {
        logs: resolved.cycleLogs,
        creditGrant: resolved.creditGrant,
        resourceGrants: resolved.resourceGrants,
      };
      return resolved.state;
    });
    return result;
  }, []);

  const donateToSector = useCallback(
    async (
      sectorId: ShadowWarSectorId,
      faction: FactionType,
      operativeName: string,
      stash: ResourceQuantity,
      draft: ShadowWarDonationDraft,
    ) => {
      const outcome = executeDonationUpload(state, stash, sectorId, faction, operativeName, draft);
      if (!outcome) {
        return { success: false, logLine: '>> UPLOAD REJECTED — INVALID STASH OR ZERO IP YIELD.' };
      }
      setState(outcome.nextState);
      return {
        success: true,
        logLine: outcome.logLine,
        nextStash: outcome.nextStash,
      };
    },
    [state],
  );

  const activeBuffs = useMemo(
    () => collectActiveShadowWarBuffs(state.sectorIp, playerFaction),
    [state.sectorIp, playerFaction],
  );

  const value = useMemo(
    () => ({
      state,
      isHydrated,
      activeBuffs,
      donateToSector,
      refreshCycleIfNeeded,
    }),
    [state, isHydrated, activeBuffs, donateToSector, refreshCycleIfNeeded],
  );

  return <ShadowWarContext.Provider value={value}>{children}</ShadowWarContext.Provider>;
}

export function useShadowWar() {
  const ctx = useContext(ShadowWarContext);
  if (!ctx) throw new Error('useShadowWar must be used within ShadowWarProvider');
  return ctx;
}
