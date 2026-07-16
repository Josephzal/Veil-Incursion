import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EnemyIntentDetail } from '../../../utils/enemyIntentDescriptions';
import {
  COMBAT_POPUP_BODY_FONT,
  COMBAT_POPUP_SCALE,
} from '../../../constants/combatOverlayTypography';
import { severityColor } from '../../../data/enemyIntentCatalog';

const MONO = 'monospace';
const PANEL_MAX_WIDTH = Math.round(340 * COMBAT_POPUP_SCALE);
const PANEL_PADDING_H = Math.round(14 * COMBAT_POPUP_SCALE);
const PANEL_PADDING_V = Math.round(12 * COMBAT_POPUP_SCALE);

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
  const bodyStyle = {
    fontSize: COMBAT_POPUP_BODY_FONT,
    lineHeight: COMBAT_POPUP_BODY_FONT + 4,
  };
  const sevColor = detail?.severity ? severityColor(detail.severity) : borderColor;

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
        <Pressable
          style={[
            styles.card,
            {
              borderColor: sevColor,
              maxWidth: PANEL_MAX_WIDTH,
              paddingHorizontal: PANEL_PADDING_H,
              paddingVertical: PANEL_PADDING_V,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          {detail ? (
            <>
              <Text style={[styles.body, bodyStyle]}>HOSTILE INTENT // ANALYSIS</Text>
              <Text style={[styles.body, bodyStyle, styles.titleTone, { color: sevColor }]}>
                {detail.title}
              </Text>
              {detail.severity || detail.intentType ? (
                <Text style={[styles.body, bodyStyle, styles.metaTone]}>
                  {[
                    detail.intentType?.replace(/_/g, ' '),
                    detail.severity,
                    detail.turnsRemaining != null && detail.turnsRemaining > 0
                      ? `T-${detail.turnsRemaining}`
                      : null,
                    detail.isTelegraph ? 'TELEGRAPH' : null,
                  ].filter(Boolean).join(' // ')}
                </Text>
              ) : null}
              <Text style={[styles.body, bodyStyle]}>{detail.summary}</Text>
              <Text style={[styles.body, bodyStyle, styles.sectionTone]}>EFFECT</Text>
              <Text style={[styles.body, bodyStyle]}>{detail.effect}</Text>
              {detail.counterplay ? (
                <>
                  <Text style={[styles.body, bodyStyle, styles.sectionTone]}>COUNTERPLAY</Text>
                  <Text style={[styles.body, bodyStyle]}>{detail.counterplay}</Text>
                </>
              ) : null}
              <Text style={[styles.body, bodyStyle, styles.hintTone]}>TAP OUTSIDE TO CLOSE</Text>
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
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '92%',
    backgroundColor: 'rgba(10, 11, 15, 0.97)',
    borderWidth: 1,
    gap: 6,
    zIndex: 2,
  },
  body: {
    fontFamily: MONO,
    color: '#e2e8f0',
    letterSpacing: 0.25,
  },
  titleTone: {
    color: '#fca5a5',
    fontWeight: '800',
  },
  metaTone: {
    color: '#fbbf24',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  sectionTone: {
    color: '#93c5fd',
    fontWeight: '700',
    marginTop: 4,
  },
  hintTone: {
    color: 'rgba(148, 163, 184, 0.85)',
    marginTop: 6,
    textAlign: 'center',
  },
});
