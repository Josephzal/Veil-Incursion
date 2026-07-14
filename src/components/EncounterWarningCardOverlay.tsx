import React, { useCallback } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import HapticPressable from './HapticPressable';
import TerminalText from './TerminalText';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useGameFlow } from '../context/GameFlowContext';
import {
  formatCompositionRoleLabel,
  formatEncounterRiskLabel,
} from '../data/encounterCompositionReadabilityEngine';

export default function EncounterWarningCardOverlay(): React.JSX.Element | null {
  const {
    activeIncursion,
    confirmEncounterWarning,
    cancelEncounterWarning,
  } = useRun();
  const { startCombat } = useGameFlow();
  const { theme } = useTerminal();

  const card = activeIncursion.pendingEncounterWarning;
  const accentColor = theme.primaryColor;
  const mutedColor = theme.mutedColor;

  const handleEnter = useCallback(() => {
    confirmEncounterWarning();
    startCombat();
  }, [confirmEncounterWarning, startCombat]);

  const handleBack = useCallback(() => {
    cancelEncounterWarning();
  }, [cancelEncounterWarning]);

  if (!card) return null;

  const depthName = card.depth === 1 ? 'Threshold' : card.depth === 2 ? 'Breach' : 'Deep Veil';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleBack}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: accentColor }]}>
          <TerminalText variant="section" style={{ color: accentColor, textAlign: 'center' }}>
            {`[ ${card.encounterName.toUpperCase()} ]`}
          </TerminalText>
          <TerminalText variant="caption" style={{ color: mutedColor, textAlign: 'center', marginTop: 8 }}>
            {`Risk: ${formatEncounterRiskLabel(card.riskLabel)}`}
          </TerminalText>
          <TerminalText variant="caption" style={{ color: mutedColor, textAlign: 'center', marginTop: 4 }}>
            {`Depth: ${depthName}${card.sectorLabel ? ` // ${card.sectorLabel}` : ''}`}
          </TerminalText>

          {card.overlays.length > 0 ? (
            <TerminalText variant="caption" style={{ color: mutedColor, textAlign: 'center', marginTop: 8 }}>
              {`Signals: ${card.overlays.join(' · ')}`}
            </TerminalText>
          ) : null}

          {card.enemyRoles.length > 0 ? (
            <View style={styles.block}>
              <TerminalText variant="caption" style={{ color: accentColor, textAlign: 'center' }}>
                Enemy Roles
              </TerminalText>
              {card.enemyRoles.map((role) => (
                <TerminalText
                  key={role}
                  variant="caption"
                  style={{ color: mutedColor, textAlign: 'center', marginTop: 2 }}
                >
                  {`— ${formatCompositionRoleLabel(role)}`}
                </TerminalText>
              ))}
            </View>
          ) : null}

          {card.modifierLabel ? (
            <TerminalText variant="caption" style={{ color: accentColor, textAlign: 'center', marginTop: 8 }}>
              {`Modifier: ${card.modifierLabel}`}
            </TerminalText>
          ) : null}
          {card.twistedLabel ? (
            <TerminalText variant="caption" style={{ color: accentColor, textAlign: 'center', marginTop: 4 }}>
              {`Twist: ${card.twistedLabel}`}
            </TerminalText>
          ) : null}

          <TerminalText variant="caption" style={{ color: mutedColor, textAlign: 'center', marginTop: 10 }}>
            {`Reward: ${card.rewardPreview}`}
          </TerminalText>
          {card.operationRelevance ? (
            <TerminalText variant="caption" style={{ color: mutedColor, textAlign: 'center', marginTop: 4 }}>
              {card.operationRelevance}
            </TerminalText>
          ) : null}

          <TerminalText
            variant="caption"
            style={{ color: '#f59e0b', textAlign: 'center', marginTop: 12 }}
          >
            {card.warningText}
          </TerminalText>

          <View style={styles.actions}>
            <HapticPressable
              onPress={handleEnter}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  borderColor: accentColor,
                  backgroundColor: `${accentColor}22`,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <TerminalText size={10} letterSpacing={1.2} style={{ color: accentColor, fontWeight: '800' }}>
                [ ENTER COMBAT ]
              </TerminalText>
            </HapticPressable>
            {card.optionalBack ? (
              <HapticPressable
                onPress={handleBack}
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    borderColor: mutedColor,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <TerminalText size={10} letterSpacing={1.2} style={{ color: mutedColor, fontWeight: '800' }}>
                  [ BACK ]
                </TerminalText>
              </HapticPressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    backgroundColor: '#050608',
    padding: 16,
  },
  block: {
    marginTop: 10,
  },
  actions: {
    marginTop: 16,
    gap: 8,
  },
  actionBtn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
