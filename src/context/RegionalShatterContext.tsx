import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getMacroSector, regionalCoatingSlotId } from '../data/macroSectors';
import { FactionType } from '../types/game';
import {
  CabalInfluenceBalance,
  MacroSectorId,
  ShatterSectorResult,
} from '../types/regional';
import { getVictoriousFaction } from '../types/theme';

interface RegionalShatterContextType {
  isInfluenceFrozen: boolean;
  frozenInfluence: CabalInfluenceBalance | null;
  frozenSectorId: MacroSectorId | null;
  shatterResults: ShatterSectorResult[];
  shatterFlashFaction: FactionType | null;
  forceRegionalShatterDecree: (
    sectorId: MacroSectorId,
    playerFaction: FactionType | null,
    onCoatingUnlock: (slotId: string) => void,
    appendLog: (line: string) => void,
  ) => void;
  clearShatterFlash: () => void;
}

const RegionalShatterContext = createContext<RegionalShatterContextType | undefined>(undefined);

export function RegionalShatterProvider({ children }: { children: React.ReactNode }) {
  const [isInfluenceFrozen, setIsInfluenceFrozen] = useState(false);
  const [frozenInfluence, setFrozenInfluence] = useState<CabalInfluenceBalance | null>(null);
  const [frozenSectorId, setFrozenSectorId] = useState<MacroSectorId | null>(null);
  const [shatterResults, setShatterResults] = useState<ShatterSectorResult[]>([]);
  const [shatterFlashFaction, setShatterFlashFaction] = useState<FactionType | null>(null);

  const forceRegionalShatterDecree = useCallback(
    (
      sectorId: MacroSectorId,
      playerFaction: FactionType | null,
      onCoatingUnlock: (slotId: string) => void,
      appendLog: (line: string) => void,
    ) => {
      const sector = getMacroSector(sectorId);
      const snapshot = { ...sector.influence };
      const victoriousFaction = getVictoriousFaction(snapshot);

      setIsInfluenceFrozen(true);
      setFrozenInfluence(snapshot);
      setFrozenSectorId(sectorId);
      setShatterFlashFaction(victoriousFaction);
      setShatterResults((prev) => [
        ...prev.filter((r) => r.sectorId !== sectorId),
        { sectorId, frozenInfluence: snapshot, victoriousFaction },
      ]);

      appendLog(`>> REGIONAL SHATTER DECREE EXECUTED — ${sector.label} INFLUENCE ARRAYS FROZEN.`);
      appendLog(
        `>> TERRAN ${snapshot.TERRAN_GRID}% // LEGION ${snapshot.LEGION}% // SOLARIS ${snapshot.SOLARIS}%`,
      );
      appendLog(`>> VICTORIOUS CABAL: ${victoriousFaction.replace('_', ' ')}`);

      if (playerFaction === victoriousFaction) {
        const slotId = regionalCoatingSlotId(sectorId, victoriousFaction);
        onCoatingUnlock(slotId);
        appendLog(`>> ALIGNED VICTORY — LOCALIZED WEAPON COATING SLOT UNLOCKED: ${slotId.toUpperCase()}`);
      } else if (playerFaction) {
        appendLog(`>> OPERATIVE CABAL DID NOT SECURE ${sector.label} — COATING SLOT WITHHELD.`);
      }
    },
    [],
  );

  const clearShatterFlash = useCallback(() => setShatterFlashFaction(null), []);

  const value = useMemo(
    () => ({
      isInfluenceFrozen,
      frozenInfluence,
      frozenSectorId,
      shatterResults,
      shatterFlashFaction,
      forceRegionalShatterDecree,
      clearShatterFlash,
    }),
    [
      isInfluenceFrozen,
      frozenInfluence,
      frozenSectorId,
      shatterResults,
      shatterFlashFaction,
      forceRegionalShatterDecree,
      clearShatterFlash,
    ],
  );

  return (
    <RegionalShatterContext.Provider value={value}>{children}</RegionalShatterContext.Provider>
  );
}

export function useRegionalShatter() {
  const ctx = useContext(RegionalShatterContext);
  if (!ctx) {
    throw new Error('useRegionalShatter must be used within RegionalShatterProvider');
  }
  return ctx;
}
