import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import SanctuaryNarrativeBg from '../../assets/narrative images/sanctuary.png';
import ClassGraftUI from '../components/ClassGraftUI';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame, { RunEventScreenHeader } from '../components/layout/RunEventScreenFrame';
import SelectionContinueButton from '../components/SelectionContinueButton';
import type { OperativeClassGraftId } from '../types/classGraft';

const TERMINAL_ACCENT = '#00ff33';

type SanctuaryChoice = 'ATTUNE' | 'GRAFT' | null;

export default function RestScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    applySanctuaryAttune,
    openSanctuaryGraftTerminal,
    applyClassGraftToAbility,
    getVeilResidueBalance,
  } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const [selectedChoice, setSelectedChoice] = useState<SanctuaryChoice>(null);
  const [graftTerminalOpen, setGraftTerminalOpen] = useState(false);
  const [graftComplete, setGraftComplete] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const activeClass = activeIncursion.activeClass ?? 'AEGIS';
  const residueBalance = getVeilResidueBalance();
  const graftOffers = activeIncursion.sanctuaryGraftOffers ?? [];

  const loadout = useMemo(() => {
    if (activeClass === 'HEX_SHOT') return activeIncursion.hexShotLoadout;
    if (activeClass === 'ENVOY') return activeIncursion.envoyLoadout;
    return activeIncursion.aegisLoadout;
  }, [activeClass, activeIncursion.aegisLoadout, activeIncursion.envoyLoadout, activeIncursion.hexShotLoadout]);

  const abilityGrafts = useMemo(() => {
    if (activeClass === 'HEX_SHOT') return activeIncursion.hexShotAbilityGrafts;
    if (activeClass === 'ENVOY') return activeIncursion.envoyAbilityGrafts;
    return activeIncursion.abilityGrafts;
  }, [activeClass, activeIncursion.abilityGrafts, activeIncursion.envoyAbilityGrafts, activeIncursion.hexShotAbilityGrafts]);

  const handleSelectAttune = () => {
    if (confirmed) return;
    setSelectedChoice('ATTUNE');
    setGraftTerminalOpen(false);
    setGraftComplete(false);
  };

  const handleSelectGraft = () => {
    if (confirmed) return;
    setSelectedChoice('GRAFT');
    setGraftTerminalOpen(true);
    openSanctuaryGraftTerminal();
  };

  const handleApplyGraft = (abilityId: string, graftId: string) => {
    const result = applyClassGraftToAbility(abilityId, graftId);
    if (result.success) {
      setGraftComplete(true);
    }
  };

  const canContinue = selectedChoice === 'ATTUNE'
    || (selectedChoice === 'GRAFT' && graftComplete);

  const handleContinue = () => {
    if (!canContinue || confirmed) return;
    setConfirmed(true);
    if (selectedChoice === 'ATTUNE') {
      applySanctuaryAttune();
    }
    const msg = selectedChoice === 'ATTUNE'
      ? 'Soul anchor stabilized.'
      : 'Class graft mutation secured.';
    setTimeout(() => completeCurrentNode(msg), 1200);
  };

  const graftTerminalLabel = activeClass === 'HEX_SHOT'
    ? '[ ACCESS HEX-SHOT GRAFT TERMINAL ]'
    : activeClass === 'ENVOY'
      ? '[ ACCESS ENVOY GRAFT TERMINAL ]'
      : '[ ACCESS VEIL-GRAFT TERMINAL ]';

  return (
    <IncursionShell>
      <IncursionRunLayout style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventScreenFrame
          scrollable
          backgroundImage={SanctuaryNarrativeBg}
          backgroundScrimOpacity={0.8}
          header={(
            <RunEventScreenHeader
              eyebrow="AGENCY SANCTUARY DOCUMENT // RE-TUNE NODE"
              title="SANCTUARY // MUTUAL EXCLUSION PROTOCOL"
              align="left"
              borderColor={theme.borderColor}
              eyebrowColor={theme.mutedColor}
              titleColor={TERMINAL_ACCENT}
            />
          )}
          footer={(
            <SelectionContinueButton
              enabled={
                (graftTerminalOpen ? graftComplete : canContinue) && !confirmed
              }
              onPress={handleContinue}
              borderColor={theme.borderColor}
              mutedColor={theme.mutedColor}
            />
          )}
        >
          <View style={[styles.docBody, { borderColor: theme.borderColor }]}>
            <Text style={[styles.scenarioText, { color: theme.primaryColor }]}>
              Stabilizing ley-energy hums through the anchor chapel. Choose attunement or graft mutation — not both.
            </Text>
            <View style={styles.statsBlock}>
              <Text style={[styles.statLine, { color: theme.mutedColor }]}>
                SOUL ANCHOR: {runState.soulAnchorIntegrity}/{runState.maxSoulAnchor}
              </Text>
              <Text style={[styles.statLine, { color: theme.mutedColor }]}>
                VEIL RESIDUE: {residueBalance}
              </Text>
              <Text style={[styles.statLine, { color: theme.mutedColor }]}>
                ACTIVE CLASS: {activeClass.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>

          {!graftTerminalOpen ? (
            <View style={styles.choiceCol}>
              <HapticPressable
                onPress={handleSelectAttune}
                disabled={confirmed || selectedChoice === 'GRAFT'}
                style={({ pressed }) => [
                  styles.choiceBtn,
                  selectedChoice === 'ATTUNE' && styles.choiceBtnSelected,
                  {
                    borderColor: selectedChoice === 'ATTUNE' ? TERMINAL_ACCENT : theme.borderColor,
                    opacity: confirmed && selectedChoice !== 'ATTUNE' ? 0.4 : selectedChoice === 'GRAFT' ? 0.35 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.choiceLabel,
                    { color: selectedChoice === 'ATTUNE' ? TERMINAL_ACCENT : theme.primaryColor },
                  ]}
                >
                  [ ATTUNE ]
                </Text>
                <Text style={[styles.choiceReq, styles.choiceEffectGood]}>
                  Restore 30% of Maximum Health
                </Text>
              </HapticPressable>

              <HapticPressable
                onPress={handleSelectGraft}
                disabled={confirmed || selectedChoice === 'ATTUNE'}
                style={({ pressed }) => [
                  styles.choiceBtn,
                  selectedChoice === 'GRAFT' && styles.choiceBtnSelected,
                  {
                    borderColor: selectedChoice === 'GRAFT' ? '#c084fc' : theme.borderColor,
                    opacity: confirmed && selectedChoice !== 'GRAFT' ? 0.4 : selectedChoice === 'ATTUNE' ? 0.35 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.choiceLabel,
                    { color: selectedChoice === 'GRAFT' ? '#c084fc' : theme.primaryColor },
                  ]}
                >
                  {graftTerminalLabel}
                </Text>
                <Text style={[styles.choiceReq, { color: '#c084fc' }]}>
                  Spend Veil Residue to mutate an equipped ability
                </Text>
              </HapticPressable>
            </View>
          ) : (
            <ClassGraftUI
              activeClass={activeClass}
              loadout={loadout}
              offers={graftOffers}
              residueBalance={residueBalance}
              abilityGrafts={abilityGrafts}
              onApply={handleApplyGraft}
              borderColor={theme.borderColor}
              primaryColor={theme.primaryColor}
              mutedColor={theme.mutedColor}
            />
          )}
        </RunEventScreenFrame>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  docBody: {
    borderWidth: 1,
    padding: 12,
    backgroundColor: 'rgba(10, 11, 15, 0.92)',
  },
  scenarioText: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  statsBlock: { marginTop: 10 },
  statLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  choiceCol: { gap: 8 },
  choiceBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(10, 11, 15, 0.92)',
  },
  choiceBtnSelected: { backgroundColor: 'rgba(0, 255, 51, 0.08)' },
  choiceEffectGood: { color: '#4ade80' },
  choiceLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  choiceReq: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
  },
});
