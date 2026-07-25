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
  const stateLabel = active ? 'DRAWING' : residueAvailable ? 'READY' : 'IDLE';

  return (
    <View
      style={[
        styles.module,
        {
          paddingHorizontal: padding,
          paddingVertical: Math.max(10, padding - 2),
          borderColor: active
            ? 'rgba(100, 201, 177, 0.36)'
            : residueAvailable
              ? 'rgba(91, 224, 195, 0.18)'
              : 'rgba(91, 224, 195, 0.14)',
          opacity: idle ? 0.82 : 1,
        },
        style,
      ]}
    >
      <View style={[styles.artColumn, idle ? styles.artIdle : null]}>
        {children}
      </View>

      <View style={styles.readoutColumn}>
        <TerminalText
          size={6.5 * fontScale}
          letterSpacing={0.95}
          style={styles.eyebrow}
          numberOfLines={1}
        >
          ACTIVE TOOL // RESONANCE SINK
        </TerminalText>

        <View style={styles.titleRow}>
          <TerminalText
            size={10 * fontScale}
            letterSpacing={0.75}
            style={styles.title}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            VEIL EXTRACTOR
          </TerminalText>
          <View style={styles.stateSlot}>
            <TerminalText
              size={6.5 * fontScale}
              letterSpacing={0.9}
              style={[styles.stateChip, { color: fillColor }]}
              numberOfLines={1}
              ellipsizeMode="clip"
            >
              {stateLabel}
            </TerminalText>
          </View>
        </View>

        <TerminalText
          size={10 * fontScale}
          letterSpacing={0.5}
          style={[styles.capValue, { color: fillColor }]}
          numberOfLines={1}
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
            size={6 * fontScale}
            letterSpacing={0.75}
            style={styles.supportLine}
            numberOfLines={1}
          >
            NO RESIDUE DETECTED
          </TerminalText>
        ) : residueAvailable && !active ? (
          <TerminalText
            size={6.5 * fontScale}
            letterSpacing={0.8}
            style={styles.supportLineHold}
            numberOfLines={1}
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
    overflow: 'hidden',
    alignItems: 'center',
    gap: 12,
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
    gap: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  eyebrow: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '600',
    ...Platform.select({
      web: {
        fontSize: 'clamp(11px, 0.7vw, 12px)',
      } as object,
      default: {},
    }),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 0,
    width: '100%',
  },
  title: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
    ...Platform.select({
      web: {
        fontSize: 'clamp(18px, 1.05vw, 20px)',
      } as object,
      default: {},
    }),
  },
  stateSlot: {
    width: 78,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  stateChip: {
    fontWeight: '700',
    textAlign: 'right',
  },
  capValue: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
    ...Platform.select({
      web: {
        fontSize: 'clamp(18px, 1.05vw, 20px)',
      } as object,
      default: {},
    }),
  },
  meterTrack: {
    alignSelf: 'stretch',
    width: '100%',
    height: 3.5,
    marginTop: 2,
    backgroundColor: 'rgba(126, 139, 133, 0.28)',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    minWidth: 0,
  },
  supportLine: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '600',
    opacity: 0.78,
    marginTop: 4,
  },
  supportLineHold: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '700',
    marginTop: 4,
  },
  supportSpacer: {
    height: 14,
    marginTop: 4,
  },
});
