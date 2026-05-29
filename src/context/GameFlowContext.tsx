import React, { createContext, useContext, useMemo, useState } from 'react';
import { AppScreen } from '../types/gameFlow';

interface GameFlowContextType {
  currentScreen: AppScreen;
  goToWelcome: () => void;
  startScanning: () => void;
  startCombat: () => void;
}

const GameFlowContext = createContext<GameFlowContextType | undefined>(undefined);

export function GameFlowProvider({ children }: { children: React.ReactNode }) {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('WELCOME');

  const value = useMemo(
    () => ({
      currentScreen,
      goToWelcome: () => setCurrentScreen('WELCOME'),
      startScanning: () => setCurrentScreen('SCANNING'),
      startCombat: () => setCurrentScreen('COMBAT'),
    }),
    [currentScreen],
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
