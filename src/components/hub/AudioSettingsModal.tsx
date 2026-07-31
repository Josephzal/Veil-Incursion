import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import {
  getAudioPrefs,
  nudgeAudioPref,
  resetAudioPrefs,
  subscribeAudioPrefs,
  type AudioPrefs,
} from '../../utils/audioPrefs';
import { playUiClick } from '../../utils/uiFeedbackAudio';
import { VEIL } from '../../theme/veilTerminalTokens';

interface AudioSettingsModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const STEP = 0.1;
const CHANNELS: Array<{ key: keyof AudioPrefs; label: string; detail: string }> = [
  { key: 'master', label: 'MASTER', detail: 'Scales music and SFX together' },
  { key: 'music', label: 'MUSIC', detail: 'Hub and in-run music beds' },
  { key: 'sfx', label: 'SFX', detail: 'Combat hits, UI clicks, feedback' },
];

function VolumeRow({
  label,
  detail,
  value,
  onNudge,
}: {
  label: string;
  detail: string;
  value: number;
  onNudge: (delta: number) => void;
}): React.JSX.Element {
  const pct = Math.round(value * 100);
  const fillPct = Math.max(0, Math.min(100, pct));

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <TerminalText size={9} letterSpacing={1.2} style={styles.rowLabel}>
          {label}
        </TerminalText>
        <TerminalText size={9} letterSpacing={0.8} style={styles.rowPct}>
          {`${pct}%`}
        </TerminalText>
      </View>
      <TerminalText size={7} letterSpacing={0.4} style={styles.rowDetail}>
        {detail}
      </TerminalText>
      <View style={styles.controlRow}>
        <HapticPressable
          onPress={() => onNudge(-STEP)}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={(state) => [
            styles.stepBtn,
            state.pressed ? styles.stepBtnPressed : null,
          ]}
        >
          <TerminalText size={12} style={styles.stepBtnText}>−</TerminalText>
        </HapticPressable>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${fillPct}%` }]} />
        </View>
        <HapticPressable
          onPress={() => onNudge(STEP)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={(state) => [
            styles.stepBtn,
            state.pressed ? styles.stepBtnPressed : null,
          ]}
        >
          <TerminalText size={12} style={styles.stepBtnText}>+</TerminalText>
        </HapticPressable>
      </View>
    </View>
  );
}

/** Hub audio mix — master / music / SFX. */
export default function AudioSettingsModal({
  visible,
  onDismiss,
}: AudioSettingsModalProps): React.JSX.Element {
  const [prefs, setPrefs] = useState<AudioPrefs>(() => getAudioPrefs());

  useEffect(() => {
    if (!visible) return undefined;
    setPrefs(getAudioPrefs());
    return subscribeAudioPrefs(setPrefs);
  }, [visible]);

  const handleNudge = (key: keyof AudioPrefs, delta: number) => {
    const next = nudgeAudioPref(key, delta);
    setPrefs(next);
    if (key === 'sfx' || key === 'master') {
      playUiClick();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <HapticPressable
          sfx={false}
          onPress={onDismiss}
          style={styles.backdropDismiss}
          accessibilityLabel="Dismiss audio settings"
        />
        <View style={styles.panel}>
          <TerminalText size={10} letterSpacing={1.4} style={styles.title}>
            [ AUDIO SETTINGS ]
          </TerminalText>
          <TerminalText size={7.5} letterSpacing={0.5} style={styles.subtitle}>
            Adjust mix levels for this session.
          </TerminalText>

          <View style={styles.rows}>
            {CHANNELS.map((channel) => (
              <VolumeRow
                key={channel.key}
                label={channel.label}
                detail={channel.detail}
                value={prefs[channel.key]}
                onNudge={(delta) => handleNudge(channel.key, delta)}
              />
            ))}
          </View>

          <View style={styles.footer}>
            <HapticPressable
              onPress={() => {
                setPrefs(resetAudioPrefs());
                playUiClick();
              }}
              style={(state) => [
                styles.footerBtn,
                state.pressed ? styles.footerBtnPressed : null,
              ]}
            >
              <TerminalText size={8} letterSpacing={1} style={styles.footerBtnText}>
                RESET
              </TerminalText>
            </HapticPressable>
            <HapticPressable
              onPress={onDismiss}
              style={(state) => [
                styles.footerBtn,
                styles.footerBtnPrimary,
                state.pressed ? styles.footerBtnPressed : null,
              ]}
            >
              <TerminalText size={8} letterSpacing={1} style={styles.footerBtnPrimaryText}>
                CLOSE
              </TerminalText>
            </HapticPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  panel: {
    zIndex: 1,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.45)',
    backgroundColor: VEIL.surfaceRaised,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  title: {
    color: VEIL.mintBright,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: VEIL.textMuted,
    textAlign: 'center',
    marginTop: -6,
  },
  rows: {
    gap: 14,
  },
  row: {
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.18)',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    color: VEIL.mint,
    fontWeight: '800',
  },
  rowPct: {
    color: VEIL.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rowDetail: {
    color: VEIL.textMuted,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  stepBtn: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.35)',
    backgroundColor: 'rgba(105, 200, 173, 0.08)',
  },
  stepBtnPressed: {
    backgroundColor: 'rgba(105, 200, 173, 0.2)',
  },
  stepBtnText: {
    color: VEIL.mintBright,
    fontWeight: '800',
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: 'rgba(105, 200, 173, 0.75)',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  footerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  footerBtnPrimary: {
    borderColor: 'rgba(105, 200, 173, 0.55)',
    backgroundColor: 'rgba(105, 200, 173, 0.12)',
  },
  footerBtnPressed: {
    opacity: 0.8,
  },
  footerBtnText: {
    color: VEIL.textMuted,
    fontWeight: '700',
  },
  footerBtnPrimaryText: {
    color: VEIL.mintBright,
    fontWeight: '800',
  },
});
