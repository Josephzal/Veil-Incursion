import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import type { WeaponCombatCallout } from '../../types/weaponPlayerFacing';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';

interface WeaponCombatCalloutStripProps {
  callouts: readonly WeaponCombatCallout[];
}

/**
 * Compact weapon-loop callouts for the combat HUD.
 * Informational only — no glow that implies clickable controls.
 */
export default function WeaponCombatCalloutStrip({
  callouts,
}: WeaponCombatCalloutStripProps): React.JSX.Element | null {
  if (!callouts.length) return null;
  return (
    <View style={styles.row} accessibilityRole="text">
      {callouts.map((c) => (
        <View
          key={c.id}
          style={[
            styles.chip,
            c.tone === 'ready' && styles.chipReady,
            c.tone === 'warn' && styles.chipWarn,
            c.tone === 'risk' && styles.chipRisk,
          ]}
        >
          <TerminalText
            size={COMBAT_HUD_TYPE.label - 1}
            letterSpacing={0.6}
            style={[
              styles.text,
              c.tone === 'ready' && styles.textReady,
              c.tone === 'warn' && styles.textWarn,
              c.tone === 'risk' && styles.textRisk,
            ]}
            numberOfLines={1}
          >
            {c.label}
          </TerminalText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
    marginBottom: 2,
  },
  chip: {
    borderWidth: 1,
    borderColor: OTT.borderSubtle,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipReady: {
    borderColor: 'rgba(105, 200, 173, 0.45)',
  },
  chipWarn: {
    borderColor: 'rgba(220, 180, 80, 0.4)',
  },
  chipRisk: {
    borderColor: 'rgba(180, 90, 160, 0.45)',
  },
  text: {
    color: OTT.textSecondary,
    fontWeight: '700',
  },
  textReady: { color: OTT.terminalGreenMuted },
  textWarn: { color: '#D4B85A' },
  textRisk: { color: '#C48BC0' },
});
