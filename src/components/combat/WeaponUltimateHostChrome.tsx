import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import type { WeaponUltimateGrade } from '../../types/weaponUltimateInteraction';

interface WeaponUltimateHostChromeProps {
  active: boolean;
  title: string;
  /** Free cancel — never spends ultimate resources. */
  onCancel: () => void;
  gradeHint?: WeaponUltimateGrade | null;
  simplified?: boolean;
  lastHeartbeat?: {
    selected: boolean;
    costHp: number;
    onToggle: (selected: boolean) => void;
  } | null;
  children: React.ReactNode;
}

/**
 * Shared chrome for modal weapon ultimates (WU-3).
 * Wraps existing minigames; Cancel is always free.
 */
export default function WeaponUltimateHostChrome({
  active,
  title,
  onCancel,
  gradeHint = null,
  simplified = false,
  lastHeartbeat = null,
  children,
}: WeaponUltimateHostChromeProps): React.JSX.Element {
  return (
    <View style={styles.root} pointerEvents="box-none">
      {children}
      {active ? (
        <View style={styles.chrome} pointerEvents="box-none">
          <Text style={styles.title}>{title}</Text>
          {simplified ? (
            <Text style={styles.hint}>SIMPLIFIED INPUTS — STANDARD GRADE ONLY</Text>
          ) : (
            <Text style={styles.hint}>
              GRADES // STANDARD · CLEAN · PERFECT
              {gradeHint ? ` — LIVE ${gradeHint}` : ''}
            </Text>
          )}
          <HapticPressable
            style={styles.cancelBtn}
            onPress={onCancel}
            accessibilityLabel="Cancel ultimate — free, no resource spend"
          >
            <Text style={styles.cancelLabel}>[ CANCEL — FREE ]</Text>
          </HapticPressable>
          {lastHeartbeat ? (
            <HapticPressable
              style={styles.cancelBtn}
              onPress={() => lastHeartbeat.onToggle(!lastHeartbeat.selected)}
              accessibilityLabel="Last Heartbeat optional HP cost"
            >
              <Text style={styles.cancelLabel}>
                {lastHeartbeat.selected
                  ? `[ LAST HEARTBEAT — ${lastHeartbeat.costHp} HP ]`
                  : `[ LAST HEARTBEAT — OFF ]`}
              </Text>
            </HapticPressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    elevation: 60,
  },
  chrome: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
    zIndex: 70,
    elevation: 70,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: 1,
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#94a3b8',
  },
  cancelBtn: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.65)',
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
  },
  cancelLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: '#fca5a5',
    letterSpacing: 0.8,
  },
});
