import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePlayerAccount } from './PlayerAccountContext';
import { useRegionalShatter } from './RegionalShatterContext';
import { CabalAlignment, OperativeProfile } from '../types';
import { FactionType } from '../types/game';
import { FACTION_THEMES, TerminalTheme, getTerminalTheme } from '../types/theme';
import { mockOperativeProfile } from './mockProfile';

interface TerminalContextType {
  alignment: CabalAlignment;
  theme: TerminalTheme;
  profile: OperativeProfile;
  shatterFlashActive: boolean;
  updateCabalAlignment: (cabal: CabalAlignment) => void;
  awardCurrencies: (glimmerAmt: number, tributeAmt: number) => void;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

function resolveActiveTheme(
  alignedFaction: FactionType | null,
  alignment: CabalAlignment,
  shatterFlashFaction: FactionType | null,
): TerminalTheme {
  if (shatterFlashFaction) return getTerminalTheme(shatterFlashFaction);
  if (alignedFaction) return getTerminalTheme(alignedFaction);
  return FACTION_THEMES[alignment];
}

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const { account } = usePlayerAccount();
  const { shatterFlashFaction } = useRegionalShatter();
  const [alignment, setAlignment] = useState<CabalAlignment>('TERRAN_GRID');
  const [profile, setProfile] = useState<OperativeProfile>(mockOperativeProfile);

  useEffect(() => {
    if (account.alignedFaction && account.alignedFaction !== alignment) {
      setAlignment(account.alignedFaction);
      setProfile((prev) => {
        if (prev.operative_profile.credentials.cabal_alignment === account.alignedFaction) return prev;
        return {
          ...prev,
          operative_profile: {
            ...prev.operative_profile,
            credentials: {
              ...prev.operative_profile.credentials,
              cabal_alignment: account.alignedFaction!,
            },
          },
        };
      });
    }
  }, [account.alignedFaction, alignment]);

  const updateCabalAlignment = useCallback((cabal: CabalAlignment) => {
    setAlignment((prev) => (prev === cabal ? prev : cabal));
    setProfile((prev) => {
      if (prev.operative_profile.credentials.cabal_alignment === cabal) return prev;
      return {
        ...prev,
        operative_profile: {
          ...prev.operative_profile,
          credentials: {
            ...prev.operative_profile.credentials,
            cabal_alignment: cabal,
          },
        },
      };
    });
  }, []);

  const awardCurrencies = useCallback((glimmerAmt: number, tributeAmt: number) => {
    setProfile((prev) => ({
      ...prev,
      operative_profile: {
        ...prev.operative_profile,
        payload_manifest: {
          ...prev.operative_profile.payload_manifest,
          currencies: {
            ...prev.operative_profile.payload_manifest.currencies,
            crypto_glimmer:
              prev.operative_profile.payload_manifest.currencies.crypto_glimmer + glimmerAmt,
            cabal_tributes:
              prev.operative_profile.payload_manifest.currencies.cabal_tributes + tributeAmt,
          },
        },
      },
    }));
  }, []);

  const theme = useMemo(
    () => resolveActiveTheme(account.alignedFaction, alignment, shatterFlashFaction),
    [account.alignedFaction, alignment, shatterFlashFaction],
  );

  const value = useMemo(
    () => ({
      alignment,
      theme,
      profile,
      shatterFlashActive: shatterFlashFaction != null,
      updateCabalAlignment,
      awardCurrencies,
    }),
    [alignment, theme, profile, shatterFlashFaction, updateCabalAlignment, awardCurrencies],
  );

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be utilized within a TerminalProvider');
  }
  return context;
}

export { FACTION_THEMES };
