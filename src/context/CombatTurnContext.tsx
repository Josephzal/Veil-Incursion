import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type CombatTurnPhase =
  | 'PLAYER_COMMAND'
  | 'ENEMY_WINDUP'
  | 'ENEMY_ACTION'
  | 'PARRY_WINDOW'
  | 'SLICE'
  | 'RESOLUTION';

export interface CombatTurnState {
  isPlayerTurn: boolean;
  phase: CombatTurnPhase;
  canUseCargo: boolean;
}

const DEFAULT_TURN_STATE: CombatTurnState = {
  isPlayerTurn: true,
  phase: 'PLAYER_COMMAND',
  canUseCargo: true,
};

interface CombatTurnContextValue extends CombatTurnState {
  setCombatTurnState: (state: CombatTurnState) => void;
}

const CombatTurnContext = createContext<CombatTurnContextValue | null>(null);

export function CombatTurnProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<CombatTurnState>(DEFAULT_TURN_STATE);

  const setCombatTurnState = useCallback((next: CombatTurnState) => {
    setState(next);
  }, []);

  const value = useMemo(
    () => ({ ...state, setCombatTurnState }),
    [setCombatTurnState, state],
  );

  return <CombatTurnContext.Provider value={value}>{children}</CombatTurnContext.Provider>;
}

export function useCombatTurn(): CombatTurnContextValue {
  const ctx = useContext(CombatTurnContext);
  if (!ctx) {
    throw new Error('useCombatTurn must be used within CombatTurnProvider');
  }
  return ctx;
}

export function useCombatTurnOptional(): CombatTurnContextValue | null {
  return useContext(CombatTurnContext);
}
