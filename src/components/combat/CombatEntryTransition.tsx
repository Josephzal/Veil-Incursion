import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const MONO = 'monospace';

interface CombatEntryTransitionProps {
  onComplete: () => void;
}

export default function CombatEntryTransition({
  onComplete,
}: CombatEntryTransitionProps): React.JSX.Element {
  const veil = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelScale = useRef(new Animated.Value(0.94)).current;
  const slashOpacity = useRef(new Animated.Value(0)).current;
  const slashScale = useRef(new Animated.Value(0.6)).current;
  const scanY = useRef(new Animated.Value(-40)).current;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    veil.setValue(0);
    labelOpacity.setValue(0);
    labelScale.setValue(0.94);
    slashOpacity.setValue(0);
    slashScale.setValue(0.6);
    scanY.setValue(-40);

    const anim = Animated.sequence([
      Animated.timing(veil, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(labelScale, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.back(1.1)),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(60),
          Animated.parallel([
            Animated.timing(slashOpacity, {
              toValue: 1,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.timing(slashScale, {
              toValue: 1,
              duration: 240,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.timing(scanY, {
          toValue: 320,
          duration: 560,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(120),
      Animated.timing(veil, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    anim.start(({ finished }) => {
      if (finished) completeRef.current();
    });

    return () => {
      anim.stop();
    };
  }, [labelOpacity, labelScale, scanY, slashOpacity, slashScale, veil]);

  return (
    <View style={styles.root} pointerEvents="auto">
      <Animated.View style={[styles.veil, { opacity: veil }]} />
      <Animated.View
        style={[
          styles.labelWrap,
          {
            opacity: labelOpacity,
            transform: [{ scale: labelScale }],
          },
        ]}
      >
        <Text style={styles.eyebrow}>{'>> COMBAT LINK // HOSTILE VECTOR LOCKED'}</Text>
        <Text style={styles.title}>ENTERING COMBAT</Text>
      </Animated.View>
      
      <Animated.View
        pointerEvents="none"
        style={[
          styles.scanline,
          { transform: [{ translateY: scanY }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 5, 8, 0.94)',
  },
  labelWrap: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  eyebrow: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(0, 210, 196, 0.88)',
    textAlign: 'center',
  },
  title: {
    fontFamily: MONO,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2.4,
    color: '#ff1744',
    textAlign: 'center',
  },
  slash: {
    position: 'absolute',
    width: '72%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 23, 68, 0.82)',
    shadowColor: '#ff1744',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0, 210, 196, 0.5)',
    shadowColor: '#00d2c4',
    shadowOpacity: 0.75,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
