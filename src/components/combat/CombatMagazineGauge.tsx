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
  return (
    <View style={styles.root}>
      <Text style={[styles.label, variant === 'stacked' ? styles.labelStacked : null, { color: labelColor }]}>
        {`MAGAZINE // ${currentAmmo}/${maxAmmo}${overcharged ? ' // OVERCHARGED' : ''}`}
      </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 3,
    width: '100%',
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  labelStacked: {
    fontSize: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 8,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
});
