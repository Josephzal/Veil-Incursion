import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import SanctuaryBg from '../../assets/images/location images/sanctuary.png';
import ClassGraftUI, { type GraftInjectSelection } from '../components/ClassGraftUI';
import TerminalOverlay from '../components/TerminalOverlay';
import { buildAegisGraftSurface } from '../data/aegisGraftTarget';
import {
  getGraftSocketAccessForRunDepth,
  resolveRunGraftDepthBand,
} from '../data/graftSynergy/graftCapacityEngine';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventImmersiveBackdrop from '../components/layout/RunEventImmersiveBackdrop';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import FieldPlate from '../components/runField/FieldPlate';
import RunActionRail from '../components/runField/RunActionRail';
import HubPrimaryCta from '../components/hub/HubPrimaryCta';
import { RUN_FIELD, type RunFieldTone } from '../theme/runFieldTokens';
import { resolveRunEventNodeHeaderFromNode } from '../utils/resolveRunEventNodeHeader';
import { readPressableHover } from '../utils/terminalHoverStyle';
import { sanitizeAegisTechniqueLoadout } from '../utils/aegisLoadoutUtils';

type SanctuaryChoice = 'ATTUNE' | 'GRAFT' | null;

const CONTENT_MAX_WIDTH = 540;
const GRAFT_CONTENT_MAX_WIDTH = 720;

interface SanctuaryChoiceBlockProps {
  primaryLabel: string;
  secondaryLabel: string;
  selected: boolean;
  dimmed: boolean;
  locked: boolean;
  tone: RunFieldTone;
  primaryFontSize: number;
  secondaryFontSize: number;
  paddingVertical: number;
  paddingHorizontal: number;
  onPress: () => void;
  disabled: boolean;
}

function SanctuaryChoiceBlock({
  primaryLabel,
  secondaryLabel,
  selected,
  dimmed,
  locked,
  tone,
  primaryFontSize,
  secondaryFontSize,
  paddingVertical,
  paddingHorizontal,
  onPress,
  disabled,
}: SanctuaryChoiceBlockProps): React.JSX.Element {
  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={(state) => {
        const hovered = readPressableHover(state) || state.pressed;
        return [
          { opacity: dimmed && !selected ? 0.62 : 1 },
          !selected && hovered && !disabled && !locked ? styles.choiceHoverLift : null,
        ];
      }}
    >
      {(state) => {
        const hovered = !disabled && !locked && !selected
          && (readPressableHover(state) || state.pressed);
        const plateState = locked
          ? 'locked'
          : selected
            ? 'selected'
            : hovered
              ? 'hover'
              : 'idle';
        const titleColor = selected || hovered ? RUN_FIELD.mint : RUN_FIELD.text;
        return (
          <FieldPlate
            density="standard"
            tone={tone === 'occult' ? 'occult' : 'mint'}
            state={plateState}
            brackets={false}
            showSelectedMark={selected}
            contentStyle={[styles.choiceContent, { paddingVertical, paddingHorizontal }]}
          >
            <Text
              style={[
                styles.choicePrimary,
                {
                  color: titleColor,
                  fontSize: primaryFontSize,
                  lineHeight: Math.round(primaryFontSize * 1.25),
                },
              ]}
            >
              {primaryLabel}
            </Text>
            <Text
              style={[
                styles.choiceSecondary,
                {
                  color: locked ? RUN_FIELD.danger : RUN_FIELD.textSecondary,
                  fontSize: secondaryFontSize,
                  lineHeight: Math.round(secondaryFontSize * 1.35),
                },
              ]}
            >
              {secondaryLabel}
            </Text>
            {selected ? (
              <Text style={styles.selectedMark}>SELECTED</Text>
            ) : null}
          </FieldPlate>
        );
      }}
    </HapticPressable>
  );
}

function AttuneHealOverlay({
  visible,
  fromHp,
  toHp,
  maxHp,
  onContinue,
}: {
  visible: boolean;
  fromHp: number;
  toHp: number;
  maxHp: number;
  onContinue: () => void;
}): React.JSX.Element | null {
  const progress = useRef(new Animated.Value(0)).current;
  const [fillPct, setFillPct] = useState(fromHp / Math.max(1, maxHp));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    setReady(false);
    const start = fromHp / Math.max(1, maxHp);
    const end = toHp / Math.max(1, maxHp);
    setFillPct(start);
    const listener = progress.addListener(({ value }) => {
      setFillPct(start + (end - start) * value);
    });
    Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setReady(true);
    });
    return () => {
      progress.removeListener(listener);
    };
  }, [fromHp, maxHp, progress, toHp, visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={ready ? onContinue : undefined}>
      <View style={styles.attuneModalRoot}>
        <FieldPlate density="strong" brackets tone="mint" style={styles.attuneModalPlate} contentStyle={styles.attuneModalContent}>
          <Text style={styles.attuneModalEyebrow}>SOUL ANCHOR // ATTUNE</Text>
          <Text style={styles.attuneModalTitle}>INTEGRITY RESTORED</Text>
          <Text style={styles.attuneModalMeta}>
            {`${fromHp} → ${toHp} / ${maxHp}`}
          </Text>
          <View style={styles.attuneBarTrack}>
            <View style={[styles.attuneBarFill, { width: `${Math.round(fillPct * 100)}%` }]} />
          </View>
          <HubPrimaryCta
            label="CONTINUE"
            onPress={ready ? onContinue : undefined}
            disabled={!ready}
            variant="glow"
            minHeight={48}
            style={styles.attuneContinue}
          />
        </FieldPlate>
      </View>
    </Modal>
  );
}

export default function RestScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    applySanctuaryAttune,
    openSanctuaryGraftTerminal,
    clearSanctuaryGraftSession,
    applyClassGraftToAbility,
    getSelectedVectorNode,
  } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const {
    isDesktop,
    activeViewportWidth,
    fontScale,
    scaleFont,
    scaleSpacing,
  } = useResponsiveLayout();

  const [graftSelection, setGraftSelection] = useState<GraftInjectSelection>({
    graftId: null,
    abilityId: null,
    canInject: false,
  });
  const [selectedChoice, setSelectedChoice] = useState<SanctuaryChoice>(null);
  const [graftTerminalOpen, setGraftTerminalOpen] = useState(false);
  const [graftComplete, setGraftComplete] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [attuneOverlay, setAttuneOverlay] = useState<{
    fromHp: number;
    toHp: number;
  } | null>(null);

  const activeClass = activeIncursion.activeClass ?? 'AEGIS';
  const graftOffers = activeIncursion.sanctuaryGraftOffers ?? [];

  const runDepthBand = resolveRunGraftDepthBand(activeIncursion);
  const graftAccess = useMemo(
    () => getGraftSocketAccessForRunDepth(runDepthBand),
    [runDepthBand],
  );

  const loadout = useMemo(() => {
    if (activeClass === 'HEX_SHOT') return activeIncursion.hexShotLoadout;
    if (activeClass === 'ENVOY') return activeIncursion.envoyLoadout;
    return sanitizeAegisTechniqueLoadout(activeIncursion.aegisTechniqueLoadout);
  }, [activeClass, activeIncursion.aegisTechniqueLoadout, activeIncursion.envoyLoadout, activeIncursion.hexShotLoadout]);
  const aegisSurfaceRows = useMemo(() => {
    if (activeClass !== 'AEGIS') return undefined;
    return buildAegisGraftSurface({
      weaponFamilyId: activeIncursion.activeWeaponFamilyId,
      techniques: sanitizeAegisTechniqueLoadout(activeIncursion.aegisTechniqueLoadout),
    });
  }, [activeClass, activeIncursion.activeWeaponFamilyId, activeIncursion.aegisTechniqueLoadout]);

  const abilityGrafts = useMemo(() => {
    if (activeClass === 'HEX_SHOT') return activeIncursion.hexShotAbilityGrafts;
    if (activeClass === 'ENVOY') return activeIncursion.envoyAbilityGrafts;
    return activeIncursion.abilityGrafts;
  }, [activeClass, activeIncursion.abilityGrafts, activeIncursion.envoyAbilityGrafts, activeIncursion.hexShotAbilityGrafts]);

  const graftCapacityUsed = useMemo(
    () => Object.values(abilityGrafts as Record<string, string | undefined>).filter(Boolean).length,
    [abilityGrafts],
  );
  const graftCapacityAvailable = Math.max(0, graftAccess.capacity - graftCapacityUsed);

  const contentPadding = isDesktop ? scaleSpacing(graftTerminalOpen ? 12 : 16) : scaleSpacing(10);
  const contentMaxWidth = isDesktop
    ? Math.min(
      graftTerminalOpen ? GRAFT_CONTENT_MAX_WIDTH : CONTENT_MAX_WIDTH,
      activeViewportWidth,
    )
    : activeViewportWidth;

  const vectorNode = getSelectedVectorNode();
  const corruptedSanctuaryPending =
    activeIncursion.depthIdentity?.pendingTwistedChoice?.templateId === 'CORRUPTED_SANCTUARY'
    || activeIncursion.depthIdentity?.pendingTwistedChoice?.templateId === 'NO_EXIT_SANCTUARY';
  const headerCopy = resolveRunEventNodeHeaderFromNode(
    vectorNode,
    'SANCTUARY',
    corruptedSanctuaryPending
      ? (activeIncursion.depthIdentity?.pendingTwistedChoice?.templateId === 'NO_EXIT_SANCTUARY'
        ? 'NO-EXIT SANCTUARY'
        : 'CORRUPTED RE-TUNE CONDUIT')
      : 'RE-TUNE CONDUIT',
  );

  const telemetryPadding = scaleSpacing(graftTerminalOpen ? 10 : 16);
  const choicePaddingVertical = scaleSpacing(graftTerminalOpen ? 12 : 14);
  const choicePaddingHorizontal = scaleSpacing(graftTerminalOpen ? 16 : 20);
  const choiceGap = scaleSpacing(graftTerminalOpen ? 8 : 12);
  const columnGap = scaleSpacing(graftTerminalOpen ? 8 : 12);

  const narrativeSize = scaleFont(graftTerminalOpen ? 10 : 11);
  const choicePrimarySize = 11 * fontScale * 1.2;
  const choiceSecondarySize = scaleFont(10);

  const attuneHealAmount = Math.max(1, Math.floor(runState.maxSoulAnchor * 0.3));
  const attuneResultHp = Math.min(
    runState.maxSoulAnchor,
    runState.soulAnchorIntegrity + attuneHealAmount,
  );

  const handleSelectAttune = () => {
    if (confirmed || corruptedSanctuaryPending || attuneOverlay) return;
    const fromHp = runState.soulAnchorIntegrity;
    const toHp = Math.min(
      runState.maxSoulAnchor,
      fromHp + Math.max(1, Math.floor(runState.maxSoulAnchor * 0.3)),
    );
    setSelectedChoice('ATTUNE');
    setGraftTerminalOpen(false);
    setGraftComplete(false);
    setConfirmed(true);
    applySanctuaryAttune();
    setAttuneOverlay({ fromHp, toHp });
  };

  const handleSelectGraft = () => {
    if (confirmed || corruptedSanctuaryPending) return;
    setSelectedChoice('GRAFT');
    setGraftComplete(false);
    setGraftSelection({ graftId: null, abilityId: null, canInject: false });
    setGraftTerminalOpen(true);
    openSanctuaryGraftTerminal();
  };

  const handleApplyGraft = (abilityId: string, graftId: string) => {
    const result = applyClassGraftToAbility(abilityId, graftId);
    if (result.success) {
      setGraftComplete(true);
      setGraftSelection({ graftId: null, abilityId: null, canInject: false });
    }
  };

  const handleGraftSelectionChange = useCallback((selection: GraftInjectSelection) => {
    setGraftSelection(selection);
  }, []);

  const handleInjectGraft = () => {
    if (!graftSelection.canInject || !graftSelection.graftId || !graftSelection.abilityId) return;
    handleApplyGraft(graftSelection.abilityId, graftSelection.graftId);
  };

  const handleCancelGraft = () => {
    if (confirmed) return;
    setSelectedChoice(null);
    setGraftTerminalOpen(false);
    setGraftComplete(false);
    setGraftSelection({ graftId: null, abilityId: null, canInject: false });
    clearSanctuaryGraftSession();
  };

  const handleAttuneContinue = () => {
    setAttuneOverlay(null);
    completeCurrentNode('Soul anchor stabilized.');
  };

  const handleLeaveSanctuary = () => {
    if (confirmed || attuneOverlay) return;
    setConfirmed(true);
    clearSanctuaryGraftSession();
    if (selectedChoice === 'GRAFT' && graftComplete) {
      setTimeout(() => completeCurrentNode('Class graft mutation secured.'), 400);
      return;
    }
    setTimeout(() => completeCurrentNode('Sanctuary passed — continuing descent.'), 400);
  };

  const graftTerminalLabel = activeClass === 'HEX_SHOT'
    ? 'ACCESS HEX-SHOT GRAFT'
    : activeClass === 'ENVOY'
      ? 'ACCESS ENVOY GRAFT'
      : 'ACCESS VEIL-GRAFT';

  const leftPanelContent = (
    <>
      {!graftTerminalOpen ? (
        <FieldPlate
          density="light"
          brackets
          style={styles.telemetryShell}
          contentStyle={[styles.telemetryContent, { padding: telemetryPadding }]}
        >
          <Text
            style={[
              styles.narrativeText,
              {
                color: RUN_FIELD.text,
                fontSize: narrativeSize,
                lineHeight: Math.round(narrativeSize * 1.55),
              },
            ]}
          >
            {corruptedSanctuaryPending
              ? (activeIncursion.depthIdentity?.pendingTwistedChoice?.templateId === 'NO_EXIT_SANCTUARY'
                ? 'This Deep Veil chapel was not built for you. Resolve the twisted choice modal — standard attune/graft is offline.'
                : 'This sanctuary is corrupted. Resolve the twisted choice modal — standard attune/graft is offline until the conduit answers or you leave.')
              : 'Ley energy hums through the anchor chapel. A brief respite. Choose attunement or graft mutation.'}
          </Text>
        </FieldPlate>
      ) : null}

      {!graftTerminalOpen ? (
        <View style={[styles.choiceCol, { gap: choiceGap }]}>
          <SanctuaryChoiceBlock
            primaryLabel="ATTUNE"
            secondaryLabel={corruptedSanctuaryPending ? 'OFFLINE — twisted conduit' : 'Restore 30% of Maximum Health'}
            selected={selectedChoice === 'ATTUNE'}
            dimmed={selectedChoice === 'GRAFT' || (confirmed && selectedChoice !== 'ATTUNE') || corruptedSanctuaryPending}
            locked={corruptedSanctuaryPending}
            tone="mint"
            primaryFontSize={choicePrimarySize}
            secondaryFontSize={choiceSecondarySize}
            paddingVertical={choicePaddingVertical}
            paddingHorizontal={choicePaddingHorizontal}
            onPress={handleSelectAttune}
            disabled={confirmed || corruptedSanctuaryPending}
          />

          <SanctuaryChoiceBlock
            primaryLabel={graftTerminalLabel}
            secondaryLabel={
              corruptedSanctuaryPending
                ? 'OFFLINE — twisted conduit'
                : 'Patch a graft onto an equipped ability'
            }
            selected={selectedChoice === 'GRAFT'}
            dimmed={selectedChoice === 'ATTUNE' || (confirmed && selectedChoice !== 'GRAFT') || corruptedSanctuaryPending}
            locked={corruptedSanctuaryPending}
            tone="occult"
            primaryFontSize={choicePrimarySize}
            secondaryFontSize={choiceSecondarySize}
            paddingVertical={choicePaddingVertical}
            paddingHorizontal={choicePaddingHorizontal}
            onPress={handleSelectGraft}
            disabled={confirmed || corruptedSanctuaryPending}
          />
        </View>
      ) : null}

      {graftTerminalOpen ? (
        <View style={styles.graftHost}>
          <ClassGraftUI
            activeClass={activeClass}
            loadout={loadout}
            offers={graftOffers}
            abilityGrafts={abilityGrafts}
            onSelectionChange={handleGraftSelectionChange}
            compact
            borderColor={theme.borderColor}
            primaryColor={theme.primaryColor}
            mutedColor={theme.mutedColor}
            onInjectCancel={graftComplete ? undefined : handleCancelGraft}
            onInject={graftComplete ? undefined : handleInjectGraft}
            canInject={graftSelection.canInject}
            injectDisabled={confirmed}
            cancelDisabled={confirmed}
            runDepthBand={runDepthBand}
            aegisSurfaceRows={aegisSurfaceRows}
            capacityUsed={graftCapacityUsed}
            capacityAvailable={graftCapacityAvailable}
          />
        </View>
      ) : null}
    </>
  );

  return (
    <IncursionShell>
      <IncursionRunLayout hideRunChrome style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventImmersiveBackdrop
          backgroundImage={SanctuaryBg}
          contentPadding={contentPadding}
          overlay={<TerminalOverlay />}
        >
          <View style={styles.stage}>
            {!graftTerminalOpen ? (
              <RunEventNodeHeader
                title={headerCopy.title}
                subtitle={headerCopy.subtitle}
                fontScale={fontScale}
                showRunChrome
              />
            ) : (
              <RunEventNodeHeader
                eyebrow="VEIL-GRAFT TERMINAL"
                title={graftTerminalLabel}
                subtitle={`Depth ${runDepthBand} · capacity ${graftCapacityUsed}/${graftAccess.capacity}`}
                fontScale={fontScale}
                showRunChrome
              />
            )}

            <View style={styles.bodyStage}>
              <View
                style={[
                  styles.contentColumn,
                  {
                    maxWidth: contentMaxWidth,
                    gap: columnGap,
                    flex: 1,
                    minHeight: 0,
                  },
                ]}
              >
                {leftPanelContent}
              </View>
            </View>

            {!confirmed && !attuneOverlay ? (
              <View style={styles.leaveRail}>
                <RunActionRail
                  mode="screen"
                  primaryLabel="LEAVE SANCTUARY"
                  onPrimary={handleLeaveSanctuary}
                  primaryDisabled={confirmed}
                />
              </View>
            ) : null}
          </View>
        </RunEventImmersiveBackdrop>
      </IncursionRunLayout>

      <AttuneHealOverlay
        visible={attuneOverlay != null}
        fromHp={attuneOverlay?.fromHp ?? runState.soulAnchorIntegrity}
        toHp={attuneOverlay?.toHp ?? attuneResultHp}
        maxHp={runState.maxSoulAnchor}
        onContinue={handleAttuneContinue}
      />
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  bodyStage: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  leaveRail: {
    width: '100%',
    flexShrink: 0,
    marginTop: 8,
  },
  graftHost: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  telemetryShell: {
    width: '100%',
  },
  telemetryContent: {
    width: '100%',
  },
  narrativeText: {
    fontFamily: RUN_FIELD.mono,
    letterSpacing: 0.25,
  },
  choiceCol: {
    width: '100%',
    gap: 12,
  },
  choiceHoverLift: {
    transform: [{ translateY: -1 }],
  },
  choiceContent: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  choicePrimary: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  choiceSecondary: {
    fontFamily: RUN_FIELD.mono,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  selectedMark: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: RUN_FIELD.mint,
    marginTop: 4,
  },
  attuneModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(5, 9, 10, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  attuneModalPlate: {
    width: '100%',
    maxWidth: 420,
  },
  attuneModalContent: {
    padding: 22,
    gap: 12,
    alignItems: 'stretch',
  },
  attuneModalEyebrow: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.eyebrow,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(99, 226, 177, 0.7)',
  },
  attuneModalTitle: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.title,
    fontWeight: '700',
    letterSpacing: 1,
    color: RUN_FIELD.text,
  },
  attuneModalMeta: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    fontWeight: '600',
    color: RUN_FIELD.textSecondary,
  },
  attuneBarTrack: {
    height: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: RUN_FIELD.mintBorder,
    backgroundColor: 'rgba(5, 9, 10, 0.55)',
    overflow: 'hidden',
    marginTop: 4,
  },
  attuneBarFill: {
    height: '100%',
    backgroundColor: RUN_FIELD.mint,
  },
  attuneContinue: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
});
