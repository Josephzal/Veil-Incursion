import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FRACTURE_BREAK_PROMPT_MS } from '../../data/combatMasteryEngine';

interface FractureBreakPromptProps {
  visible: boolean;
  designation?: string;
  onBreach: () => void;
  onExpire: () => void;
}

export default function FractureBreakPrompt({
  visible,
  designation,
  onBreach,
  onExpire,
}: FractureBreakPromptProps): React.JSX.Element | null {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      firedRef.current = false;
      return;
    }
    firedRef.current = false;
    const timer = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onExpire();
    }, FRACTURE_BREAK_PROMPT_MS);
    return () => clearTimeout(timer);
  }, [visible, onExpire]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.dim} pointerEvents="none" />
      <Pressable
        style={styles.button}
        onPress={() => {
          if (firedRef.current) return;
          firedRef.current = true;
          onBreach();
        }}
      >
        <Text style={styles.label}>[ FRACTURE BREACH ]</Text>
        <Text style={styles.sub}>{designation ?? 'HOSTILE'} — EXECUTE NOW</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 48,
    elevation: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  button: {
    borderWidth: 2,
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(8, 47, 73, 0.92)',
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#22d3ee',
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#67e8f9',
    letterSpacing: 1.2,
  },
  sub: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: '#bae6fd',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
