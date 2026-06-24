import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../../styles/hubTerminalUi';
import { pulseHubButton } from '../../utils/hubButtonHaptics';

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
        <HapticPressable
          onPress={() => {
            pulseHubButton();
            onDismiss();
          }}
          style={({ pressed }) => [
            getInteractiveButtonStyle(btnBorder, { pressed, size: 'md' }),
            styles.btn,
          ]}
        >
          <Text style={[getInteractiveButtonTextStyle('md'), { color: btnText }]}>
            {isVictory ? '[ CONTINUE RUN ]' : '[ INCURSION FAILED ]'}
          </Text>
        </HapticPressable>
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
  btn: { width: '100%' },
});
