import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CombatApPipRowProps {
  current: number;
  max: number;
  accent: string;
  mutedColor?: string;
  queued?: boolean;
  /** Narrow column layout — no flex grow. */
  compact?: boolean;
}

/** Glowing hex AP pip row for the command deck header. */
export default function CombatApPipRow({
  current,
  max,
  accent,
  mutedColor = '#94a3b8',
  queued = false,
  compact = false,
}: CombatApPipRowProps): React.JSX.Element {
  return (
    <View style={[styles.host, compact && styles.hostCompact]}>
      <Text style={[styles.label, { color: mutedColor }]}>AP</Text>
      <View style={styles.pipRow}>
        {Array.from({ length: max }, (_, index) => {
          const filled = index < current;
          const fillColor = filled
            ? (queued ? 'rgba(186, 230, 253, 0.95)' : accent)
            : 'rgba(15, 23, 42, 0.65)';
          const borderColor = filled ? accent : 'rgba(148, 163, 184, 0.45)';

          return (
            <View
              key={`ap-pip-${index}`}
              style={[
                styles.hexShell,
                filled && {
                  shadowColor: accent,
                },
              ]}
            >
              <View
                style={[
                  styles.hexCore,
                  {
                    borderColor,
                    backgroundColor: fillColor,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <Text style={[styles.counter, { color: mutedColor }]}>{`${current}/${max}`}</Text>
    </View>
  );
}

const HEX_SIZE = 12;

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
  label: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  pipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hexShell: {
    width: HEX_SIZE,
    height: HEX_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 2,
  },
  hexCore: {
    width: HEX_SIZE * 0.88,
    height: HEX_SIZE * 0.88,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  counter: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.4,
  },
});
