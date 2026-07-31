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
import {
  releaseFabricationHoldSfx,
  startFabricationHoldSfx,
  stopFabricationHoldSfx,
} from '../../../utils/fabricationFeedbackAudio';
import { VEIL } from '../../../theme/veilTerminalTokens';
import { HUB_CTA_INVERSE_TEXT } from '../../../theme/hubPanelSurfaces';
import { viewShadow } from '../../../utils/adaptiveStyles';
import { readPressableHover } from '../../../utils/terminalHoverStyle';

const HOLD_MS = 1000;

interface HoldToFabricateButtonProps {
  onComplete: () => void;
  disabled?: boolean;
  label?: string;
  holdingLabel?: string;
}

function withAlpha(color: string, alphaHex: string): string {
  if (color.startsWith('#') && color.length === 7) {
    return `${color}${alphaHex}`;
  }
  return color;
}

/**
 * Hold for 1s to confirm fabrication.
 * Rest/hover matches Accept Contract glow; hold fills solid mint.
 */
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
    if (!completedRef.current) {
      releaseFabricationHoldSfx('abort');
    }
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
    startFabricationHoldSfx();
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
      releaseFabricationHoldSfx('complete');
      pulseHubButton();
      onComplete();
      progress.setValue(0);
    });
  };

  useEffect(() => () => {
    animRef.current?.stop();
    stopFabricationHoldSfx();
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
      sfx={false}
      disabled={disabled}
      delayLongPress={10_000}
      onPressIn={startHold}
      onPressOut={() => stopHold(true)}
      accessibilityRole="button"
      accessibilityLabel="Hold for one second to fabricate"
      accessibilityHint="Press and hold to complete fabrication"
      style={(state) => {
        const hovered = readPressableHover(state);
        const awake = !disabled && (holding || hovered || state.pressed);
        return [
          styles.button,
          {
            backgroundColor: awake
              ? withAlpha(VEIL.mint, '33')
              : withAlpha(VEIL.mint, disabled ? '10' : '18'),
            borderColor: awake
              ? VEIL.mint
              : withAlpha(VEIL.mint, disabled ? '55' : '88'),
            ...viewShadow({
              color: VEIL.mint,
              opacity: disabled ? 0.42 : awake ? 0.95 : 0.72,
              radius: disabled ? 10 : awake ? 16 : 12,
              offset: { width: 0, height: 0 },
            }),
            opacity: disabled ? 0.72 : 1,
          },
          disabled && styles.buttonDisabled,
        ];
      }}
    >
      {({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => {
        const awake = !disabled && (holding || hovered || pressed);
        return (
          <>
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
                  {
                    color: disabled
                      ? withAlpha(VEIL.mint, '66')
                      : holding
                        ? HUB_CTA_INVERSE_TEXT
                        : awake
                          ? VEIL.mint
                          : withAlpha(VEIL.mint, '99'),
                  },
                ]}
              >
                {holding ? holdingLabel : label}
              </TerminalText>
            </View>
          </>
        );
      }}
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        outlineStyle: 'none',
        userSelect: 'none',
        transitionProperty: 'background-color, border-color, box-shadow',
        transitionDuration: '140ms',
      } as object,
      default: {},
    }),
  },
  buttonDisabled: {
    backgroundColor: 'rgba(185, 181, 167, 0.03)',
    borderColor: 'rgba(185, 181, 167, 0.16)',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: VEIL.mint,
  },
  labelWrap: {
    zIndex: 1,
    paddingHorizontal: 12,
  },
  label: {
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
