import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import DossierCardShell from './DossierCardShell';
import KeepsakeDeploymentChoiceModal from './KeepsakeDeploymentChoiceModal';
import { HubSectionHeader } from './HubScreenShell';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useWorldState } from '../../context/WorldStateContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import {
  EXPEDITION_KEEPSAKE_REGISTRY,
  listKeepsakeDefinitions,
} from '../../data/expeditionKeepsakeRegistry';
import {
  formatKeepsakeDeploymentOptionLabel,
  getKeepsakeDeploymentChoiceValue,
  isKeepsakeDeploymentConfigured,
  resolveKeepsakeDeploymentWarnings,
  formatKeepsakeRoleLine,
} from '../../data/expeditionKeepsakeDeploymentEngine';
import type { KeepsakeId } from '../../types/expeditionKeepsake';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';
import { LoadoutTabHeader, LoadoutSectionHeader } from './loadoutTabUi';

interface KeepsakeLoadoutPanelProps {
  accent: string;
  muted: string;
}

export default function KeepsakeLoadoutPanel({
  accent,
  muted,
}: KeepsakeLoadoutPanelProps): React.JSX.Element {
  const {
    account,
    setEquippedKeepsake,
    setKeepsakeAttunement,
    setKeepsakeRouteDoctrine,
    setKeepsakeMirrorCategory,
  } = usePlayerAccount();
  const { theme } = useTerminal();
  const { selectedSector, persisted } = useWorldState();
  const { scaleSpacing } = useHubLayout();
  const selectedContract = persisted.contractBoard.selectedContract;

  const keepsakes = useMemo(
    () => listKeepsakeDefinitions(account.unlockedKeepsakeIds),
    [account.unlockedKeepsakeIds],
  );

  const [deploymentModalVisible, setDeploymentModalVisible] = useState(false);
  const [pendingEquipId, setPendingEquipId] = useState<KeepsakeId | null>(null);
  const [modalKeepsakeId, setModalKeepsakeId] = useState<KeepsakeId | null>(null);
  const [modalDraftValue, setModalDraftValue] = useState<string | null>(null);

  const equipped = account.equippedKeepsakeId
    ? EXPEDITION_KEEPSAKE_REGISTRY[account.equippedKeepsakeId]
    : null;

  const modalRelic = modalKeepsakeId ? EXPEDITION_KEEPSAKE_REGISTRY[modalKeepsakeId] : null;

  const equippedWarnings = useMemo(() => {
    if (!equipped) return [];
    return resolveKeepsakeDeploymentWarnings(equipped.id, selectedSector, selectedContract);
  }, [equipped, selectedContract, selectedSector]);

  const modalWarnings = useMemo(() => {
    if (!modalRelic) return [];
    return resolveKeepsakeDeploymentWarnings(modalRelic.id, selectedSector, selectedContract)
      .map((entry) => entry.message);
  }, [modalRelic, selectedContract, selectedSector]);

  const openDeploymentModal = (keepsakeId: KeepsakeId, equipAfterConfirm: boolean) => {
    const def = EXPEDITION_KEEPSAKE_REGISTRY[keepsakeId];
    if (!def.deploymentChoice) return;
    const current = getKeepsakeDeploymentChoiceValue(account.keepsakeDeployment, def.deploymentChoice);
    setPendingEquipId(equipAfterConfirm ? keepsakeId : null);
    setModalKeepsakeId(keepsakeId);
    setModalDraftValue(current);
    setDeploymentModalVisible(true);
  };

  const commitDeploymentSelection = (value: string) => {
    if (!modalRelic?.deploymentChoice) return;
    switch (modalRelic.deploymentChoice.kind) {
      case 'attunement':
        setKeepsakeAttunement(value as import('../../types/expeditionKeepsake').KeepsakeAttunement);
        break;
      case 'route_doctrine':
        setKeepsakeRouteDoctrine(value as import('../../types/expeditionKeepsake').KeepsakeRouteDoctrine);
        break;
      case 'mirror_category':
        setKeepsakeMirrorCategory(value as import('../../types/expeditionKeepsake').KeepsakeMirrorCategory);
        break;
      default:
        break;
    }
  };

  const handleEquip = (id: KeepsakeId) => {
    if (account.equippedKeepsakeId === id) {
      setEquippedKeepsake(null);
      return;
    }

    const def = EXPEDITION_KEEPSAKE_REGISTRY[id];
    if (def.deploymentChoice && !isKeepsakeDeploymentConfigured(id, account.keepsakeDeployment)) {
      openDeploymentModal(id, true);
      return;
    }

    setEquippedKeepsake(id);
  };

  const handleDeploymentConfirm = () => {
    if (!modalDraftValue || !modalRelic) return;
    commitDeploymentSelection(modalDraftValue);
    if (pendingEquipId) {
      setEquippedKeepsake(pendingEquipId);
    }
    setDeploymentModalVisible(false);
    setPendingEquipId(null);
    setModalKeepsakeId(null);
  };

  const handleDeploymentDismiss = () => {
    setDeploymentModalVisible(false);
    setPendingEquipId(null);
    setModalKeepsakeId(null);
  };

  const deploymentSummary = account.equippedKeepsakeId
    ? formatKeepsakeDeploymentOptionLabel(account.equippedKeepsakeId, account.keepsakeDeployment)
    : null;

  return (
    <View style={[styles.root, { gap: scaleSpacing(8) }]}>
      <LoadoutTabHeader
        title="Expedition Relic"
        subtitle="Relics alter scanner behavior, route planning, cargo risk, or extraction pressure."
      />

      <LoadoutSectionHeader label="Currently Equipped" />
      {equipped ? (
        <DossierCardShell padding={scaleSpacing(10)} accentColor={accent} showAccentStripe>
          <TerminalText variant="micro" letterSpacing={0.8} style={{ color: muted }}>
            RELIC
          </TerminalText>
          <TerminalText variant="body" letterSpacing={0.35} style={[styles.inspectName, { color: accent }]}>
            {equipped.name.toUpperCase()}
          </TerminalText>
          <TerminalText variant="caption" style={{ color: muted, fontStyle: 'italic', marginTop: 4 }}>
            {`"${equipped.flavorText}"`}
          </TerminalText>

          <View style={{ marginTop: scaleSpacing(8), gap: scaleSpacing(4) }}>
            <TerminalText variant="caption" style={{ color: muted }}>
              {`ROLE — ${formatKeepsakeRoleLine(equipped)}`}
            </TerminalText>
            <TerminalText variant="caption" style={{ color: muted }}>
              {equipped.effectSummary}
            </TerminalText>
            <TerminalText variant="caption" style={{ color: accent }}>
              {`RUN STYLE — ${equipped.runStyle}`}
            </TerminalText>
            <TerminalText variant="caption" style={{ color: muted }}>
              {`RISK — ${equipped.riskSummary}`}
            </TerminalText>
          </View>

          {deploymentSummary ? (
            <TerminalText variant="caption" style={{ color: accent, marginTop: scaleSpacing(6) }}>
              {`DEPLOYMENT — ${deploymentSummary}`}
            </TerminalText>
          ) : equipped.deploymentChoice ? (
            <TerminalText variant="caption" style={{ color: '#f97316', marginTop: scaleSpacing(6) }}>
              Deployment configuration required before descent.
            </TerminalText>
          ) : null}

          {equippedWarnings.length > 0 ? (
            <View style={[styles.warningBlock, { marginTop: scaleSpacing(8), padding: scaleSpacing(6) }]}>
              <HubSectionHeader title="DEPLOYMENT WARNINGS" color="#f97316" size={8} />
              {equippedWarnings.map((warning) => (
                <TerminalText
                  key={warning.message}
                  variant="caption"
                  style={{ color: warning.severity === 'warn' ? '#f97316' : muted, marginTop: 2 }}
                >
                  {warning.message}
                </TerminalText>
              ))}
            </View>
          ) : null}

          <View style={[styles.inspectActions, { marginTop: scaleSpacing(10), gap: scaleSpacing(6) }]}>
            <HapticPressable
              onPress={() => handleEquip(equipped.id)}
              style={(state) => [
                styles.actionBtn,
                {
                  borderColor: accent,
                  backgroundColor: 'rgba(0,0,0,0.25)',
                  paddingVertical: scaleSpacing(8),
                },
                terminalHoverStyle(readPressableHover(state), state.pressed),
              ]}
            >
              <TerminalText variant="caption" style={{ color: accent, fontWeight: '800' }}>
                [ UNEQUIP ]
              </TerminalText>
            </HapticPressable>
            {equipped.deploymentChoice ? (
              <HapticPressable
                onPress={() => openDeploymentModal(equipped.id, false)}
                style={(state) => [
                  styles.actionBtn,
                  { borderColor: muted, paddingVertical: scaleSpacing(8) },
                  terminalHoverStyle(readPressableHover(state), state.pressed),
                ]}
              >
                <TerminalText variant="caption" style={{ color: muted, fontWeight: '700' }}>
                  [ CONFIGURE DEPLOYMENT ]
                </TerminalText>
              </HapticPressable>
            ) : null}
          </View>
        </DossierCardShell>
      ) : (
        <TerminalText variant="caption" style={{ color: muted }}>
          No relic equipped. Choose one below to arm it for descent.
        </TerminalText>
      )}

      <LoadoutSectionHeader label="Available Relics" style={{ marginTop: scaleSpacing(2) }} />
      <View style={[styles.list, { gap: scaleSpacing(6) }]}>
        {keepsakes.map((keepsake) => {
          const selected = account.equippedKeepsakeId === keepsake.id;
          return (
            <HapticPressable
              key={keepsake.id}
              onPress={() => handleEquip(keepsake.id)}
              style={(state) => [
                styles.row,
                {
                  borderColor: selected ? accent : muted,
                  backgroundColor: selected ? `${accent}14` : 'rgba(0,0,0,0.25)',
                  borderLeftWidth: selected ? 3 : 1,
                  borderLeftColor: selected ? accent : muted,
                  padding: scaleSpacing(8),
                },
                terminalHoverStyle(readPressableHover(state), state.pressed),
              ]}
            >
              <View style={styles.rowHeader}>
                <TerminalText variant="body" style={{ color: selected ? accent : theme.textColor, fontWeight: '700', flex: 1 }}>
                  {keepsake.name.toUpperCase()}
                </TerminalText>
                {selected ? (
                  <TerminalText variant="micro" style={{ color: accent }}>
                    EQUIPPED
                  </TerminalText>
                ) : null}
              </View>
              <TerminalText variant="caption" style={{ color: muted, marginTop: 2 }}>
                {formatKeepsakeRoleLine(keepsake)}
              </TerminalText>
              <TerminalText variant="caption" style={{ color: muted, marginTop: 4 }}>
                {keepsake.runStyle}
              </TerminalText>
            </HapticPressable>
          );
        })}
      </View>

      {modalRelic?.deploymentChoice ? (
        <KeepsakeDeploymentChoiceModal
          visible={deploymentModalVisible}
          relic={modalRelic}
          choice={modalRelic.deploymentChoice}
          selectedValue={modalDraftValue}
          accentColor={accent}
          mutedColor={muted}
          warnings={modalWarnings}
          onSelect={setModalDraftValue}
          onConfirm={handleDeploymentConfirm}
          onDismiss={handleDeploymentDismiss}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  inspectName: {
    fontWeight: '800',
  },
  warningBlock: {
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  inspectActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    width: '100%',
  },
  row: {
    borderWidth: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
