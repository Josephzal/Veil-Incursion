import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EnemyIntentDetail } from '../../../utils/enemyIntentDescriptions';

interface EnemyIntentDetailOverlayProps {
  visible: boolean;
  detail: EnemyIntentDetail | null;
  onDismiss: () => void;
  borderColor?: string;
}

export default function EnemyIntentDetailOverlay({
  visible,
  detail,
  onDismiss,
  borderColor = '#ef4444',
}: EnemyIntentDetailOverlayProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onDismiss} />
        <Pressable style={[styles.card, { borderColor }]} onPress={(event) => event.stopPropagation()}>
          {detail ? (
            <>
              <Text style={styles.kicker}>HOSTILE INTENT // ANALYSIS</Text>
              <Text style={styles.title}>{detail.title}</Text>
              <Text style={styles.body}>{detail.summary}</Text>
              <Text style={styles.sectionLabel}>EFFECT</Text>
              <Text style={styles.body}>{detail.effect}</Text>
              {detail.counterplay ? (
                <>
                  <Text style={styles.sectionLabel}>COUNTERPLAY</Text>
                  <Text style={styles.body}>{detail.counterplay}</Text>
                </>
              ) : null}
              <Text style={styles.dismissHint}>TAP OUTSIDE TO CLOSE</Text>
            </>
          ) : null}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '92%',
    maxWidth: 340,
    backgroundColor: 'rgba(10, 11, 15, 0.97)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    zIndex: 2,
  },
  kicker: {
    fontFamily: 'monospace',
    fontSize: 6,
    fontWeight: '700',
    color: 'rgba(248, 250, 252, 0.55)',
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '800',
    color: '#fca5a5',
    letterSpacing: 0.6,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 6,
    fontWeight: '700',
    color: '#93c5fd',
    letterSpacing: 0.7,
    marginTop: 4,
  },
  body: {
    fontFamily: 'monospace',
    fontSize: 7,
    lineHeight: 11,
    color: '#e2e8f0',
    letterSpacing: 0.25,
  },
  dismissHint: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: 'rgba(148, 163, 184, 0.85)',
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: 'center',
  },
});
