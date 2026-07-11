import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import DossierCardShell from './DossierCardShell';
import KeepsakeDeploymentChoiceModal from './KeepsakeDeploymentChoiceModal';
import { HubSectionHeader } from './HubScreenShell';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
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
  const {
    account,
    setEquippedKeepsake,
    setKeepsakeAttunement,
    setKeepsakeRouteDoctrine,
    setKeepsakeMirrorCategory,
  } = usePlayerAccount();
  const { selectedSector, persisted } = useWorldState();
  const { scaleSpacing } = useHubLayout();
  const selectedContract = persisted.contractBoard.selectedContract;

  const keepsakes = useMemo(
    () => listKeepsakeDefinitions(account.unlockedKeepsakeIds),
    [account.unlockedKeepsakeIds],
  );

  const [inspectId, setInspectId] = useState<KeepsakeId | null>(account.equippedKeepsakeId);
  const [deploymentModalVisible, setDeploymentModalVisible] = useState(false);
  const [pendingEquipId, setPendingEquipId] = useState<KeepsakeId | null>(null);
  const [modalKeepsakeId, setModalKeepsakeId] = useState<KeepsakeId | null>(null);
  const [modalDraftValue, setModalDraftValue] = useState<string | null>(null);

  const equipped = account.equippedKeepsakeId
    ? EXPEDITION_KEEPSAKE_REGISTRY[account.equippedKeepsakeId]
    : null;

  const inspected = inspectId ? EXPEDITION_KEEPSAKE_REGISTRY[inspectId] : null;
  const modalRelic = modalKeepsakeId ? EXPEDITION_KEEPSAKE_REGISTRY[modalKeepsakeId] : null;

  const inspectWarnings = useMemo(() => {
    if (!inspected) return [];
    return resolveKeepsakeDeploymentWarnings(inspected.id, selectedSector, selectedContract);
  }, [inspected, selectedContract, selectedSector]);

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
    setInspectId(id);
  };

  const handleDeploymentConfirm = () => {
    if (!modalDraftValue || !modalRelic) return;
    commitDeploymentSelection(modalDraftValue);
    if (pendingEquipId) {
      setEquippedKeepsake(pendingEquipId);
      setInspectId(pendingEquipId);
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
      <TerminalText variant="section" letterSpacing={1.1} style={{ color: accent }}>
        {formatBracketHeader('EXPEDITION RELIC')}
      </TerminalText>

      {equipped ? (
        <DossierCardShell padding={scaleSpacing(8)} accentColor={accent}>
          <HubSectionHeader title="ARMED FOR DESCENT" color={accent} size={8} />
          <TerminalText variant="body" style={{ color: accent, fontWeight: '700' }}>
            {equipped.name.toUpperCase()}
          </TerminalText>
          {deploymentSummary ? (
            <TerminalText variant="caption" style={{ color: muted, marginTop: 2 }}>
              {`Deployment: ${deploymentSummary}`}
            </TerminalText>
          ) : equipped.deploymentChoice ? (
            <TerminalText variant="caption" style={{ color: '#f97316', marginTop: 2 }}>
              Deployment configuration required before descent.
            </TerminalText>
          ) : null}
        </DossierCardShell>
      ) : null}

      {inspected ? (
        <DossierCardShell padding={scaleSpacing(10)} accentColor={accent}>
          <HubSectionHeader title="RELIC DOSSIER" color={accent} size={8} />
          <TerminalText variant="body" letterSpacing={0.35} style={[styles.inspectName, { color: accent }]}>
            {inspected.name.toUpperCase()}
          </TerminalText>
          <TerminalText variant="caption" style={{ color: muted, fontStyle: 'italic', marginTop: 4 }}>
            {`"${inspected.flavorText}"`}
          </TerminalText>

          <View style={{ marginTop: scaleSpacing(8), gap: scaleSpacing(4) }}>
            <TerminalText variant="caption" style={{ color: muted }}>
              {`ROLE — ${formatKeepsakeRoleLine(inspected)}`}
            </TerminalText>
            <TerminalText variant="caption" style={{ color: muted }}>
              {inspected.effectSummary}
            </TerminalText>
            <TerminalText variant="caption" style={{ color: accent }}>
              {`RUN STYLE — ${inspected.runStyle}`}
            </TerminalText>
            <TerminalText variant="caption" style={{ color: muted }}>
              {`RISK — ${inspected.riskSummary}`}
            </TerminalText>
          </View>

          {inspectWarnings.length > 0 ? (
            <View style={[styles.warningBlock, { marginTop: scaleSpacing(8), padding: scaleSpacing(6) }]}>
              <HubSectionHeader title="DEPLOYMENT WARNINGS" color="#f97316" size={8} />
              {inspectWarnings.map((warning) => (
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

          {inspected.deploymentChoice ? (
            <View style={{ marginTop: scaleSpacing(8) }}>
              <HubSectionHeader title="PRE-RUN CONFIGURATION" color={accent} size={8} />
              <TerminalText variant="caption" style={{ color: muted, marginBottom: scaleSpacing(4) }}>
                {inspected.deploymentChoice.prompt}
              </TerminalText>
              {formatKeepsakeDeploymentOptionLabel(inspected.id, account.keepsakeDeployment) ? (
                <TerminalText variant="caption" style={{ color: accent }}>
                  {`Selected: ${formatKeepsakeDeploymentOptionLabel(inspected.id, account.keepsakeDeployment)}`}
                </TerminalText>
              ) : (
                <TerminalText variant="caption" style={{ color: '#f97316' }}>
                  Not configured — required before equipping.
                </TerminalText>
              )}
            </View>
          ) : null}

          <View style={[styles.inspectActions, { marginTop: scaleSpacing(10), gap: scaleSpacing(6) }]}>
            <HapticPressable
              onPress={() => handleEquip(inspected.id)}
              style={(state) => [
                styles.actionBtn,
                {
                  borderColor: account.equippedKeepsakeId === inspected.id ? muted : accent,
                  backgroundColor: account.equippedKeepsakeId === inspected.id ? 'rgba(0,0,0,0.25)' : `${accent}18`,
                  paddingVertical: scaleSpacing(8),
                },
                terminalHoverStyle(readPressableHover(state), state.pressed),
              ]}
            >
              <TerminalText variant="caption" style={{ color: accent, fontWeight: '800' }}>
                {account.equippedKeepsakeId === inspected.id ? '[ UNEQUIP ]' : '[ EQUIP RELIC ]'}
              </TerminalText>
            </HapticPressable>
            {inspected.deploymentChoice ? (
              <HapticPressable
                onPress={() => openDeploymentModal(inspected.id, false)}
                style={(state) => [
                  styles.actionBtn,
                  {
                    borderColor: muted,
                    paddingVertical: scaleSpacing(8),
                  },
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
        <DossierCardShell padding={scaleSpacing(10)} accentColor={accent}>
          <TerminalText variant="body" style={{ color: muted }}>
            Select a relic below to inspect its dossier before descent.
          </TerminalText>
        </DossierCardShell>
      )}

      <View style={[styles.list, { gap: scaleSpacing(6) }]}>
        {keepsakes.map((keepsake) => {
          const selected = account.equippedKeepsakeId === keepsake.id;
          const inspecting = inspectId === keepsake.id;
          return (
            <HapticPressable
              key={keepsake.id}
              onPress={() => setInspectId(keepsake.id)}
              style={(state) => [
                styles.row,
                {
                  borderColor: inspecting ? accent : selected ? `${accent}88` : muted,
                  backgroundColor: inspecting ? `${accent}18` : selected ? `${accent}10` : 'rgba(0,0,0,0.25)',
                  padding: scaleSpacing(8),
                },
                terminalHoverStyle(readPressableHover(state), state.pressed),
              ]}
            >
              <View style={styles.rowHeader}>
                <TerminalText variant="body" style={{ color: accent, fontWeight: '700', flex: 1 }}>
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
