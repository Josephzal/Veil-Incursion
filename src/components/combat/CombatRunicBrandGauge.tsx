import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  COMBAT_DECK_LABEL_WIDTH,
  COMBAT_DECK_ROW_GAP,
} from './combatGaugeMetrics';

interface CombatRunicBrandGaugeProps {
  currentBrands: number;
  maxBrands: number;
  labelColor?: string;
  liveColor?: string;
  spentColor?: string;
  variant?: 'compact' | 'inline' | 'stacked';
}

/** Runic Brand pips — occult sigil slots that light as brands are imprinted. */
export default function CombatRunicBrandGauge({
  currentBrands,
  maxBrands,
  labelColor = '#c084fc',
  liveColor = '#a855f7',
  spentColor = 'rgba(88, 28, 135, 0.22)',
  variant = 'compact',
}: CombatRunicBrandGaugeProps): React.JSX.Element {
  const slots = Math.max(1, maxBrands);
  const isStacked = variant === 'stacked';
  const isInline = variant === 'compact' || variant === 'inline';
  const labelText = `BRANDS // ${currentBrands}/${maxBrands}`;

  const sigilRow = (
    <View style={styles.sigilRow}>
      {Array.from({ length: slots }).map((_, index) => {
        const live = index < currentBrands;
        return (
          <View
            key={index}
            style={[
              styles.sigilOuter,
              {
                borderColor: live ? liveColor : 'rgba(88, 28, 135, 0.45)',
                shadowColor: live ? liveColor : 'transparent',
                opacity: live ? 1 : 0.4,
              },
            ]}
          >
            <View
              style={[
                styles.sigilInner,
                {
                  backgroundColor: live ? liveColor : spentColor,
                  borderColor: live ? '#e9d5ff' : 'rgba(88, 28, 135, 0.35)',
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.root, isStacked ? styles.rootStacked : null, isInline ? styles.rootInline : null]}>
      <Text
        style={[
          styles.label,
          isStacked ? styles.labelStacked : null,
          isInline ? styles.labelInline : null,
          { color: labelColor },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {labelText}
      </Text>
      {sigilRow}
    </View>
  );
}

const SIGIL = 9;

const styles = StyleSheet.create({
  root: {
    gap: 3,
    width: '100%',
  },
  rootInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMBAT_DECK_ROW_GAP,
    paddingVertical: 1,
  },
  rootStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 3,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  labelInline: {
    width: COMBAT_DECK_LABEL_WIDTH,
    flexShrink: 0,
    flex: 0,
    fontSize: 7,
    lineHeight: 9,
    letterSpacing: 0.4,
  },
  labelStacked: {
    fontSize: 8,
    width: '100%',
    flex: 0,
  },
  sigilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: SIGIL,
    flexShrink: 1,
    flex: 1,
    justifyContent: 'flex-start',
  },
  sigilOuter: {
    width: SIGIL,
    height: SIGIL,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderRadius: 1,
    shadowOpacity: 0.85,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  sigilInner: {
    width: SIGIL - 4,
    height: SIGIL - 4,
    borderWidth: 1,
    borderRadius: 1,
  },
});
