import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import HubPrimaryCta from './HubPrimaryCta';
import { HubSectionHeader } from './HubScreenShell';
import { useHubLayout } from '../../context/HubLayoutContext';
import type {
  ExpeditionKeepsakeDefinition,
  KeepsakeDeploymentChoiceSpec,
  KeepsakeDeploymentOption,
} from '../../types/expeditionKeepsake';
import { VEIL } from '../../theme/veilTerminalTokens';

interface KeepsakeDeploymentChoiceModalProps {
  visible: boolean;
  relic: ExpeditionKeepsakeDefinition;
  choice: KeepsakeDeploymentChoiceSpec;
  selectedValue: string | null;
  accentColor: string;
  mutedColor: string;
  warnings?: readonly string[];
  onSelect: (value: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
}

function OptionRow({
  option,
  selected,
  accentColor,
  mutedColor,
  onPress,
}: {
  option: KeepsakeDeploymentOption;
  selected: boolean;
  accentColor: string;
  mutedColor: string;
  onPress: () => void;
}) {
  const { scaleSpacing } = useHubLayout();
  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        {
          borderColor: selected ? accentColor : mutedColor,
          backgroundColor: selected ? `${accentColor}14` : 'rgba(0, 0, 0, 0.35)',
          padding: scaleSpacing(10),
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <TerminalText variant="body" style={{ color: selected ? accentColor : mutedColor, fontWeight: '700' }}>
        {option.label.toUpperCase()}
      </TerminalText>
      <TerminalText variant="caption" style={{ color: mutedColor, marginTop: 4 }}>
        {option.detail}
      </TerminalText>
    </HapticPressable>
  );
}

export default function KeepsakeDeploymentChoiceModal({
  visible,
  relic,
  choice,
  selectedValue,
  accentColor,
  mutedColor,
  warnings = [],
  onSelect,
  onConfirm,
  onDismiss,
}: KeepsakeDeploymentChoiceModalProps): React.JSX.Element {
  const { scaleSpacing, scaleSize } = useHubLayout();
  const canConfirm = selectedValue != null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.panel,
            {
              borderColor: accentColor,
              padding: scaleSpacing(16),
              maxHeight: '92%',
            },
          ]}
        >
          <TerminalText
            variant="section"
            letterSpacing={1}
            style={{ color: accentColor, textAlign: 'center', marginBottom: scaleSpacing(8) }}
          >
            [ RELIC DEPLOYMENT ]
          </TerminalText>
          <TerminalText variant="body" style={{ color: accentColor, fontWeight: '700', textAlign: 'center' }}>
            {relic.name.toUpperCase()}
          </TerminalText>
          <TerminalText variant="caption" style={{ color: mutedColor, textAlign: 'center', marginTop: scaleSpacing(4) }}>
            {choice.prompt}
          </TerminalText>

          {warnings.length > 0 ? (
            <View
              style={[
                styles.warningBanner,
                {
                  borderColor: VEIL.occult,
                  marginTop: scaleSpacing(10),
                  padding: scaleSpacing(8),
                },
              ]}
            >
              {warnings.map((warning) => (
                <TerminalText key={warning} variant="caption" style={{ color: VEIL.occultPale, marginBottom: 2 }}>
                  {warning}
                </TerminalText>
              ))}
            </View>
          ) : null}

          <ScrollView
            style={{ marginTop: scaleSpacing(12), maxHeight: 360 }}
            contentContainerStyle={{ gap: scaleSpacing(8), paddingBottom: scaleSpacing(4) }}
            showsVerticalScrollIndicator={false}
          >
            <HubSectionHeader title="SELECT CONFIGURATION" color={accentColor} size={8} />
            {choice.options.map((option) => (
              <OptionRow
                key={option.value}
                option={option}
                selected={selectedValue === option.value}
                accentColor={accentColor}
                mutedColor={mutedColor}
                onPress={() => onSelect(option.value)}
              />
            ))}
          </ScrollView>

          <View style={[styles.actions, { marginTop: scaleSpacing(14), gap: scaleSpacing(10) }]}>
            <HubPrimaryCta
              label="[ CANCEL ]"
              onPress={onDismiss}
              variant="danger"
              accessibilityLabel="Cancel"
              minHeight={scaleSize(44)}
              style={styles.actionBtn}
            />
            <HubPrimaryCta
              label="[ CONFIRM ]"
              onPress={onConfirm}
              disabled={!canConfirm}
              variant="glow"
              accessibilityLabel="Confirm"
              minHeight={scaleSize(48)}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    backgroundColor: VEIL.surfaceRaised,
    borderColor: VEIL.line,
  },
  warningBanner: {
    borderWidth: 1,
    backgroundColor: 'rgba(140, 115, 159, 0.08)',
  },
  optionRow: {
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VEIL.surface2,
  },
});
