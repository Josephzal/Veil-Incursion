import React, { useEffect, useRef } from 'react';
import { StyleSheet, Vibration, View } from 'react-native';
import type { DamageChannel } from '../../types/aegisCombat';
import { shouldSuppressWardenCritImpactSlash } from '../../data/wardenStrikePresentation';

const HIT_STOP_MS = 150;

interface CombatEnemyCritImpactProps {
  critImpactSeq?: number;
  channel?: DamageChannel;
  onHitStopChange?: (frozen: boolean) => void;
  children: React.ReactNode;
}

/**
 * Crit hit-stop / haptic only — mustard/amber slash VFX removed.
 */
export default function CombatEnemyCritImpact({
  critImpactSeq = 0,
  channel: _channel,
  onHitStopChange,
  children,
}: CombatEnemyCritImpactProps): React.JSX.Element {
  const lastSeqRef = useRef(0);

  useEffect(() => {
    if (critImpactSeq <= 0 || critImpactSeq === lastSeqRef.current) return;
    lastSeqRef.current = critImpactSeq;

    // Warden owns its own contact language — no extra crit juice.
    if (shouldSuppressWardenCritImpactSlash()) {
      return;
    }

    onHitStopChange?.(true);
    Vibration.vibrate([0, 20, 30, 70, 25, 110]);

    const releaseTimer = setTimeout(() => {
      onHitStopChange?.(false);
    }, HIT_STOP_MS);

    return () => {
      clearTimeout(releaseTimer);
      onHitStopChange?.(false);
    };
  }, [critImpactSeq, onHitStopChange]);

  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
});
