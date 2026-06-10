import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const MONO = 'monospace';

interface CombatResolutionBannerProps {
  outcome: 'VICTORY' | 'DEFEAT';
  primaryColor: string;
  defeatColor: string;
  onDismiss: () => void;
}

export default function CombatResolutionBanner({
  outcome,
  primaryColor,
  defeatColor,
  onDismiss,
}: CombatResolutionBannerProps): React.JSX.Element {
  const isVictory = outcome === 'VICTORY';
  const accent = isVictory ? '#22c55e' : defeatColor;
  const btnBorder = isVictory ? primaryColor : defeatColor;
  const btnText = isVictory ? primaryColor : defeatColor;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.panel}>
        <Text style={[styles.title, { color: accent }]}>
          {isVictory ? 'HOSTILE NEUTRALIZED' : 'OPERATIVE SOUL DISCONNECTED'}
        </Text>
        <Pressable
          onPress={onDismiss}
          style={[styles.btn, { borderColor: btnBorder }]}
        >
          <Text style={[styles.btnText, { color: btnText }]}>
            {isVictory ? '[ CONTINUE RUN ]' : '[ INCURSION FAILED ]'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    zIndex: 40,
  },
  panel: {
    alignItems: 'center',
    width: '92%',
    maxWidth: 420,
    gap: 18,
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(5, 6, 8, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.35)',
  },
  title: {
    fontFamily: MONO,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
  },
  btn: {
    borderWidth: 2,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  btnText: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
});
