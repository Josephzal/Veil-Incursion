import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CombatApPipRowProps {
  current: number;
  max: number;
  accent: string;
  mutedColor?: string;
  queued?: boolean;
  compact?: boolean;
  fontScale?: number;
  centered?: boolean;
  /** Overrides label/counter size — matches ability tile typography when set. */
  labelFontSize?: number;
  hexSize?: number;
}

/** Glowing hex AP pip row for the command deck header. */
export default function CombatApPipRow({
  current,
  max,
  accent,
  mutedColor = '#94a3b8',
  queued = false,
  compact = false,
  centered = false,
  fontScale = 1,
  labelFontSize,
  hexSize,
}: CombatApPipRowProps): React.JSX.Element {
  const resolvedLabelSize = labelFontSize ?? 7 * fontScale;
  const resolvedHexSize = hexSize ?? HEX_SIZE * fontScale;

  return (
    <View style={[
      styles.host,
      compact && styles.hostCompact,
      centered && styles.hostCentered,
    ]}>
      <Text style={[styles.label, { color: mutedColor, fontSize: resolvedLabelSize }]}>AP</Text>
      <View style={styles.pipRow}>
        {Array.from({ length: max }, (_, index) => {
          const filled = index < current;
          const fillColor = filled
            ? (queued ? 'rgba(186, 230, 253, 0.95)' : accent)
            : '#0f172a';
          const borderColor = filled ? accent : 'rgba(148, 163, 184, 0.45)';

          return (
            <View
              key={`ap-pip-${index}`}
              style={[styles.hexShell, { width: resolvedHexSize, height: resolvedHexSize }, filled && { shadowColor: accent }]}
            >
              <View
                style={[
                  styles.hexCore,
                  {
                    width: resolvedHexSize * 0.9,
                    height: resolvedHexSize * 0.9,
                    borderColor,
                    backgroundColor: fillColor,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <Text style={[styles.counter, { color: mutedColor, fontSize: resolvedLabelSize }]}>
        {`${current}/${max}`}
      </Text>
    </View>
  );
}

const HEX_SIZE = 7;

const styles = StyleSheet.create({
  host: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  hostCompact: {
    flex: 0,
    alignSelf: 'flex-end',
  },
  hostCentered: {
    flex: 0,
    alignSelf: 'center',
  },
  label: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  pipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  hexShell: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 2,
  },
  hexCore: {
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  counter: {
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },
});
