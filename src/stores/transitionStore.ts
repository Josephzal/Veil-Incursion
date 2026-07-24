import { useSyncExternalStore } from 'react';
import type { VeilTransitKind } from '../components/transitions/veilTransitTimeline';

export type TransitionState = 'IDLE' | 'BREACHING' | 'EXTRACTING';

/** Normalized screen-space focal point (CSS top-left origin, 0–1). */
export interface TransitionFocalPoint {
  x: number;
  y: number;
}

export interface TransitionStoreSnapshot {
  transitionState: TransitionState;
  transitKind: VeilTransitKind | null;
  /** CSS top-origin UV; converted to WebGL y-up in the overlay. */
  focalPoint: TransitionFocalPoint;
  /** @deprecated Grey flood color — unused by Veil transit; kept for call-site compat. */
  breachColor: string;
  /** @deprecated White flash — unused by Veil transit. */
  extractFlashColor: string;
  /** Monotonic generation — cancels stale RAF / timeouts after interrupt. */
  generation: number;
}

type TransitionListener = () => void;

let snapshot: TransitionStoreSnapshot = {
  transitionState: 'IDLE',
  transitKind: null,
  focalPoint: { x: 0.5, y: 0.5 },
  breachColor: '#05090B',
  extractFlashColor: '#05090B',
  generation: 0,
};

const listeners = new Set<TransitionListener>();

let breachNavigateCallback: (() => void) | null = null;
let extractNavigateCallback: (() => void) | null = null;
let navigateConsumed = false;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: TransitionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TransitionStoreSnapshot {
  return snapshot;
}

export function useTransitionStore<T>(selector: (state: TransitionStoreSnapshot) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getSnapshot()));
}

function normalizeFocal(focal?: TransitionFocalPoint | null): TransitionFocalPoint {
  if (!focal) return { x: 0.5, y: 0.5 };
  return {
    x: Math.max(0, Math.min(1, focal.x)),
    y: Math.max(0, Math.min(1, focal.y)),
  };
}

export const transitionActions = {
  /**
   * Incursion ingress — optional breachColor kept for backward compatibility (ignored visually).
   */
  startBreaching(
    breachColorOrFocal: string | TransitionFocalPoint,
    onNavigateOrFocal?: (() => void) | TransitionFocalPoint,
    maybeNavigate?: () => void,
  ): boolean {
    if (snapshot.transitionState !== 'IDLE') return false;

    let focal: TransitionFocalPoint = { x: 0.5, y: 0.5 };
    let onNavigate: (() => void) | undefined;
    let breachColor = '#05090B';

    if (typeof breachColorOrFocal === 'string') {
      breachColor = breachColorOrFocal;
      if (typeof onNavigateOrFocal === 'function') {
        onNavigate = onNavigateOrFocal;
      } else if (onNavigateOrFocal && typeof onNavigateOrFocal === 'object') {
        focal = normalizeFocal(onNavigateOrFocal);
        onNavigate = maybeNavigate;
      }
    } else {
      focal = normalizeFocal(breachColorOrFocal);
      if (typeof onNavigateOrFocal === 'function') {
        onNavigate = onNavigateOrFocal;
      }
    }

    if (!onNavigate) return false;

    breachNavigateCallback = onNavigate;
    extractNavigateCallback = null;
    navigateConsumed = false;
    snapshot = {
      ...snapshot,
      transitionState: 'BREACHING',
      transitKind: 'incursionIngress',
      focalPoint: focal,
      breachColor,
      generation: snapshot.generation + 1,
    };
    emit();
    return true;
  },

  startExtracting(onNavigate: () => void, focal?: TransitionFocalPoint | null): boolean {
    if (snapshot.transitionState !== 'IDLE') return false;
    extractNavigateCallback = onNavigate;
    breachNavigateCallback = null;
    navigateConsumed = false;
    snapshot = {
      ...snapshot,
      transitionState: 'EXTRACTING',
      transitKind: 'successfulExtraction',
      focalPoint: normalizeFocal(focal),
      generation: snapshot.generation + 1,
    };
    emit();
    return true;
  },

  setIdle(): void {
    snapshot = {
      ...snapshot,
      transitionState: 'IDLE',
      transitKind: null,
      generation: snapshot.generation + 1,
    };
    breachNavigateCallback = null;
    extractNavigateCallback = null;
    navigateConsumed = false;
    emit();
  },

  /** Hard recovery if a transit is interrupted mid-flight. */
  forceIdle(): void {
    transitionActions.setIdle();
  },

  consumeBreachNavigate(): void {
    if (navigateConsumed) return;
    navigateConsumed = true;
    const callback = breachNavigateCallback;
    breachNavigateCallback = null;
    callback?.();
  },

  consumeExtractNavigate(): void {
    if (navigateConsumed) return;
    navigateConsumed = true;
    const callback = extractNavigateCallback;
    extractNavigateCallback = null;
    callback?.();
  },

  consumeTransitNavigate(): void {
    if (snapshot.transitionState === 'BREACHING') {
      transitionActions.consumeBreachNavigate();
    } else if (snapshot.transitionState === 'EXTRACTING') {
      transitionActions.consumeExtractNavigate();
    }
  },
};
