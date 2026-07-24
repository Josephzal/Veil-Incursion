import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  transitionActions,
  useTransitionStore,
} from '../../stores/transitionStore';
import VeilTransitOverlay from './VeilTransitOverlay';
import { resetVeilTransitBridge } from '../scanner/veilTransitBridge';

interface TransitionOverlayProps {
  children: React.ReactNode;
}

/**
 * App-wide scene transit host.
 * Destination screens mount under the overlay; swap fires only while covered.
 */
export default function TransitionOverlay({ children }: TransitionOverlayProps): React.JSX.Element {
  const transitionState = useTransitionStore((state) => state.transitionState);
  const transitKind = useTransitionStore((state) => state.transitKind);
  const focalPoint = useTransitionStore((state) => state.focalPoint);
  const generation = useTransitionStore((state) => state.generation);

  const active = transitionState === 'BREACHING' || transitionState === 'EXTRACTING';

  const handleSwap = useCallback(() => {
    transitionActions.consumeTransitNavigate();
  }, []);

  const handleComplete = useCallback(() => {
    resetVeilTransitBridge();
    transitionActions.setIdle();
  }, []);

  // Stable callbacks — overlay effect keys off generation, not identity churn.
  const swapRef = useRef(handleSwap);
  swapRef.current = handleSwap;
  const completeRef = useRef(handleComplete);
  completeRef.current = handleComplete;

  const onSwapScene = useCallback(() => {
    swapRef.current();
  }, []);

  const onComplete = useCallback(() => {
    completeRef.current();
  }, []);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.content} pointerEvents={active ? 'none' : 'box-none'}>
        {children}
      </View>

      {active && transitKind ? (
        <VeilTransitOverlay
          key={generation}
          kind={transitKind}
          focalPoint={focalPoint}
          generation={generation}
          onSwapScene={onSwapScene}
          onComplete={onComplete}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
