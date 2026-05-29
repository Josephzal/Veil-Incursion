import React, { createContext, useContext, useState } from 'react';
import { CabalAlignment, OperativeProfile } from '../types';
import { mockOperativeProfile } from './mockProfile';

export const FactionThemes = {
  TERRAN_GRID: {
    backgroundColor: '#1c1e21',
    primaryColor: '#ffffff',
    mutedColor: '#8a8f98',
    borderColor: '#3a3f47',
    bootLog: 'TERRAN_GRID_OS v9.1 // TACTICAL SECURE NODE // SYSTEMS LOCK',
  },
  LEGION: {
    backgroundColor: '#000000',
    primaryColor: '#a855f7',
    mutedColor: '#6b21a8',
    borderColor: '#4c1d95',
    bootLog: 'LEGION.NETWORK // OVERRIDING FREQUENCY // WE ARE MANY // LISTEN TO THE COLD',
  },
  SOLARIS: {
    backgroundColor: '#0b0c0d',
    primaryColor: '#ef4444',
    mutedColor: '#b91c1c',
    borderColor: '#eab308',
    bootLog: 'SOLARIS CORE // THERMAL ENERGY HARVEST // WARNING: KINETIC FRICTION AT CAPACITY',
  }
};

interface TerminalContextType {
  alignment: CabalAlignment;
  theme: typeof FactionThemes.TERRAN_GRID;
  profile: OperativeProfile;
  updateCabalAlignment: (cabal: CabalAlignment) => void;
  awardCurrencies: (glimmerAmt: number, tributeAmt: number) => void; // Added here to fix the type error
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [alignment, setAlignment] = useState<CabalAlignment>('TERRAN_GRID');
  const [profile, setProfile] = useState<OperativeProfile>(mockOperativeProfile);

  const updateCabalAlignment = (cabal: CabalAlignment) => {
    setAlignment(cabal);
    setProfile(prev => ({
      ...prev,
      operative_profile: {
        ...prev.operative_profile,
        credentials: {
          ...prev.operative_profile.credentials,
          cabal_alignment: cabal
        }
      }
    }));
  };

  const awardCurrencies = (glimmerAmt: number, tributeAmt: number) => {
    setProfile(prev => ({
      ...prev,
      operative_profile: {
        ...prev.operative_profile,
        payload_manifest: {
          ...prev.operative_profile.payload_manifest,
          currencies: {
            ...prev.operative_profile.payload_manifest.currencies,
            crypto_glimmer: prev.operative_profile.payload_manifest.currencies.crypto_glimmer + glimmerAmt,
            cabal_tributes: prev.operative_profile.payload_manifest.currencies.cabal_tributes + tributeAmt,
          }
        }
      }
    }));
  };

  const theme = FactionThemes[alignment];

  return (
    <TerminalContext.Provider value={{ alignment, theme, profile, updateCabalAlignment, awardCurrencies }}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be utilized within a TerminalProvider');
  }
  return context;
}