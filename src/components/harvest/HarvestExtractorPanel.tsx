import React, { useEffect } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import TerminalText from '../TerminalText';
import {
  HARVEST_INSTRUMENT_BG,
  HARVEST_MUTED_SLATE,
  HARVEST_PHOSPHOR,
  HARVEST_TEXT_PRIMARY,
} from '../../constants/harvestScreenVisual';
import {
  HARVEST_EXTRACTOR_ART_WIDTH,
  HARVEST_EXTRACTOR_MODULE_HEIGHT,
  HARVEST_EXTRACTOR_MODULE_WIDTH,
  HARVEST_EXTRACTOR_MODULE_WIDTH_CSS,
} from '../../constants/harvestLayout';
import { MAX_RUN_CANISTER_RESIDUE } from '../../constants/veilResidue';
import { RUN_FIELD } from '../../theme/runFieldTokens';

interface HarvestExtractorPanelProps {
  harvestPercentage: number;
  residueCollected?: number;
  residueCapacity?: number;
  accentColor: string;
  children: React.ReactNode;
  padding: number;
  fontScale: number;
  active?: boolean;
  residueAvailable?: boolean;
  /** True once this visit's loose residue has been fully extracted. */
  harvestComplete?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact horizontal Veil Extractor — single operational state, full-width capacity bar.
 * No ellipsis; layout sized so primary labels always fit.
 */
export default function HarvestExtractorPanel({
  harvestPercentage,
  residueCollected,
  residueCapacity = MAX_RUN_CANISTER_RESIDUE,
  accentColor,
  children,
  padding,
  fontScale,
  active = false,
  residueAvailable = false,
  harvestComplete = false,
  style,
}: HarvestExtractorPanelProps): React.JSX.Element {
  const clampedPct = Math.min(100, Math.max(0, harvestPercentage));
  const currentUnits = residueCollected != null
    ? Math.round(residueCollected)
    : Math.round((clampedPct / 100) * residueCapacity);
  const idle = !residueAvailable && !active && !harvestComplete;
  const fillColor = harvestComplete
    ? HARVEST_PHOSPHOR
    : active
      ? HARVEST_PHOSPHOR
      : idle
        ? HARVEST_MUTED_SLATE
        : accentColor;

  const glowPulse = useSharedValue(0);

  useEffect(() => {
    if (!harvestComplete) {
      cancelAnimation(glowPulse);
      glowPulse.value = withTiming(0, { duration: 280 });
      return;
    }
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(glowPulse);
  }, [glowPulse, harvestComplete]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value * 0.85,
    transform: [{ scale: 1 + glowPulse.value * 0.012 }],
  }));

  const artGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glowPulse.value * 0.55,
    shadowOpacity: 0.35 + glowPulse.value * 0.55,
  }));

  return (
    <View
      style={[
        styles.module,
        {
          paddingHorizontal: padding,
          paddingVertical: Math.max(12, padding - 1),
          borderColor: harvestComplete
            ? 'rgba(99, 226, 177, 0.55)'
            : active
              ? 'rgba(100, 201, 177, 0.36)'
              : residueAvailable
                ? 'rgba(91, 224, 195, 0.18)'
                : 'rgba(91, 224, 195, 0.14)',
          opacity: idle ? 0.86 : 1,
        },
        harvestComplete ? styles.moduleSecured : null,
        style,
      ]}
    >
      {harvestComplete ? (
        <Animated.View style={[styles.securedAura, glowStyle]} pointerEvents="none" />
      ) : null}

      <Animated.View
        style={[
          styles.artColumn,
          idle ? styles.artIdle : null,
          harvestComplete ? [styles.artSecured, artGlowStyle] : null,
        ]}
      >
        {children}
      </Animated.View>

      <View style={styles.readoutColumn}>
        <TerminalText
          size={6 * fontScale}
          letterSpacing={0.9}
          style={styles.eyebrow}
        >
          ACTIVE TOOL // RESONANCE SINK
        </TerminalText>

        <TerminalText
          size={9.5 * fontScale}
          letterSpacing={0.7}
          style={styles.title}
        >
          VEIL EXTRACTOR
        </TerminalText>

        <TerminalText
          size={9 * fontScale}
          letterSpacing={0.45}
          style={[styles.capValue, { color: fillColor }]}
        >
          {`${String(currentUnits).padStart(2, '0')} / ${residueCapacity}`}
        </TerminalText>

        <View style={styles.meterTrack}>
          {clampedPct > 0 ? (
            <View
              style={[
                styles.meterFill,
                {
                  backgroundColor: fillColor,
                  width: `${clampedPct}%`,
                  ...(Platform.OS === 'web'
                    ? ({
                      transitionProperty: 'width',
                      transitionDuration: '180ms',
                      transitionTimingFunction: 'ease-out',
                    } as object)
                    : null),
                },
              ]}
            />
          ) : null}
        </View>

        {harvestComplete ? (
          <TerminalText
            size={6.5 * fontScale}
            letterSpacing={0.75}
            style={styles.supportLineSecured}
          >
            RESIDUE SECURED
          </TerminalText>
        ) : idle ? (
          <TerminalText
            size={6.5 * fontScale}
            letterSpacing={0.7}
            style={styles.supportLine}
          >
            NO RESIDUE DETECTED
          </TerminalText>
        ) : active ? (
          <TerminalText
            size={7 * fontScale}
            letterSpacing={0.75}
            style={styles.supportLineHold}
          >
            EXTRACTING RESIDUE
          </TerminalText>
        ) : residueAvailable ? (
          <TerminalText
            size={7 * fontScale}
            letterSpacing={0.75}
            style={styles.supportLineHold}
          >
            RESIDUE DETECTED
          </TerminalText>
        ) : (
          <View style={styles.supportSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  module: {
    ...Platform.select({
      web: {
        width: HARVEST_EXTRACTOR_MODULE_WIDTH_CSS,
        display: 'grid',
        gridTemplateColumns: `${HARVEST_EXTRACTOR_ART_WIDTH}px minmax(0, 1fr)`,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      } as object,
      default: {
        width: HARVEST_EXTRACTOR_MODULE_WIDTH,
        flexDirection: 'row',
      },
    }),
    maxWidth: '100%',
    height: HARVEST_EXTRACTOR_MODULE_HEIGHT,
    maxHeight: HARVEST_EXTRACTOR_MODULE_HEIGHT,
    minHeight: HARVEST_EXTRACTOR_MODULE_HEIGHT,
    backgroundColor: HARVEST_INSTRUMENT_BG,
    borderWidth: 1,
    overflow: 'visible',
    alignItems: 'center',
    gap: 14,
    position: 'relative',
  },
  moduleSecured: {
    shadowColor: RUN_FIELD.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    ...(Platform.OS === 'android' ? { elevation: 10 } : null),
  },
  securedAura: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(99, 226, 177, 0.45)',
    backgroundColor: 'rgba(99, 226, 177, 0.06)',
    zIndex: 0,
  },
  artColumn: {
    width: HARVEST_EXTRACTOR_ART_WIDTH,
    minWidth: HARVEST_EXTRACTOR_ART_WIDTH,
    maxWidth: HARVEST_EXTRACTOR_ART_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 1,
  },
  artIdle: {
    opacity: 0.52,
  },
  artSecured: {
    opacity: 1,
    shadowColor: RUN_FIELD.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  readoutColumn: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    gap: 5,
    justifyContent: 'center',
    overflow: 'visible',
    paddingRight: 2,
    zIndex: 1,
  },
  eyebrow: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '600',
    ...Platform.select({
      web: {
        fontSize: 'clamp(10px, 0.65vw, 11px)',
        lineHeight: '1.3',
      } as object,
      default: {
        lineHeight: 14,
      },
    }),
  },
  title: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '700',
    ...Platform.select({
      web: {
        fontSize: 'clamp(17px, 1vw, 19px)',
        lineHeight: '1.2',
      } as object,
      default: {
        lineHeight: 22,
      },
    }),
  },
  capValue: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
    ...Platform.select({
      web: {
        fontSize: 'clamp(16px, 0.95vw, 18px)',
        lineHeight: '1.2',
      } as object,
      default: {
        lineHeight: 22,
      },
    }),
  },
  meterTrack: {
    alignSelf: 'stretch',
    width: '100%',
    height: 3.5,
    marginTop: 1,
    backgroundColor: 'rgba(126, 139, 133, 0.32)',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    minWidth: 0,
  },
  supportLine: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '600',
    opacity: 0.82,
    marginTop: 4,
    ...Platform.select({
      web: {
        fontSize: 'clamp(12px, 0.8vw, 14px)',
        lineHeight: '1.3',
      } as object,
      default: {
        lineHeight: 16,
      },
    }),
  },
  supportLineHold: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '700',
    marginTop: 4,
    ...Platform.select({
      web: {
        fontSize: 'clamp(12px, 0.8vw, 14px)',
        lineHeight: '1.3',
      } as object,
      default: {
        lineHeight: 16,
      },
    }),
  },
  supportLineSecured: {
    color: HARVEST_PHOSPHOR,
    fontWeight: '700',
    marginTop: 4,
    ...Platform.select({
      web: {
        fontSize: 'clamp(12px, 0.8vw, 14px)',
        lineHeight: '1.3',
      } as object,
      default: {
        lineHeight: 16,
      },
    }),
  },
  supportSpacer: {
    height: 16,
    marginTop: 4,
  },
});
