import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import HubPrimaryCta from '../hub/HubPrimaryCta';
import TerminalText from '../TerminalText';
import { pulseHubButton } from '../../utils/hubButtonHaptics';
import { VEIL } from '../../theme/veilTerminalTokens';
import { SCANNER_PHOSPHOR } from './vectorScannerShared';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';

interface BreachActionProps {
  enabled: boolean;
  label?: string;
  readinessLine: string;
  mutedColor: string;
  onPress: () => void;
  fontScale?: number;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

/**
 * Anchored Breach control — readiness line + Accept-style glow CTA.
 */
export default function BreachAction({
  enabled,
  label = '[ BREACH ]',
  readinessLine,
  mutedColor,
  onPress,
}: BreachActionProps): React.JSX.Element {
  const edgeFlash = useRef(new Animated.Value(0)).current;
  const prevEnabled = useRef(enabled);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (enabled && !prevEnabled.current && !reduceMotion) {
      edgeFlash.setValue(0.85);
      Animated.timing(edgeFlash, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }
    prevEnabled.current = enabled;
  }, [edgeFlash, enabled, reduceMotion]);

  return (
    <View style={styles.root}>
      <TerminalText
        size={7.5}
        letterSpacing={1.05}
        style={[styles.readiness, { color: enabled ? SCANNER_PHOSPHOR : mutedColor }]}
        numberOfLines={1}
      >
        {readinessLine}
      </TerminalText>
      <View style={styles.buttonShell}>
        <HubPrimaryCta
          label={label}
          onPress={() => {
            if (!enabled) return;
            pulseHubButton();
            onPress();
          }}
          disabled={!enabled}
          variant="glow"
          accessibilityLabel="Breach selected signal"
          minHeight={60}
          size={11}
          letterSpacing={1.2}
        />
        {enabled ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.edgeFlash,
              {
                opacity: edgeFlash,
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    flexShrink: 0,
    gap: 12,
    paddingTop: 10,
    paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: VEIL.line,
  },
  readiness: {
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  buttonShell: {
    position: 'relative',
    width: '100%',
  },
  edgeFlash: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: SCANNER_PHOSPHOR,
  },
});
