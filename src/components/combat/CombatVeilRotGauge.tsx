import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CATACLYSM_ROT_GATE } from '../../data/envoyRotEngine';
import {
  COMBAT_DECK_LABEL_WIDTH,
  COMBAT_DECK_ROW_GAP,
} from './combatGaugeMetrics';

interface CombatVeilRotGaugeProps {
  totalStacks: number;
  gate?: number;
  labelColor?: string;
  liveColor?: string;
  spentColor?: string;
  variant?: 'compact' | 'inline' | 'stacked';
  labelFontScale?: number;
}

/** Catalyst-aligned orb row — tracks total Veil Rot toward Cataclysm gate. */
export default function CombatVeilRotGauge({
  totalStacks,
  gate = CATACLYSM_ROT_GATE,
  labelColor = '#4ade80',
  liveColor = '#4ade80',
  spentColor = 'rgba(34, 197, 94, 0.28)',
  variant = 'compact',
  labelFontScale = 1,
}: CombatVeilRotGaugeProps): React.JSX.Element | null {
  if (totalStacks <= 0) return null;

  const slots = Math.max(1, gate);
  const isStacked = variant === 'stacked';
  const isInline = variant === 'compact' || variant === 'inline';
  const labelText = `VEIL ROT // ${totalStacks}/${gate}`;

  const orbRow = (
    <View style={styles.orbRow}>
      {Array.from({ length: slots }).map((_, index) => {
        const live = index < totalStacks;
        return (
          <View
            key={index}
            style={[
              styles.orbOuter,
              {
                borderColor: live ? liveColor : 'rgba(74, 222, 128, 0.4)',
                shadowColor: live ? liveColor : 'transparent',
                opacity: live ? 1 : 0.45,
              },
            ]}
          >
            <View
              style={[
                styles.orbInner,
                {
                  backgroundColor: live ? liveColor : spentColor,
                  borderColor: live ? '#bbf7d0' : 'rgba(34, 197, 94, 0.35)',
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
          labelFontScale !== 1 ? {
            fontSize: (isStacked ? 8 : 7) * labelFontScale,
            lineHeight: (isStacked ? 10 : 9) * labelFontScale,
          } : null,
          { color: labelColor },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {labelText}
      </Text>
      {orbRow}
    </View>
  );
}

const ORB = 9;

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
  orbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: ORB,
    flexShrink: 1,
    flex: 1,
    justifyContent: 'flex-start',
  },
  orbOuter: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.85,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  orbInner: {
    width: ORB - 3,
    height: ORB - 3,
    borderRadius: (ORB - 3) / 2,
    borderWidth: 1,
  },
});
