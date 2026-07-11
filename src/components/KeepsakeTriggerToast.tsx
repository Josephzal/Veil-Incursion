import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { formatKeepsakeTriggerToast } from '../data/expeditionKeepsakeRunUiEngine';

const TOAST_VISIBLE_MS = 3200;

/** Brief terminal-style toast when a relic trigger message lands in runtime. */
export default function KeepsakeTriggerToast(): React.JSX.Element | null {
  const { activeIncursion } = useRun();
  const { theme } = useTerminal();
  const runtime = activeIncursion.keepsakeRuntime;
  const seenCountRef = useRef(0);
  const lastKeepsakeIdRef = useRef<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastLine, setToastLine] = useState<string | null>(null);

  useEffect(() => {
    if (!runtime) {
      seenCountRef.current = 0;
      lastKeepsakeIdRef.current = null;
      setToastLine(null);
      return;
    }

    if (lastKeepsakeIdRef.current !== runtime.keepsakeId) {
      seenCountRef.current = 0;
      lastKeepsakeIdRef.current = runtime.keepsakeId;
    }

    const messages = runtime.messages;
    if (messages.length <= seenCountRef.current) return;

    const latestMessage = messages[messages.length - 1] ?? '';
    seenCountRef.current = messages.length;
    setToastLine(formatKeepsakeTriggerToast(runtime, latestMessage));

    fade.setValue(0);
    Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(TOAST_VISIBLE_MS - 360),
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setToastLine(null), TOAST_VISIBLE_MS);
  }, [fade, runtime?.keepsakeId, runtime?.messages]);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  if (!toastLine) return null;

  return (
    <Animated.View style={[styles.host, { opacity: fade }]} pointerEvents="none">
      <View style={[styles.toast, { borderColor: `${theme.statusColor}88`, backgroundColor: 'rgba(0,0,0,0.72)' }]}>
        <Text style={[styles.text, { color: theme.statusColor }]} numberOfLines={3}>
          {toastLine}
        </Text>
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
    zIndex: 40,
    elevation: 40,
    alignItems: 'flex-end',
  },
  toast: {
    maxWidth: 280,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 13,
  },
});
