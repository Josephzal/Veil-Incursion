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
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 20,
  },
  panel: {
    alignItems: 'center',
    width: '88%',
    maxWidth: 360,
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  btn: {
    borderWidth: 1,
    paddingVertical: 10,
    width: '82%',
    alignItems: 'center',
  },
  btnText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
});
