import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';

const TOAST_VISIBLE_MS = 4200;

/** Terminal toast when Depth 2 Distortion / Depth 3 Law activates. */
export default function DepthIdentityToast(): React.JSX.Element | null {
  const { activeIncursion, acknowledgeDepthIdentityReveal } = useRun();
  const { theme } = useTerminal();
  const fade = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenKeyRef = useRef<string | null>(null);
  const [toastTitle, setToastTitle] = useState<string | null>(null);
  const [toastSummary, setToastSummary] = useState<string | null>(null);

  const pending = activeIncursion.depthIdentity?.pendingReveal ?? null;

  useEffect(() => {
    if (!pending) {
      setToastTitle(null);
      setToastSummary(null);
      return;
    }

    const key = `${pending.kind}:${pending.id}:${pending.title}`;
    if (seenKeyRef.current === key) return;
    seenKeyRef.current = key;

    setToastTitle(pending.title);
    setToastSummary(pending.summary);

    fade.setValue(0);
    Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(TOAST_VISIBLE_MS - 400),
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setToastTitle(null);
      setToastSummary(null);
      acknowledgeDepthIdentityReveal();
    }, TOAST_VISIBLE_MS);
  }, [acknowledgeDepthIdentityReveal, fade, pending]);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  if (!toastTitle) return null;

  return (
    <Animated.View style={[styles.host, { opacity: fade }]} pointerEvents="none">
      <View style={[styles.toast, { borderColor: `${theme.statusColor}88`, backgroundColor: 'rgba(0,0,0,0.78)' }]}>
        <Text style={[styles.title, { color: theme.statusColor }]} numberOfLines={2}>
          {toastTitle}
        </Text>
        {toastSummary ? (
          <Text style={[styles.summary, { color: theme.mutedColor }]} numberOfLines={3}>
            {toastSummary.toUpperCase()}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 44,
    right: 8,
    left: 8,
    zIndex: 41,
    elevation: 41,
    alignItems: 'center',
  },
  toast: {
    maxWidth: 340,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  summary: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },
});
