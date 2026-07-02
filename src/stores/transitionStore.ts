import { useSyncExternalStore } from 'react';

export type TransitionState = 'IDLE' | 'BREACHING' | 'EXTRACTING';

export interface TransitionStoreSnapshot {
  transitionState: TransitionState;
  breachColor: string;
  extractFlashColor: string;
}

type TransitionListener = () => void;

let snapshot: TransitionStoreSnapshot = {
  transitionState: 'IDLE',
  breachColor: '#334155',
  extractFlashColor: '#F8FAFC',
};

const listeners = new Set<TransitionListener>();

let breachNavigateCallback: (() => void) | null = null;
let extractNavigateCallback: (() => void) | null = null;

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

export const transitionActions = {
  startBreaching(breachColor: string, onNavigate: () => void): void {
    if (snapshot.transitionState !== 'IDLE') return;
    breachNavigateCallback = onNavigate;
    snapshot = { ...snapshot, transitionState: 'BREACHING', breachColor };
    emit();
  },

  startExtracting(onNavigate: () => void): void {
    if (snapshot.transitionState !== 'IDLE') return;
    extractNavigateCallback = onNavigate;
    snapshot = { ...snapshot, transitionState: 'EXTRACTING' };
    emit();
  },

  setIdle(): void {
    snapshot = { ...snapshot, transitionState: 'IDLE' };
    breachNavigateCallback = null;
    extractNavigateCallback = null;
    emit();
  },

  consumeBreachNavigate(): void {
    const callback = breachNavigateCallback;
    breachNavigateCallback = null;
    callback?.();
  },

  consumeExtractNavigate(): void {
    const callback = extractNavigateCallback;
    extractNavigateCallback = null;
    callback?.();
  },
};
