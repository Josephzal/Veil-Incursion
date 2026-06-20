import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AegisLoadoutEditor from '../AegisLoadoutEditor';
import ClassAbilityRoster from '../ClassAbilityRoster';
import { formatBracketHeader, hubTerminalUi } from '../../styles/hubTerminalUi';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { isAbilityUnlocked } from '../../data/aegisAbilityUnlockEngine';
import type { AegisAbilityId, AegisLoadout } from '../../types/aegisCombat';
import { validateLoadoutCommit } from '../../utils/aegisLoadoutUtils';

export default function SafehouseAbilitiesTab(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, setAegisLoadout, unlockAegisAbility, appendHubLog } = usePlayerAccount();

  const [loadoutDraft, setLoadoutDraft] = useState<AegisAbilityId[]>([...account.aegisLoadout]);
  const [selectedSlot, setSelectedSlot] = useState<0 | 1 | 2 | 3>(0);
  const [loadoutStatus, setLoadoutStatus] = useState<string | null>(null);

  useEffect(() => {
    setLoadoutDraft([...account.aegisLoadout]);
  }, [account.aegisLoadout]);

  const assignAbilityToSlot = useCallback((abilityId: AegisAbilityId) => {
    if (abilityId === 'EVISCERATE') return;
    if (!isAbilityUnlocked(account.unlockedAegisAbilities, abilityId)) {
      setLoadoutStatus(`>> ${abilityId.replace(/_/g, ' ')} NOT UNLOCKED — DECRYPT PROTOCOL FIRST.`);
      return;
    }
    setLoadoutDraft((prev) => {
      const next = [...prev];
      next[selectedSlot] = abilityId;
      return next;
    });
    setLoadoutStatus(null);
  }, [account.unlockedAegisAbilities, selectedSlot]);

  const handleUnlockAbility = useCallback((abilityId: AegisAbilityId) => {
    const result = unlockAegisAbility(abilityId);
    appendHubLog(result.logLine);
    setLoadoutStatus(result.logLine);
  }, [appendHubLog, unlockAegisAbility]);

  const commitLoadout = useCallback(() => {
    const rejection = validateLoadoutCommit(loadoutDraft, account.unlockedAegisAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      return;
    }
    const committed: AegisLoadout = [
      loadoutDraft[0],
      loadoutDraft[1],
      loadoutDraft[2],
      loadoutDraft[3],
    ];
    setAegisLoadout(committed);
    appendHubLog('>> AEGIS LOADOUT LOCKED — combat deck staged for next incursion.');
    setLoadoutStatus('>> LOADOUT COMMITTED — CARRIES INTO NEXT RUN.');
  }, [appendHubLog, account.unlockedAegisAbilities, loadoutDraft, setAegisLoadout]);

  if (account.activeClass !== 'AEGIS') {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={hubTerminalUi.dataSectionLeading}>
          <Text style={[hubTerminalUi.sectionHeaderLg, { color: theme.mutedColor }]}>
            {formatBracketHeader(`PRE-RUN ${account.activeClass} CONFIG`)}
          </Text>
          <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
            Starter kit locked for this class. Full loadout editor arrives with class combat systems.
          </Text>
        </View>
        <View style={hubTerminalUi.dataSection}>
          <ClassAbilityRoster account={account} theme={theme} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={hubTerminalUi.dataSectionLeading}>
        <Text style={[hubTerminalUi.sectionHeaderLg, { color: theme.mutedColor }]}>
          {formatBracketHeader('PRE-RUN AEGIS CONFIG')}
        </Text>
        <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
          Configure four active abilities. Locked protocols require hub resource decryption.
        </Text>
      </View>

      <View style={hubTerminalUi.dataSection}>
        <AegisLoadoutEditor
          draft={loadoutDraft}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          onAssignAbility={assignAbilityToSlot}
          onUnlockAbility={handleUnlockAbility}
          onCommit={commitLoadout}
          unlockedAbilities={account.unlockedAegisAbilities}
          resourceStash={account.resourceStash}
          theme={{
            accentColor: theme.statusColor,
            borderColor: theme.borderColor,
            mutedColor: theme.mutedColor,
            textColor: theme.textColor,
          }}
          hint="Tap a locked ability to spend resources and unlock it. Eviscerate remains a hidden ultimate at full Abyssal Reserve."
          commitLabel="[ SAVE LOADOUT FOR NEXT RUN ]"
          statusMessage={loadoutStatus}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.6,
    lineHeight: 12,
    marginTop: 4,
  },
});
