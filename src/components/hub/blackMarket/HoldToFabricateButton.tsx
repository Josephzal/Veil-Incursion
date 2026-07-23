import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import { pulseHubButton } from '../../../utils/hubButtonHaptics';
import { VEIL } from '../../../theme/veilTerminalTokens';

const HOLD_MS = 1000;
const TERMINAL = VEIL.mint;
const TERMINAL_BRIGHT = VEIL.mintBright;

interface HoldToFabricateButtonProps {
  onComplete: () => void;
  disabled?: boolean;
  label?: string;
  holdingLabel?: string;
}

/** Hold for 1s to confirm fabrication — fill bar shows progress. */
export default function HoldToFabricateButton({
  onComplete,
  disabled = false,
  label = '[ HOLD TO FABRICATE ]',
  holdingLabel = '[ BINDING… ]',
}: HoldToFabricateButtonProps): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const completedRef = useRef(false);
  const [holding, setHolding] = useState(false);

  const stopHold = (reset: boolean) => {
    animRef.current?.stop();
    animRef.current = null;
    setHolding(false);
    if (reset && !completedRef.current) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 120,
        useNativeDriver: false,
      }).start();
    }
  };

  const startHold = () => {
    if (disabled) return;
    completedRef.current = false;
    setHolding(true);
    progress.stopAnimation();
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      animRef.current = null;
      if (!finished || completedRef.current) return;
      completedRef.current = true;
      setHolding(false);
      pulseHubButton();
      onComplete();
      progress.setValue(0);
    });
  };

  useEffect(() => () => {
    animRef.current?.stop();
  }, []);

  useEffect(() => {
    if (disabled) stopHold(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when disabled flips on
  }, [disabled]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <HapticPressable
      haptic={false}
      disabled={disabled}
      delayLongPress={10_000}
      onPressIn={startHold}
      onPressOut={() => stopHold(true)}
      accessibilityRole="button"
      accessibilityLabel="Hold for one second to fabricate"
      accessibilityHint="Press and hold to complete fabrication"
      style={({ pressed }) => ([
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ])}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { width: fillWidth }]}
      />
      <View style={styles.labelWrap} pointerEvents="none">
        <TerminalText
          size={8}
          letterSpacing={1}
          style={[
            styles.label,
            holding && styles.labelHolding,
            disabled && styles.labelDisabled,
          ]}
        >
          {holding ? holdingLabel : label}
        </TerminalText>
      </View>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(105, 200, 173, 0.08)',
    borderWidth: 1,
    borderColor: TERMINAL_BRIGHT,
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none', userSelect: 'none' } as object,
      default: {},
    }),
  },
  buttonDisabled: {
    borderColor: 'rgba(105, 200, 173, 0.18)',
    backgroundColor: 'rgba(105, 200, 173, 0.025)',
  },
  buttonPressed: {
    borderColor: TERMINAL,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: TERMINAL,
  },
  labelWrap: {
    zIndex: 1,
    paddingHorizontal: 12,
  },
  label: {
    color: '#c8e6da',
    fontWeight: '800',
  },
  labelHolding: {
    color: '#06110e',
  },
  labelDisabled: {
    color: 'rgba(188, 204, 198, 0.34)',
  },
});
