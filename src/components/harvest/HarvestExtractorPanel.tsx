import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
  style,
}: HarvestExtractorPanelProps): React.JSX.Element {
  const clampedPct = Math.min(100, Math.max(0, harvestPercentage));
  const currentUnits = residueCollected != null
    ? Math.round(residueCollected)
    : Math.round((clampedPct / 100) * residueCapacity);
  const idle = !residueAvailable && !active;
  const fillColor = active ? HARVEST_PHOSPHOR : idle ? HARVEST_MUTED_SLATE : accentColor;

  return (
    <View
      style={[
        styles.module,
        {
          paddingHorizontal: padding,
          paddingVertical: Math.max(12, padding - 1),
          borderColor: active
            ? 'rgba(100, 201, 177, 0.36)'
            : residueAvailable
              ? 'rgba(91, 224, 195, 0.18)'
              : 'rgba(91, 224, 195, 0.14)',
          opacity: idle ? 0.86 : 1,
        },
        style,
      ]}
    >
      <View style={[styles.artColumn, idle ? styles.artIdle : null]}>
        {children}
      </View>

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

        {idle ? (
          <TerminalText
            size={6.5 * fontScale}
            letterSpacing={0.7}
            style={styles.supportLine}
          >
            NO RESIDUE DETECTED
          </TerminalText>
        ) : residueAvailable && !active ? (
          <TerminalText
            size={7 * fontScale}
            letterSpacing={0.75}
            style={styles.supportLineHold}
          >
            [ HOLD ] VACUUM RESIDUE
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
  },
  artColumn: {
    width: HARVEST_EXTRACTOR_ART_WIDTH,
    minWidth: HARVEST_EXTRACTOR_ART_WIDTH,
    maxWidth: HARVEST_EXTRACTOR_ART_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  artIdle: {
    opacity: 0.52,
  },
  readoutColumn: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    gap: 5,
    justifyContent: 'center',
    overflow: 'visible',
    paddingRight: 2,
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
  supportSpacer: {
    height: 16,
    marginTop: 4,
  },
});
