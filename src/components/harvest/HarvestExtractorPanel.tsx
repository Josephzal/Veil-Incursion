import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import TerminalText from '../TerminalText';
import {
  HARVEST_CONTAINMENT_BORDER,
  HARVEST_MUTED_SLATE,
  HARVEST_PANEL_BG,
  HARVEST_PHOSPHOR,
  HARVEST_TEXT_PRIMARY,
} from '../../constants/harvestScreenVisual';
import {
  HARVEST_EXTRACTOR_MODULE_HEIGHT,
  HARVEST_EXTRACTOR_MODULE_WIDTH,
} from '../../constants/harvestLayout';
import { MAX_RUN_CANISTER_RESIDUE } from '../../constants/veilResidue';

interface HarvestExtractorPanelProps {
  harvestPercentage: number;
  /** Absolute residue units currently in the canister. */
  residueCollected?: number;
  residueCapacity?: number;
  accentColor: string;
  children: React.ReactNode;
  padding: number;
  fontScale: number;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact docked Veil Extractor module — lives inside the containment workspace,
 * not as a full-height column.
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
  style,
}: HarvestExtractorPanelProps): React.JSX.Element {
  const clampedPct = Math.min(100, Math.max(0, harvestPercentage));
  const currentUnits = residueCollected != null
    ? Math.round(residueCollected)
    : Math.round((clampedPct / 100) * residueCapacity);
  const fillColor = active ? HARVEST_PHOSPHOR : accentColor;

  return (
    <View
      style={[
        styles.module,
        {
          padding,
          borderColor: active ? 'rgba(100, 201, 177, 0.42)' : HARVEST_CONTAINMENT_BORDER,
        },
        style,
      ]}
    >
      <TerminalText
        size={6.5 * fontScale}
        letterSpacing={1.05}
        style={styles.eyebrow}
        numberOfLines={1}
      >
        ACTIVE TOOL // RESONANCE SINK
      </TerminalText>
      <TerminalText
        size={11 * fontScale}
        letterSpacing={0.85}
        style={styles.title}
        numberOfLines={1}
      >
        VEIL EXTRACTOR
      </TerminalText>

      <View style={styles.canisterMount}>
        {children}
      </View>

      <View style={styles.readoutBlock}>
        <TerminalText size={6.5 * fontScale} letterSpacing={1} style={styles.capLabel}>
          CAPACITY
        </TerminalText>
        <TerminalText size={10 * fontScale} letterSpacing={0.6} style={[styles.capValue, { color: fillColor }]}>
          {`${String(currentUnits).padStart(2, '0')} / ${residueCapacity}`}
        </TerminalText>
        <View style={styles.meterTrack}>
          <View
            style={[
              styles.meterFill,
              {
                backgroundColor: fillColor,
                width: `${clampedPct}%`,
                ...(Platform.OS === 'web' && active
                  ? ({ boxShadow: `0 0 10px ${HARVEST_PHOSPHOR}55` } as object)
                  : null),
              },
            ]}
          />
        </View>
        <TerminalText
          size={7 * fontScale}
          letterSpacing={0.85}
          style={[styles.action, { color: active ? HARVEST_PHOSPHOR : HARVEST_MUTED_SLATE }]}
        >
          {active ? 'DRAWING // VACUUM ACTIVE' : '[ HOLD ] VACUUM RESIDUE'}
        </TerminalText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  module: {
    width: HARVEST_EXTRACTOR_MODULE_WIDTH,
    maxWidth: '100%',
    minHeight: HARVEST_EXTRACTOR_MODULE_HEIGHT * 0.85,
    maxHeight: HARVEST_EXTRACTOR_MODULE_HEIGHT,
    backgroundColor: HARVEST_PANEL_BG,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 8,
    justifyContent: 'flex-start',
  },
  eyebrow: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '700',
  },
  title: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '800',
  },
  canisterMount: {
    flex: 1,
    minHeight: 120,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readoutBlock: {
    width: '100%',
    gap: 5,
    flexShrink: 0,
  },
  capLabel: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '700',
  },
  capValue: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  meterTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(8, 16, 15, 0.95)',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
  },
  action: {
    fontWeight: '700',
    marginTop: 2,
  },
});
