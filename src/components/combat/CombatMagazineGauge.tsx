import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CombatMagazineGaugeProps {
  currentAmmo: number;
  maxAmmo: number;
  overcharged?: boolean;
  labelColor?: string;
  liveColor?: string;
  spentColor?: string;
  variant?: 'compact' | 'inline' | 'stacked';
}

export default function CombatMagazineGauge({
  currentAmmo,
  maxAmmo,
  overcharged = false,
  labelColor = '#fbbf24',
  liveColor = '#fbbf24',
  spentColor = 'rgba(148, 163, 184, 0.35)',
  variant = 'compact',
}: CombatMagazineGaugeProps): React.JSX.Element {
  const slots = Math.max(1, maxAmmo);
  const isStacked = variant === 'stacked';
  const isInline = variant === 'compact' || variant === 'inline';

  const labelText = `MAGAZINE // ${currentAmmo}/${maxAmmo}${overcharged ? ' // OVERCHARGED' : ''}`;

  const bulletRow = (
    <View style={styles.bulletRow}>
      {Array.from({ length: slots }).map((_, index) => {
        const live = index < currentAmmo;
        return (
          <View
            key={index}
            style={[
              styles.bullet,
              {
                backgroundColor: live ? liveColor : spentColor,
                borderColor: live ? liveColor : 'rgba(148, 163, 184, 0.5)',
                opacity: live ? 1 : 0.55,
              },
            ]}
          />
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
      {bulletRow}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 3,
    width: '100%',
  },
  rootInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
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
    width: 72,
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
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 8,
    flexShrink: 1,
    flex: 1,
    justifyContent: 'flex-end',
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
});
