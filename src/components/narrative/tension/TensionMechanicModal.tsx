import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';

const FRAME_BG = '#050608';
const TERMINAL_ACCENT = '#00ff33';

/**
 * Shared popup frame for narrative tension minigames. Mirrors the in-combat
 * cargo/inventory overlay pattern: darkened backdrop + centered window that
 * floats above the encounter. The minigame owns its own title/copy; this only
 * provides the darkened stage and sized frame. Purely presentational — no
 * run-state mutation and no resolution logic.
 */
export default function TensionMechanicModal({
  children,
  accentColor = TERMINAL_ACCENT,
  label = 'TENSION PROTOCOL',
}: {
  children: React.ReactNode;
  accentColor?: string;
  label?: string;
}): React.JSX.Element {
  const { screenWidth, screenHeight, scaleSize } = useResponsiveLayout();

  const cardWidth = Math.min(screenWidth - scaleSize(18), scaleSize(460));
  const cardHeight = Math.min(screenHeight - scaleSize(52), scaleSize(700));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              width: cardWidth,
              height: cardHeight,
              borderColor: accentColor,
            },
          ]}
        >
          <View style={[styles.frameBar, { borderBottomColor: 'rgba(0,255,51,0.25)' }]}>
            <Text style={[styles.frameLabel, { color: accentColor }]} numberOfLines={1}>
              {`// ${label} // ENGAGED`}
            </Text>
            <Text style={[styles.frameDots, { color: accentColor }]}>■ ■ ■</Text>
          </View>
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  card: {
    borderWidth: 2,
    backgroundColor: FRAME_BG,
    overflow: 'hidden',
  },
  frameBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(0,255,51,0.05)',
  },
  frameLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    flex: 1,
  },
  frameDots: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 2,
    opacity: 0.7,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
});
