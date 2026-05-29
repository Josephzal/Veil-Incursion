import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AppScreen, ScanMode } from '../types/gameFlow';
import { EncounterType } from '../types/run';

interface GameFlowContextType {
  currentScreen: AppScreen;
  scanMode: ScanMode;
  goToWelcome: () => void;
  startScanning: (mode?: ScanMode) => void;
  startPathChoice: () => void;
  startPostCombatBoon: () => void;
  startSkillCheck: () => void;
  startRest: () => void;
  startCombat: () => void;
  startRunComplete: () => void;
  proceedToEncounter: (encounterType: EncounterType) => void;
}

const GameFlowContext = createContext<GameFlowContextType | undefined>(undefined);

export function GameFlowProvider({ children }: { children: React.ReactNode }) {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('WELCOME');
  const [scanMode, setScanMode] = useState<ScanMode>('INITIAL');

  const goToWelcome = useCallback(() => setCurrentScreen('WELCOME'), []);
  const startScanning = useCallback((mode: ScanMode = 'COMBAT_ENTRY') => {
    setScanMode(mode);
    setCurrentScreen('SCANNING');
  }, []);
  const startPathChoice = useCallback(() => setCurrentScreen('PATH_CHOICE'), []);
  const startPostCombatBoon = useCallback(() => setCurrentScreen('POST_COMBAT_BOON'), []);
  const startSkillCheck = useCallback(() => setCurrentScreen('SKILL_CHECK'), []);
  const startRest = useCallback(() => setCurrentScreen('REST'), []);
  const startCombat = useCallback(() => setCurrentScreen('COMBAT'), []);
  const startRunComplete = useCallback(() => setCurrentScreen('RUN_COMPLETE'), []);

  const proceedToEncounter = useCallback((encounterType: EncounterType) => {
    switch (encounterType) {
      case 'COMBAT':
        setScanMode('COMBAT_ENTRY');
        setCurrentScreen('SCANNING');
        break;
      case 'SKILL_CHECK':
        setCurrentScreen('SKILL_CHECK');
        break;
      case 'REST':
        setCurrentScreen('REST');
        break;
      default:
        break;
    }
  }, []);

  const value = useMemo(
    () => ({
      currentScreen,
      scanMode,
      goToWelcome,
      startScanning,
      startPathChoice,
      startPostCombatBoon,
      startSkillCheck,
      startRest,
      startCombat,
      startRunComplete,
      proceedToEncounter,
    }),
    [
      currentScreen,
      scanMode,
      goToWelcome,
      startScanning,
      startPathChoice,
      startPostCombatBoon,
      startSkillCheck,
      startRest,
      startCombat,
      startRunComplete,
      proceedToEncounter,
    ],
  );

  return (
    <GameFlowContext.Provider value={value}>
      {children}
    </GameFlowContext.Provider>
  );
}

export function useGameFlow() {
  const context = useContext(GameFlowContext);
  if (!context) {
    throw new Error('useGameFlow must be used within a GameFlowProvider');
  }
  return context;
}
