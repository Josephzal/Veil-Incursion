import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AppScreen } from '../types/gameFlow';
import { EncounterType } from '../types/run';

interface GameFlowContextType {
  currentScreen: AppScreen;
  goToWelcome: () => void;
  startScanning: () => void;
  startPostCombatBoon: () => void;
  startSkillCheck: () => void;
  startRest: () => void;
  startCombat: () => void;
  startRunComplete: () => void;
  startGameOver: () => void;
  deployEncounter: (encounterType: EncounterType) => void;
}

const GameFlowContext = createContext<GameFlowContextType | undefined>(undefined);

export function GameFlowProvider({ children }: { children: React.ReactNode }) {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('WELCOME');

  const goToWelcome = useCallback(() => setCurrentScreen('WELCOME'), []);
  const startScanning = useCallback(() => setCurrentScreen('SCANNING'), []);
  const startPostCombatBoon = useCallback(() => setCurrentScreen('POST_COMBAT_BOON'), []);
  const startSkillCheck = useCallback(() => setCurrentScreen('SKILL_CHECK'), []);
  const startRest = useCallback(() => setCurrentScreen('REST'), []);
  const startCombat = useCallback(() => setCurrentScreen('COMBAT'), []);
  const startRunComplete = useCallback(() => setCurrentScreen('RUN_COMPLETE'), []);
  const startGameOver = useCallback(() => setCurrentScreen('GAME_OVER'), []);

  const deployEncounter = useCallback((encounterType: EncounterType) => {
    switch (encounterType) {
      case 'COMBAT':
        setCurrentScreen('COMBAT');
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
      goToWelcome,
      startScanning,
      startPostCombatBoon,
      startSkillCheck,
      startRest,
      startCombat,
      startRunComplete,
      startGameOver,
      deployEncounter,
    }),
    [
      currentScreen,
      goToWelcome,
      startScanning,
      startPostCombatBoon,
      startSkillCheck,
      startRest,
      startCombat,
      startRunComplete,
      startGameOver,
      deployEncounter,
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
