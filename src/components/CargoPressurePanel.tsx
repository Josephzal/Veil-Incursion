import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  buildActiveCarriedCargoSnapshot,
  formatCarriedEffectDisplayPrefix,
} from '../data/unstableCargoEffectsEngine';
import type { CargoRunState } from '../types/cargoGrid';
import { VEIL } from '../theme/veilTerminalTokens';

interface CargoPressurePanelProps {
  cargo: CargoRunState;
  accentColor?: string;
  mutedColor?: string;
  /** Compact single-column layout for narrow chrome areas. */
  compact?: boolean;
  /** Intel/contraband/contract stacks requiring post-run routing on extract. */
  specialCargoStacks?: number;
}

export default function CargoPressurePanel({
  cargo,
  accentColor = '#f59e0b',
  mutedColor = VEIL.textMuted,
  compact = false,
  specialCargoStacks = 0,
}: CargoPressurePanelProps): React.JSX.Element | null {
  const snapshot = useMemo(() => buildActiveCarriedCargoSnapshot(cargo), [cargo]);

  if (snapshot.activeEffects.length === 0 && specialCargoStacks <= 0) return null;

  const specialAccent = '#22d3ee';

  return (
    <View style={[styles.root, compact ? styles.rootCompact : null]}>
      {snapshot.activeEffects.length > 0 ? (
        <>
          <Text style={[styles.heading, { color: accentColor }]}>
            CARGO PRESSURE
          </Text>
          {snapshot.activeEffects.map((effect) => (
            <View key={effect.resourceId} style={styles.effectBlock}>
              <Text style={[styles.itemName, { color: accentColor }]}>
                {effect.itemName}
              </Text>
              {effect.displayLines.map((line) => (
                <Text
                  key={`${effect.resourceId}-${line.kind}-${line.text}`}
                  style={[
                    styles.effectLine,
                    { color: line.kind === 'upside' ? '#86efac' : '#fca5a5' },
                  ]}
                >
                  {formatCarriedEffectDisplayPrefix(line.kind)}
                  {' '}
                  {line.text}
                </Text>
              ))}
            </View>
          ))}
          {!compact ? (
            <Text style={[styles.hint, { color: mutedColor }]}>
              Bank at safehouse to suspend carried effects.
            </Text>
          ) : null}
        </>
      ) : null}
      {specialCargoStacks > 0 ? (
        <>
          <Text style={[styles.heading, { color: specialAccent }]}>
            SPECIAL CARGO
          </Text>
          <Text style={[styles.effectLine, { color: specialAccent }]}>
            {`${specialCargoStacks} stack(s) — post-run routing on extract`}
          </Text>
          {!compact ? (
            <Text style={[styles.hint, { color: mutedColor }]}>
              Bank at safehouse to secure before death.
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(9, 9, 11, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    marginBottom: 8,
  },
  rootCompact: {
    marginBottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  heading: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  effectBlock: {
    gap: 2,
  },
  itemName: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  effectLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.3,
    paddingLeft: 4,
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.3,
    marginTop: 2,
  },
});
