import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

const DISSOLVE_MS = 420;

interface CombatEnemyDissolveEffectProps {
  dissolveSeq?: number;
  active?: boolean;
  onComplete?: () => void;
  children: React.ReactNode;
}

/** In-place fade when a hostile is eradicated — no positional drift. */
export default function CombatEnemyDissolveEffect({
  dissolveSeq = 0,
  active = false,
  onComplete,
  children,
}: CombatEnemyDissolveEffectProps): React.JSX.Element | null {
  const lastSeqRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const opacity = useRef(new Animated.Value(1)).current;
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!active || dissolveSeq <= 0 || dissolveSeq === lastSeqRef.current) return;
    lastSeqRef.current = dissolveSeq;
    setFinished(false);
    opacity.setValue(1);

    const animation = Animated.timing(opacity, {
      toValue: 0,
      duration: DISSOLVE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start(({ finished: didFinish }) => {
      if (!didFinish) return;
      setFinished(true);
      onCompleteRef.current?.();
    });

    return () => {
      animation.stop();
    };
  }, [active, dissolveSeq, opacity]);

  useEffect(() => {
    if (!active) {
      lastSeqRef.current = 0;
      setFinished(false);
      opacity.setValue(1);
    }
  }, [active, opacity]);

  if (finished) return null;

  return (
    <Animated.View
      style={[styles.wrap, active ? { opacity } : null]}
      pointerEvents={active ? 'none' : 'box-none'}
      collapsable={false}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
