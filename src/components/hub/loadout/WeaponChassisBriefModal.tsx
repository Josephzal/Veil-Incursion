import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import TerminalText from '../../TerminalText';
import HubDossierCornerBrackets from '../HubDossierCornerBrackets';
import type { WeaponPlayerFacingSummary } from '../../../types/weaponPlayerFacing';
import HubPrimaryCta from '../HubPrimaryCta';
import {
  HUB_CARD_BORDER,
  HUB_DOSSIER_LABEL,
  HUB_DOSSIER_SURFACE,
  HUB_DOSSIER_TITLE,
  HUB_META,
  HUB_TEXT_SECONDARY,
} from '../../../theme/hubPanelSurfaces';
import { VEIL } from '../../../theme/veilTerminalTokens';

interface WeaponChassisBriefModalProps {
  visible: boolean;
  summary: WeaponPlayerFacingSummary | null;
  onAcknowledge: () => void;
  onDismissWithoutAck?: () => void;
  mode?: 'first-use' | 'reopen';
}

/**
 * Single-page first-use / reopen tactical brief. Never interrupts combat.
 */
export default function WeaponChassisBriefModal({
  visible,
  summary,
  onAcknowledge,
  onDismissWithoutAck,
  mode = 'first-use',
}: WeaponChassisBriefModalProps): React.JSX.Element | null {
  if (!summary) return null;
  const brief = summary.firstUseBrief;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (mode === 'reopen') onDismissWithoutAck?.();
        else onAcknowledge();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (mode === 'reopen') onDismissWithoutAck?.();
        }}
        accessibilityLabel="Dismiss weapon brief backdrop"
      >
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
          <HubDossierCornerBrackets />
          <TerminalText size={7} letterSpacing={1.1} style={styles.eyebrow}>
            {mode === 'first-use' ? 'FIRST DEPLOYMENT BRIEF' : 'CHASSIS TACTICAL BRIEF'}
          </TerminalText>
          <TerminalText size={14} letterSpacing={0.2} style={styles.title} numberOfLines={2}>
            {summary.displayName.toUpperCase()}
          </TerminalText>
          <TerminalText size={8} letterSpacing={0.7} style={styles.role}>
            {summary.roleLabel.toUpperCase()}
          </TerminalText>

          <View style={styles.block}>
            <TerminalText size={7} letterSpacing={1} style={styles.label}>CORE LOOP</TerminalText>
            <TerminalText size={9} style={styles.body}>{brief.coreLoop}</TerminalText>
          </View>
          <View style={styles.block}>
            <TerminalText size={7} letterSpacing={1} style={styles.label}>DO THIS</TerminalText>
            <TerminalText size={9} style={styles.body}>{brief.doThis}</TerminalText>
          </View>
          <View style={styles.block}>
            <TerminalText size={7} letterSpacing={1} style={styles.label}>AVOID</TerminalText>
            <TerminalText size={9} style={styles.body}>{brief.avoidThis}</TerminalText>
          </View>
          <View style={styles.block}>
            <TerminalText size={7} letterSpacing={1} style={styles.label}>WATCH</TerminalText>
            <TerminalText size={9} style={styles.body}>{brief.watchThis}</TerminalText>
          </View>
          <View style={[styles.block, styles.blockLast]}>
            <TerminalText size={7} letterSpacing={1} style={styles.label}>BUILD TOWARD</TerminalText>
            <TerminalText size={9} style={styles.body}>{brief.buildToward}</TerminalText>
          </View>

          <HubPrimaryCta
            label={mode === 'first-use' ? '[ ACKNOWLEDGE ]' : '[ CLOSE BRIEF ]'}
            onPress={onAcknowledge}
            accessibilityLabel={mode === 'first-use' ? 'Acknowledge weapon brief' : 'Close weapon brief'}
            style={styles.cta}
            size={9}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: HUB_DOSSIER_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    position: 'relative',
    ...Platform.select({
      web: { boxShadow: `0 0 0 1px ${VEIL.lineFaint}` } as object,
      default: {},
    }),
  },
  eyebrow: { color: HUB_DOSSIER_LABEL, fontWeight: '700', marginBottom: 6 },
  title: { color: HUB_DOSSIER_TITLE, fontWeight: '800' },
  role: { color: HUB_META, fontWeight: '700', marginTop: 4, marginBottom: 14 },
  block: { marginBottom: 12 },
  blockLast: { marginBottom: 18 },
  label: { color: HUB_DOSSIER_LABEL, fontWeight: '700', marginBottom: 3 },
  body: { color: HUB_TEXT_SECONDARY, lineHeight: 16 },
  cta: { alignSelf: 'stretch' },
});
