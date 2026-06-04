import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import ParryMatrixOverlay from '../components/combat/ParryMatrixOverlay';
import VectorSliceOverlay, { type SliceLineRender } from '../components/combat/VectorSliceOverlay';
import VectorSlicePing from '../components/combat/VectorSlicePing';

/** Serializable UI state — safe to store in React state. */
export interface CombatEnemyChromeUIState {
  slicePingVisible: boolean;
  slicePingReady: boolean;
  slicePingDisabled: boolean;
  parryVisible: boolean;
  parrySuccess: boolean;
  parryFailure: boolean;
  sliceVisible: boolean;
  sliceLines: SliceLineRender[];
  activeSliceIndex: number;
}

export interface CombatEnemyChromeHandlers {
  onSlicePing: () => void;
  onParryTap: () => void;
  parryShrinkScale: SharedValue<number> | null;
  slicePanHandlers: Record<string, unknown> | null;
}

/** Full snapshot from TacticalCombatHub bridge. */
export interface CombatEnemyChromeSnapshot extends CombatEnemyChromeUIState, CombatEnemyChromeHandlers {}

const noop = () => {};

const IDLE_UI: CombatEnemyChromeUIState = {
  slicePingVisible: false,
  slicePingReady: false,
  slicePingDisabled: true,
  parryVisible: false,
  parrySuccess: false,
  parryFailure: false,
  sliceVisible: false,
  sliceLines: [],
  activeSliceIndex: -1,
};

const IDLE_HANDLERS: CombatEnemyChromeHandlers = {
  onSlicePing: noop,
  onParryTap: noop,
  parryShrinkScale: null,
  slicePanHandlers: null,
};

function sliceLinesEqual(a: SliceLineRender[], b: SliceLineRender[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id
      || x.centerXRatio !== y.centerXRatio
      || x.centerYRatio !== y.centerYRatio
      || x.angleDeg !== y.angleDeg
      || x.isSliced !== y.isSliced
    ) {
      return false;
    }
  }
  return true;
}

function uiStateEqual(prev: CombatEnemyChromeUIState, next: CombatEnemyChromeUIState): boolean {
  return (
    prev.slicePingVisible === next.slicePingVisible
    && prev.slicePingReady === next.slicePingReady
    && prev.slicePingDisabled === next.slicePingDisabled
    && prev.parryVisible === next.parryVisible
    && prev.parrySuccess === next.parrySuccess
    && prev.parryFailure === next.parryFailure
    && prev.sliceVisible === next.sliceVisible
    && prev.activeSliceIndex === next.activeSliceIndex
    && sliceLinesEqual(prev.sliceLines, next.sliceLines)
  );
}

interface CombatEnemyChromeContextValue {
  ui: CombatEnemyChromeUIState;
  handlersRef: React.MutableRefObject<CombatEnemyChromeHandlers>;
  updateUI: (patch: Partial<CombatEnemyChromeUIState>) => void;
  resetUI: () => void;
}

const CombatEnemyChromeContext = createContext<CombatEnemyChromeContextValue | null>(null);

export function CombatEnemyChromeProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [ui, setUi] = useState<CombatEnemyChromeUIState>(IDLE_UI);
  const handlersRef = useRef<CombatEnemyChromeHandlers>(IDLE_HANDLERS);

  const updateUI = useCallback((patch: Partial<CombatEnemyChromeUIState>) => {
    setUi((prev) => {
      const next = { ...prev, ...patch };
      return uiStateEqual(prev, next) ? prev : next;
    });
  }, []);

  const resetUI = useCallback(() => {
    setUi(IDLE_UI);
    handlersRef.current = IDLE_HANDLERS;
  }, []);

  const value = useMemo(
    () => ({ ui, handlersRef, updateUI, resetUI }),
    [ui, updateUI, resetUI],
  );

  return (
    <CombatEnemyChromeContext.Provider value={value}>
      {children}
    </CombatEnemyChromeContext.Provider>
  );
}

export function useCombatEnemyChrome(): CombatEnemyChromeContextValue {
  const ctx = useContext(CombatEnemyChromeContext);
  if (!ctx) {
    throw new Error('useCombatEnemyChrome must be used within CombatEnemyChromeProvider');
  }
  return ctx;
}

export function useCombatEnemyChromeOptional(): CombatEnemyChromeContextValue | null {
  return useContext(CombatEnemyChromeContext);
}

/** Publishes chrome state from TacticalCombatHub (renders nothing). */
export function CombatChromeBridge(snapshot: CombatEnemyChromeSnapshot): null {
  const ctx = useCombatEnemyChromeOptional();

  const {
    slicePingVisible,
    slicePingReady,
    slicePingDisabled,
    onSlicePing,
    parryVisible,
    parryShrinkScale,
    parrySuccess,
    parryFailure,
    onParryTap,
    sliceVisible,
    sliceLines,
    activeSliceIndex,
    slicePanHandlers,
  } = snapshot;

  if (ctx) {
    ctx.handlersRef.current = {
      onSlicePing,
      onParryTap,
      parryShrinkScale,
      slicePanHandlers,
    };
  }

  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.updateUI({
      slicePingVisible,
      slicePingReady,
      slicePingDisabled,
      parryVisible,
      parrySuccess,
      parryFailure,
      sliceVisible,
      sliceLines,
      activeSliceIndex,
    });
  }, [
    ctx?.updateUI,
    slicePingVisible,
    slicePingReady,
    slicePingDisabled,
    parryVisible,
    parrySuccess,
    parryFailure,
    sliceVisible,
    sliceLines,
    activeSliceIndex,
  ]);

  return null;
}

/** Renders ping / parry / slice over the apparition viewport. */
export function CombatEnemyChromeLayer(): React.JSX.Element {
  const { ui, handlersRef } = useCombatEnemyChrome();
  const handlers = handlersRef.current;
  const {
    slicePingVisible,
    slicePingReady,
    slicePingDisabled,
    parryVisible,
    parrySuccess,
    parryFailure,
    sliceVisible,
    sliceLines,
    activeSliceIndex,
  } = ui;

  return (
    <View style={styles.layer} pointerEvents="box-none">
      {slicePingVisible ? (
        <VectorSlicePing
          ready={slicePingReady}
          disabled={slicePingDisabled}
          onPress={handlers.onSlicePing}
          anchored
        />
      ) : null}
      {parryVisible && handlers.parryShrinkScale ? (
        <ParryMatrixOverlay
          visible
          shrinkScale={handlers.parryShrinkScale}
          success={parrySuccess}
          failure={parryFailure}
          onTap={handlers.onParryTap}
        />
      ) : null}
      {sliceVisible && handlers.slicePanHandlers ? (
        <VectorSliceOverlay
          visible
          lines={sliceLines}
          activeIndex={activeSliceIndex}
          panHandlers={handlers.slicePanHandlers}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
  },
});
