import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';
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
  labelFontScale?: number;
  sigilScale?: number;
}

/** Runic Brand pips — triangular sigil slots that light as brands are imprinted. */
export default function CombatRunicBrandGauge({
  currentBrands,
  maxBrands,
  labelColor = '#c084fc',
  liveColor = '#a855f7',
  spentColor = 'rgba(88, 28, 135, 0.22)',
  variant = 'compact',
  labelFontScale = 1,
  sigilScale = 1,
}: CombatRunicBrandGaugeProps): React.JSX.Element {
  const slots = Math.max(1, maxBrands);
  const isStacked = variant === 'stacked';
  const isInline = variant === 'compact' || variant === 'inline';
  const labelText = `BRANDS // ${currentBrands}/${maxBrands}`;
  const sigilSize = SIGIL * sigilScale;
  const points = trianglePoints(sigilSize);

  const sigilRow = (
    <View style={[styles.sigilRow, { minHeight: sigilSize }]}>
      {Array.from({ length: slots }).map((_, index) => {
        const live = index < currentBrands;
        return (
          <View
            key={index}
            style={[
              styles.sigilHost,
              {
                width: sigilSize,
                height: sigilSize,
                shadowColor: live ? liveColor : 'transparent',
                opacity: live ? 1 : 0.45,
              },
            ]}
          >
            <Svg width={sigilSize} height={sigilSize}>
              <Polygon
                points={points}
                fill={live ? liveColor : spentColor}
                stroke={live ? '#e9d5ff' : 'rgba(88, 28, 135, 0.55)'}
                strokeWidth={1.25}
              />
            </Svg>
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
            fontSize: (isStacked ? COMBAT_HUD_TYPE.body : COMBAT_HUD_TYPE.caption) * labelFontScale,
            lineHeight: (isStacked ? COMBAT_HUD_TYPE.lineBody : COMBAT_HUD_TYPE.lineCaption) * labelFontScale,
          } : null,
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

const SIGIL = 14;

function trianglePoints(size: number): string {
  const pad = 1;
  const tipX = size / 2;
  const tipY = pad;
  const leftX = pad;
  const rightX = size - pad;
  const baseY = size - pad;
  return `${tipX},${tipY} ${rightX},${baseY} ${leftX},${baseY}`;
}

const styles = StyleSheet.create({
  root: {
    gap: 4,
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
    gap: 4,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  labelInline: {
    width: COMBAT_DECK_LABEL_WIDTH + 24,
    flexShrink: 0,
    flex: 0,
    fontSize: COMBAT_HUD_TYPE.body,
    lineHeight: COMBAT_HUD_TYPE.lineBody,
    letterSpacing: 0.4,
  },
  labelStacked: {
    fontSize: COMBAT_HUD_TYPE.label,
    width: '100%',
    flex: 0,
  },
  sigilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: SIGIL,
    flexShrink: 1,
    flex: 1,
    justifyContent: 'flex-start',
  },
  sigilHost: {
    width: SIGIL,
    height: SIGIL,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
});
