import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AppScreen } from '../types/gameFlow';
import { EncounterType } from '../types/run';
import { useTerminalNav } from './TerminalNavContext';

interface GameFlowContextType {
  currentScreen: AppScreen;
  combatEntryActive: boolean;
  completeCombatEntry: () => void;
  goToHub: () => void;
  openSafehouse: () => void;
  goToWelcome: () => void;
  startBoundRequisition: () => void;
  startScanning: () => void;
  startNarrative: () => void;
  startPostCombatBoon: () => void;
  startSkillCheck: () => void;
  startRest: () => void;
  startBlackMarket: () => void;
  startResourceHarvest: () => void;
  startExtractionReview: () => void;
  startCombat: () => void;
  startRunProgress: () => void;
  startRunComplete: () => void;
  startOperationDebrief: () => void;
  startSafehouse: () => void;
  startGameOver: () => void;
  deployEncounter: (encounterType: EncounterType) => void;
}

const GameFlowContext = createContext<GameFlowContextType | undefined>(undefined);

export function GameFlowProvider({ children }: { children: React.ReactNode }) {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('HUB');
  const [combatEntryActive, setCombatEntryActive] = useState(false);
  const { setTerminalView } = useTerminalNav();

  const goToHub = useCallback(() => setCurrentScreen('HUB'), []);
  const openSafehouse = useCallback(() => {
    setTerminalView('LOADOUT');
    setCurrentScreen('HUB');
  }, [setTerminalView]);
  const goToWelcome = useCallback(() => setCurrentScreen('WELCOME'), []);
  const startBoundRequisition = useCallback(() => setCurrentScreen('BOUND_REQUISITION'), []);
  const startScanning = useCallback(() => setCurrentScreen('SCANNING'), []);
  const startNarrative = useCallback(() => setCurrentScreen('NARRATIVE'), []);
  const startPostCombatBoon = useCallback(() => setCurrentScreen('POST_COMBAT_BOON'), []);
  const startSkillCheck = useCallback(() => setCurrentScreen('SKILL_CHECK'), []);
  const startRest = useCallback(() => setCurrentScreen('REST'), []);
  const startBlackMarket = useCallback(() => setCurrentScreen('BLACK_MARKET'), []);
  const startResourceHarvest = useCallback(() => setCurrentScreen('RESOURCE_HARVEST'), []);
  const startExtractionReview = useCallback(() => setCurrentScreen('EXTRACTION_REVIEW'), []);
  const startCombat = useCallback(() => setCombatEntryActive(true), []);
  const completeCombatEntry = useCallback(() => {
    setCurrentScreen('COMBAT');
    setCombatEntryActive(false);
  }, []);
  const startRunProgress = useCallback(() => setCurrentScreen('RUN_PROGRESS'), []);
  const startRunComplete = useCallback(() => setCurrentScreen('RUN_COMPLETE'), []);
  const startOperationDebrief = useCallback(() => setCurrentScreen('OPERATION_DEBRIEF'), []);
  const startSafehouse = useCallback(() => setCurrentScreen('SAFEHOUSE'), []);
  const startGameOver = useCallback(() => setCurrentScreen('GAME_OVER'), []);

  const deployEncounter = useCallback((encounterType: EncounterType) => {
    switch (encounterType) {
      case 'COMBAT':
        setCombatEntryActive(true);
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
      combatEntryActive,
      completeCombatEntry,
      goToHub,
      openSafehouse,
      goToWelcome,
      startBoundRequisition,
      startScanning,
      startNarrative,
      startPostCombatBoon,
      startSkillCheck,
      startRest,
      startBlackMarket,
      startResourceHarvest,
      startExtractionReview,
      startCombat,
      startRunProgress,
      startRunComplete,
      startOperationDebrief,
      startSafehouse,
      startGameOver,
      deployEncounter,
    }),
    [
      combatEntryActive,
      completeCombatEntry,
      currentScreen,
      goToHub,
      openSafehouse,
      goToWelcome,
      startBoundRequisition,
      startScanning,
      startNarrative,
      startPostCombatBoon,
      startSkillCheck,
      startRest,
      startBlackMarket,
      startResourceHarvest,
      startExtractionReview,
      startCombat,
      startRunProgress,
      startRunComplete,
      startOperationDebrief,
      startSafehouse,
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
