import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { useRun } from '../context/RunContext';
import type { TerminalTheme } from '../types/theme';
import {
  RUN_STATUS_CATEGORY_LABELS,
  buildOperativeVitalsLine,
  buildRunStatusSnapshot,
  groupRunStatusEntries,
} from '../utils/runStatusSnapshot';
import type { RunStatusCategory } from '../utils/runStatusSnapshot';
import { RESONANCE_SYSTEM_ACTIVE } from '../data/featureFlags';

import {
  COMBAT_POPUP_BODY_FONT,
  COMBAT_POPUP_SCALE,
} from '../constants/combatOverlayTypography';

const TERMINAL_ACCENT = '#00ff33';
const CATEGORY_ORDER: RunStatusCategory[] = RESONANCE_SYSTEM_ACTIVE
  ? ['SECTOR', 'BOON', 'HAZARD', 'MACRO', 'ENVIRONMENT', 'RESONANCE']
  : ['SECTOR', 'BOON', 'HAZARD', 'MACRO', 'ENVIRONMENT'];

interface RunStatusOverlayProps {
  visible: boolean;
  theme: TerminalTheme;
  accentColor?: string;
  onClose: () => void;
  combatMode?: boolean;
}

export default function RunStatusOverlay({
  visible,
  theme,
  accentColor = TERMINAL_ACCENT,
  onClose,
  combatMode = false,
}: RunStatusOverlayProps): React.JSX.Element {
  const { runState, activeIncursion } = useRun();

  const vitalsLine = useMemo(
    () => buildOperativeVitalsLine(runState, activeIncursion),
    [runState, activeIncursion],
  );

  const grouped = useMemo(() => {
    const entries = buildRunStatusSnapshot(activeIncursion);
    return groupRunStatusEntries(entries);
  }, [activeIncursion]);

  const hasAny = CATEGORY_ORDER.some((cat) => grouped[cat].length > 0);
  const popupScale = combatMode ? COMBAT_POPUP_SCALE : 1;
  const bodyFont = combatMode ? COMBAT_POPUP_BODY_FONT : 8;
  const bodyLineHeight = bodyFont + 4;
  const panelMaxWidth = Math.round(420 * popupScale);
  const panelPadding = Math.round(14 * popupScale);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <HapticPressable style={styles.backdropTap} onPress={onClose} />
        <HapticPressable
          style={[
            styles.panel,
            {
              borderColor: accentColor,
              maxWidth: panelMaxWidth,
              padding: panelPadding,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.bodyText, { color: accentColor, fontSize: bodyFont, lineHeight: bodyLineHeight }]}>
            OPERATIVE STATUS // RUN MANIFEST
          </Text>

          <View style={[styles.vitalsBlock, { borderColor: accentColor }]}>
            <Text style={[styles.bodyText, { color: theme.mutedColor, fontSize: bodyFont, lineHeight: bodyLineHeight }]}>
              OPERATIVE VITALS
            </Text>
            <Text style={[styles.bodyText, { color: accentColor, fontSize: bodyFont, lineHeight: bodyLineHeight }]}>
              {vitalsLine}
            </Text>
          </View>

          <ScrollView
            style={[styles.scroll, combatMode ? { maxHeight: Math.round(320 * COMBAT_POPUP_SCALE) } : null]}
            showsVerticalScrollIndicator={false}
          >
            {!hasAny ? (
              <Text style={[styles.bodyText, { color: theme.mutedColor, fontSize: bodyFont, lineHeight: bodyLineHeight }]}>
                No active buffs, debuffs, or boons. Sector conditions nominal.
              </Text>
            ) : (
              CATEGORY_ORDER.map((category) => {
                const items = grouped[category];
                if (items.length === 0) return null;
                return (
                  <View key={category} style={styles.section}>
                    <Text style={[styles.bodyText, { color: theme.mutedColor, fontSize: bodyFont, lineHeight: bodyLineHeight }]}>
                      {RUN_STATUS_CATEGORY_LABELS[category].toUpperCase()}
                    </Text>
                    {items.map((entry) => (
                      <View key={entry.id} style={styles.entry}>
                        <Text style={[styles.bodyText, { color: accentColor, fontSize: bodyFont, lineHeight: bodyLineHeight }]}>
                          {entry.label}
                        </Text>
                        <Text style={[styles.bodyText, { color: theme.textColor, fontSize: bodyFont, lineHeight: bodyLineHeight }]}>
                          {entry.description}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </ScrollView>

          <HapticPressable onPress={onClose} style={[styles.closeBtn, { borderColor: accentColor }]}>
            <Text style={[styles.bodyText, { color: accentColor, fontSize: bodyFont, lineHeight: bodyLineHeight }]}>
              [ DISMISS ]
            </Text>
          </HapticPressable>
        </HapticPressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    width: '92%',
    maxHeight: '78%',
    backgroundColor: '#0a0b0f',
    borderWidth: 1,
    zIndex: 2,
  },
  bodyText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  vitalsBlock: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 8,
    gap: 4,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 320,
  },
  section: {
    marginBottom: 12,
  },
  entry: {
    marginBottom: 8,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#1a2a1a',
  },
  closeBtn: {
    marginTop: 10,
    alignSelf: 'center',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
});
