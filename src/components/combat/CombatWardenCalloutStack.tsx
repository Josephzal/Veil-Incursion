/**
 * Target-local Warden damage + defense + critical callout stack.
 * Absolute lanes from resolveWardenCalloutLanes — never shares one animated origin.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { textGlow } from '../../utils/adaptiveStyles';
import type { StatusFloatTone } from '../../utils/combatTelemetryFormat';
import type { DamageChannel } from '../../types/aegisCombat';
import {
  WARDEN_CALLOUT_HOTSPOT_AVOID_X,
  WARDEN_CALLOUT_HOTSPOT_AVOID_Y,
  WARDEN_CALLOUT_MIN_GAP_PX,
  resolveWardenCalloutLanes,
} from '../../data/wardenCalloutLayout';
import { isWardenStrikePresentationActive } from '../../data/wardenStrikePresentation';

const MONO = 'monospace';

const TONE_COLORS: Record<StatusFloatTone, string> = {
  fortify: '#7c8fa8',
  evade: '#9ca3af',
  charge: '#a8917c',
  neutral: '#8b949e',
  armor: '#c8d0dc',
  ward: '#a78bfa',
};

function critColor(channel?: DamageChannel): string {
  return channel === 'OCCULT' ? '#c084fc' : '#fbbf24';
}

interface CombatWardenCalloutStackProps {
  damageSeq?: number;
  damageLabel?: string;
  statusSeq?: number;
  statusLabel?: string;
  statusTone?: StatusFloatTone;
  critImpactSeq?: number;
  critImpactChannel?: DamageChannel;
  durationMs?: number;
}

function useFloatVisibility(
  seq: number,
  label: string,
  durationMs: number,
): {
  visible: boolean;
  opacity: Animated.Value;
  scale: Animated.Value;
  translateY: Animated.Value;
} {
  const lastSeq = useRef(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (seq <= 0 || seq === lastSeq.current || !label) return;
    lastSeq.current = seq;
    animRef.current?.stop();
    setVisible(true);
    opacity.setValue(0);
    scale.setValue(0.92);
    translateY.setValue(0);
    const fadeInMs = 90;
    const fadeOutMs = Math.max(180, Math.floor(durationMs * 0.35));
    const holdMs = Math.max(0, durationMs - fadeInMs - fadeOutMs);
    // One continuous rise — no mid-flight easing swap (avoids hitch/jitter).
    const anim = Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: fadeInMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(holdMs),
        Animated.timing(opacity, {
          toValue: 0,
          duration: fadeOutMs,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: -56,
        duration: durationMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) setVisible(false);
    });
    return () => {
      anim.stop();
    };
  }, [durationMs, label, opacity, scale, seq, translateY]);

  return { visible, opacity, scale, translateY };
}

/** Estimated rendered metrics after font size / weight (CSS px). */
const DAMAGE_METRICS = { width: 40, height: 20 };
const DEFENSE_METRICS = { width: 118, height: 16 };
const CRITICAL_METRICS = { width: 78, height: 16 };

export default function CombatWardenCalloutStack({
  damageSeq = 0,
  damageLabel = '',
  statusSeq = 0,
  statusLabel = '',
  statusTone = 'neutral',
  critImpactSeq = 0,
  critImpactChannel,
  durationMs = 1000,
}: CombatWardenCalloutStackProps): React.JSX.Element | null {
  const warden = isWardenStrikePresentationActive();
  const damage = useFloatVisibility(damageSeq, damageLabel, durationMs);
  const status = useFloatVisibility(statusSeq, statusLabel, durationMs);
  const critical = useFloatVisibility(
    critImpactSeq,
    critImpactSeq > 0 ? 'CRITICAL' : '',
    durationMs,
  );

  const isNumericDamage = /^\d+$/.test(damageLabel);
  // Lane plan from content intent — not animated visibility — so lanes never reflow mid-float.
  const intendDamage = isNumericDamage && damageLabel.length > 0 && damageSeq > 0;
  const intendDefense = statusLabel.length > 0 && !/^\d+$/.test(statusLabel) && statusSeq > 0;
  const intendCritical = critImpactSeq > 0;
  const showDamage = damage.visible && intendDamage;
  const showDefense = status.visible && intendDefense;
  const showCritical = critical.visible && intendCritical;

  const plan = useMemo(
    () => resolveWardenCalloutLanes({
      hasDamage: intendDamage,
      hasDefense: intendDefense,
      hasCritical: intendCritical,
      damageSize: DAMAGE_METRICS,
      defenseSize: DEFENSE_METRICS,
      criticalSize: CRITICAL_METRICS,
      minGapPx: WARDEN_CALLOUT_MIN_GAP_PX,
      hotspotAvoidOffsetX: WARDEN_CALLOUT_HOTSPOT_AVOID_X,
      hotspotAvoidOffsetY: WARDEN_CALLOUT_HOTSPOT_AVOID_Y,
    }),
    [intendCritical, intendDamage, intendDefense],
  );

  if (!showDamage && !showDefense && !showCritical) return null;

  void warden;
  const critTint = critColor(critImpactChannel);

  return (
    <View style={styles.root} pointerEvents="none">
      {showCritical && plan.critical ? (
        <Animated.Text
          style={[
            styles.critical,
            {
              color: critTint,
              opacity: critical.opacity,
              left: plan.critical.left,
              top: plan.critical.top,
              width: plan.critical.width,
              height: plan.critical.height,
              transform: [{ translateY: critical.translateY }, { scale: critical.scale }],
              ...textGlow({ color: critTint, radius: 8, offset: { width: 0, height: 0 } }),
            },
          ]}
        >
          CRITICAL
        </Animated.Text>
      ) : null}
      {showDefense && plan.defense ? (
        <Animated.Text
          style={[
            styles.defense,
            {
              color: TONE_COLORS[statusTone],
              opacity: status.opacity,
              left: plan.defense.left,
              top: plan.defense.top,
              width: plan.defense.width,
              height: plan.defense.height,
              transform: [{ translateY: status.translateY }, { scale: status.scale }],
              ...textGlow({ color: TONE_COLORS[statusTone], radius: 6, offset: { width: 0, height: 0 } }),
            },
          ]}
        >
          {statusLabel.toUpperCase()}
        </Animated.Text>
      ) : null}
      {showDamage && plan.damage ? (
        <Animated.Text
          style={[
            styles.damage,
            {
              opacity: damage.opacity,
              left: plan.damage.left,
              top: plan.damage.top,
              width: plan.damage.width,
              height: plan.damage.height,
              transform: [{ translateY: damage.translateY }, { scale: damage.scale }],
              ...textGlow({ color: '#f1f5f9', radius: 6, offset: { width: 0, height: 0 } }),
            },
          ]}
        >
          {damageLabel}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    overflow: 'visible',
  },
  damage: {
    position: 'absolute',
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    color: '#f1f5f9',
    lineHeight: 20,
  },
  defense: {
    position: 'absolute',
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
    lineHeight: 16,
  },
  critical: {
    position: 'absolute',
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textAlign: 'center',
    lineHeight: 16,
  },
});
