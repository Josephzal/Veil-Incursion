import React, { createContext, useContext } from 'react';
import {
  useResponsiveLayout,
  type ResponsiveLayoutMetrics,
} from '../hooks/useResponsiveLayout';

const HubLayoutContext = createContext<ResponsiveLayoutMetrics | null>(null);

export function HubLayoutProvider({
  value,
  children,
}: {
  value: ResponsiveLayoutMetrics;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <HubLayoutContext.Provider value={value}>
      {children}
    </HubLayoutContext.Provider>
  );
}

/**
 * Hub grid metrics from TerminalHubLayout.
 * Falls back to useResponsiveLayout() outside the provider during migration.
 */
export function useHubLayout(): ResponsiveLayoutMetrics {
  const context = useContext(HubLayoutContext);
  const fallback = useResponsiveLayout();
  return context ?? fallback;
}
