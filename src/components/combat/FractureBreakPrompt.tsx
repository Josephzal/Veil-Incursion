import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FRACTURE_BREAK_PROMPT_MS } from '../../data/combatMasteryEngine';

interface FractureBreakPromptProps {
  visible: boolean;
  designation?: string;
  onExpire: () => void;
}

/** Non-blocking fracture breach timer — player taps the highlighted hostile in the arena. */
export default function FractureBreakPrompt({
  visible,
  designation,
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
    <View style={styles.bannerHost} pointerEvents="none">
      <View style={styles.banner}>
        <Text style={styles.label}>[ FRACTURE BREAK ]</Text>
        <Text style={styles.sub}>
          {`${designation ?? 'HOSTILE'} — TAP TO EXECUTE`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerHost: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 48,
    elevation: 48,
    alignItems: 'center',
  },
  banner: {
    borderWidth: 1,
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(8, 47, 73, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#22d3ee',
    shadowOpacity: 0.65,
    shadowRadius: 10,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    color: '#67e8f9',
    letterSpacing: 1,
  },
  sub: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: '#bae6fd',
    marginTop: 3,
    letterSpacing: 0.5,
  },
});
