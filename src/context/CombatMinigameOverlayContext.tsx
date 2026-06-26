import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

interface CombatMinigameOverlayContextValue {
  overlays: React.ReactNode;
  isActive: boolean;
  setOverlays: (node: React.ReactNode) => void;
  setMinigameActive: (active: boolean) => void;
}

const CombatMinigameOverlayContext = createContext<CombatMinigameOverlayContextValue | null>(null);

export function CombatMinigameOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [overlays, setOverlays] = useState<React.ReactNode>(null);
  const [isActive, setMinigameActive] = useState(false);
  const value = useMemo(
    () => ({ overlays, isActive, setOverlays, setMinigameActive }),
    [overlays, isActive],
  );
  return (
    <CombatMinigameOverlayContext.Provider value={value}>
      {children}
    </CombatMinigameOverlayContext.Provider>
  );
}

export function useCombatMinigameOverlayOptional(): CombatMinigameOverlayContextValue | null {
  return useContext(CombatMinigameOverlayContext);
}

export function useCombatMinigameActive(): boolean {
  return useCombatMinigameOverlayOptional()?.isActive ?? false;
}

/** Sync hub minigame visibility into the full-viewport overlay host. */
export function CombatMinigameActiveBridge({ active }: { active: boolean }): null {
  const ctx = useCombatMinigameOverlayOptional();
  useLayoutEffect(() => {
    ctx?.setMinigameActive(active);
    return () => {
      ctx?.setMinigameActive(false);
    };
  }, [active, ctx]);
  return null;
}

/** Port class minigames from the hub into the full combat viewport host. */
export function CombatMinigameOverlaySink({
  children,
}: {
  children: React.ReactNode;
}): null {
  const ctx = useCombatMinigameOverlayOptional();
  useLayoutEffect(() => {
    ctx?.setOverlays(children);
    return () => {
      ctx?.setOverlays(null);
    };
  }, [children, ctx]);
  return null;
}

/** Covers arena + tactical dashboard — blocks terminal, intel, and ability chrome. */
export function CombatMinigameOverlayHost(): React.JSX.Element | null {
  const ctx = useCombatMinigameOverlayOptional();
  if (!ctx?.overlays || !ctx.isActive) return null;
  return (
    <View style={styles.host} pointerEvents="box-none">
      {ctx.overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
  },
});
