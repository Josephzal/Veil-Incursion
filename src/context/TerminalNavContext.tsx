import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { TerminalView } from '../types/terminalNav';

interface TerminalNavContextType {
  terminalView: TerminalView;
  setTerminalView: (view: TerminalView) => void;
}

const TerminalNavContext = createContext<TerminalNavContextType | undefined>(undefined);

export function TerminalNavProvider({ children }: { children: React.ReactNode }) {
  const [terminalView, setTerminalView] = useState<TerminalView>('BADGE');

  const value = useMemo(
    () => ({ terminalView, setTerminalView }),
    [terminalView],
  );

  return <TerminalNavContext.Provider value={value}>{children}</TerminalNavContext.Provider>;
}

export function useTerminalNav() {
  const ctx = useContext(TerminalNavContext);
  if (!ctx) {
    throw new Error('useTerminalNav must be used within TerminalNavProvider');
  }
  return ctx;
}

export function useTerminalNavOptional() {
  return useContext(TerminalNavContext);
}
