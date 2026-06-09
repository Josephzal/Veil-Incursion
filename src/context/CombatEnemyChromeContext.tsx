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
import ParrySuccessBurstOverlay from '../components/combat/ParrySuccessBurstOverlay';
import type { ParryArenaLayout } from '../utils/parryCollision';
import VectorSliceOverlay, { type SliceLineRender } from '../components/combat/VectorSliceOverlay';

/** Updated synchronously on perfect parry — avoids chrome-layer lag for success burst. */
export interface ParryBurstLiveState {
  active: boolean;
  arena: ParryArenaLayout | null;
  epoch: number;
}

/** Serializable UI state — safe to store in React state. */
export interface CombatEnemyChromeUIState {
  slicePingVisible: boolean;
  slicePingReady: boolean;
  slicePingDisabled: boolean;
  parryVisible: boolean;
  parrySuccess: boolean;
  parryFailure: boolean;
  parrySuccessBurstVisible: boolean;
  parryBurstArena: ParryArenaLayout | null;
  sliceVisible: boolean;
  sliceLines: SliceLineRender[];
  activeSliceIndex: number;
}

export interface CombatEnemyChromeHandlers {
  onSlicePing: () => void;
  onParryTap: (tapX: number, tapY: number) => void;
  registerParryArena: (layout: ParryArenaLayout) => void;
  registerSliceArena: (layout: { width: number; height: number }) => void;
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
  parrySuccessBurstVisible: false,
  parryBurstArena: null,
  sliceVisible: false,
  sliceLines: [],
  activeSliceIndex: -1,
};

const noopParryTap = (_x: number, _y: number) => {};
const noopRegisterArena = (_layout: ParryArenaLayout) => {};
const noopRegisterSliceArena = (_layout: { width: number; height: number }) => {};

const IDLE_HANDLERS: CombatEnemyChromeHandlers = {
  onSlicePing: noop,
  onParryTap: noopParryTap,
  registerParryArena: noopRegisterArena,
  registerSliceArena: noopRegisterSliceArena,
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
    && prev.parrySuccessBurstVisible === next.parrySuccessBurstVisible
    && prev.parryBurstArena?.cx === next.parryBurstArena?.cx
    && prev.parryBurstArena?.cy === next.parryBurstArena?.cy
    && prev.parryBurstArena?.baseR === next.parryBurstArena?.baseR
    && prev.sliceVisible === next.sliceVisible
    && prev.activeSliceIndex === next.activeSliceIndex
    && sliceLinesEqual(prev.sliceLines, next.sliceLines)
  );
}

interface CombatEnemyChromeContextValue {
  ui: CombatEnemyChromeUIState;
  handlersRef: React.MutableRefObject<CombatEnemyChromeHandlers>;
  parryBurstLiveRef: React.MutableRefObject<ParryBurstLiveState>;
  parryChromeTick: number;
  notifyParryChromeChange: () => void;
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
  const parryBurstLiveRef = useRef<ParryBurstLiveState>({
    active: false,
    arena: null,
    epoch: 0,
  });
  const [parryChromeTick, setParryChromeTick] = useState(0);
  const notifyParryChromeChange = useCallback(() => {
    setParryChromeTick((tick) => tick + 1);
  }, []);

  const updateUI = useCallback((patch: Partial<CombatEnemyChromeUIState>) => {
    setUi((prev) => {
      const next = { ...prev, ...patch };
      return uiStateEqual(prev, next) ? prev : next;
    });
  }, []);

  const resetUI = useCallback(() => {
    setUi(IDLE_UI);
    handlersRef.current = IDLE_HANDLERS;
    parryBurstLiveRef.current = { active: false, arena: null, epoch: 0 };
  }, []);

  const value = useMemo(
    () => ({
      ui,
      handlersRef,
      parryBurstLiveRef,
      parryChromeTick,
      notifyParryChromeChange,
      updateUI,
      resetUI,
    }),
    [ui, parryChromeTick, notifyParryChromeChange, updateUI, resetUI],
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
    parrySuccessBurstVisible,
    parryBurstArena,
    onParryTap,
    registerParryArena,
    registerSliceArena,
    sliceVisible,
    sliceLines,
    activeSliceIndex,
    slicePanHandlers,
  } = snapshot;

  if (ctx) {
    ctx.handlersRef.current = {
      onSlicePing,
      onParryTap,
      registerParryArena,
      registerSliceArena,
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
      parrySuccessBurstVisible,
      parryBurstArena,
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
    parrySuccessBurstVisible,
    parryBurstArena,
    sliceVisible,
    sliceLines,
    activeSliceIndex,
  ]);

  return null;
}

/** Renders ping / parry / slice over the apparition viewport. */
export function CombatEnemyChromeLayer(): React.JSX.Element {
  const { ui, handlersRef, parryBurstLiveRef, parryChromeTick } = useCombatEnemyChrome();
  void parryChromeTick;
  const {
    parryVisible,
    parrySuccess,
    parryFailure,
    parrySuccessBurstVisible,
    parryBurstArena,
    sliceVisible,
    sliceLines,
    activeSliceIndex,
  } = ui;
  const burstLive = parryBurstLiveRef.current;
  const showParryBurst = (burstLive.active && burstLive.arena != null)
    || (parrySuccessBurstVisible && parryBurstArena != null);
  const parryBurstLayout = burstLive.active && burstLive.arena != null
    ? burstLive.arena
    : parryBurstArena;
  const parryBurstKey = burstLive.epoch;

  return (
    <View style={styles.layer} pointerEvents="box-none" collapsable={false}>
      {parryVisible && handlersRef.current.parryShrinkScale ? (
        <ParryMatrixOverlay
          visible
          shrinkScale={handlersRef.current.parryShrinkScale}
          success={parrySuccess}
          failure={parryFailure}
          onTap={(tapX, tapY) => handlersRef.current.onParryTap(tapX, tapY)}
          onArenaLayout={(layout) => handlersRef.current.registerParryArena(layout)}
        />
      ) : null}
      {showParryBurst && parryBurstLayout ? (
        <ParrySuccessBurstOverlay
          key={parryBurstKey}
          burstEpoch={parryBurstKey}
          arena={parryBurstLayout}
        />
      ) : null}
      {sliceVisible && handlersRef.current.slicePanHandlers ? (
        <VectorSliceOverlay
          visible
          lines={sliceLines}
          activeIndex={activeSliceIndex}
          panHandlers={handlersRef.current.slicePanHandlers}
          onArenaLayout={(layout) => handlersRef.current.registerSliceArena(layout)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
    elevation: 12,
  },
});
