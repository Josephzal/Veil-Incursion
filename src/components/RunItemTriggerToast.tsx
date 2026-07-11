import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { formatRunItemTriggerToast } from '../data/runItemRunUiEngine';

const TOAST_VISIBLE_MS = 3200;

/** Brief terminal-style toast when a run item trigger message lands in runtime. */
export default function RunItemTriggerToast(): React.JSX.Element | null {
  const { activeIncursion } = useRun();
  const { theme } = useTerminal();
  const runtime = activeIncursion.itemRuntime;
  const slots = activeIncursion.runItems;
  const seenCountRef = useRef(0);
  const fade = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastLine, setToastLine] = useState<string | null>(null);

  useEffect(() => {
    const messages = runtime.messages;
    if (messages.length <= seenCountRef.current) return;

    const latestMessage = messages[messages.length - 1] ?? '';
    seenCountRef.current = messages.length;
    setToastLine(formatRunItemTriggerToast(runtime, latestMessage, slots));

    fade.setValue(0);
    Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(TOAST_VISIBLE_MS - 360),
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setToastLine(null), TOAST_VISIBLE_MS);
  }, [fade, runtime.messages, runtime, slots]);

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
    top: 88,
    right: 8,
    left: 8,
    zIndex: 39,
    elevation: 39,
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
