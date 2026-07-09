import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import DossierCardShell from './DossierCardShell';
import { HubSectionHeader } from './HubScreenShell';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import {
  EXPEDITION_KEEPSAKE_REGISTRY,
  listKeepsakeDefinitions,
} from '../../data/expeditionKeepsakeRegistry';
import type { KeepsakeId } from '../../types/expeditionKeepsake';
import { formatBracketHeader } from '../../styles/hubTerminalUi';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

interface KeepsakeLoadoutPanelProps {
  accent: string;
  muted: string;
}

export default function KeepsakeLoadoutPanel({
  accent,
  muted,
}: KeepsakeLoadoutPanelProps): React.JSX.Element {
  const { account, setEquippedKeepsake } = usePlayerAccount();
  const { scaleSpacing } = useHubLayout();

  const keepsakes = useMemo(
    () => listKeepsakeDefinitions(account.unlockedKeepsakeIds),
    [account.unlockedKeepsakeIds],
  );

  const equipped = account.equippedKeepsakeId
    ? EXPEDITION_KEEPSAKE_REGISTRY[account.equippedKeepsakeId]
    : null;

  const handleSelect = (id: KeepsakeId) => {
    setEquippedKeepsake(account.equippedKeepsakeId === id ? null : id);
  };

  return (
    <View style={[styles.root, { gap: scaleSpacing(8) }]}>
      <TerminalText variant="section" letterSpacing={1.1} style={{ color: accent }}>
        {formatBracketHeader('EXPEDITION KEEPSAKE')}
      </TerminalText>
      <DossierCardShell padding={scaleSpacing(10)} accentColor={accent}>
        <TerminalText variant="caption" style={{ color: muted, marginBottom: scaleSpacing(6) }}>
          Equip one keepsake before descent. Expedition modifiers — not combat boons.
        </TerminalText>
        {equipped ? (
          <>
            <HubSectionHeader title="EQUIPPED" color={accent} size={8} />
            <TerminalText variant="body" letterSpacing={0.35} style={[styles.equippedName, { color: accent }]}>
              {equipped.name.toUpperCase()}
            </TerminalText>
            <TerminalText variant="caption" style={{ color: muted }}>
              {equipped.effectSummary}
            </TerminalText>
          </>
        ) : (
          <TerminalText variant="body" style={{ color: muted }}>
            NONE EQUIPPED — select one keepsake below.
          </TerminalText>
        )}
      </DossierCardShell>

      <View style={[styles.list, { gap: scaleSpacing(6) }]}>
        {keepsakes.map((keepsake) => {
          const selected = account.equippedKeepsakeId === keepsake.id;
          return (
            <HapticPressable
              key={keepsake.id}
              onPress={() => handleSelect(keepsake.id)}
              style={(state) => [
                styles.row,
                {
                  borderColor: selected ? accent : muted,
                  backgroundColor: selected ? `${accent}12` : 'rgba(0,0,0,0.25)',
                  padding: scaleSpacing(8),
                },
                terminalHoverStyle(readPressableHover(state), state.pressed),
              ]}
            >
              <TerminalText variant="body" style={{ color: selected ? accent : accent, fontWeight: '700' }}>
                {keepsake.name.toUpperCase()}
              </TerminalText>
              <TerminalText variant="caption" style={{ color: muted, marginTop: 2 }}>
                {keepsake.tags.join(' · ')}
              </TerminalText>
              <TerminalText variant="caption" style={{ color: muted, marginTop: 4 }}>
                {keepsake.effectSummary}
              </TerminalText>
            </HapticPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  equippedName: {
    fontWeight: '700',
    marginBottom: 4,
  },
  list: {
    width: '100%',
  },
  row: {
    borderWidth: 1,
  },
});
