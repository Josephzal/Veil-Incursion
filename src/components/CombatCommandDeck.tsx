import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../utils/platformMotion';
import { textGlow, viewShadow } from '../utils/adaptiveStyles';
import HapticPressable from './HapticPressable';
import type { AegisAbilityId } from '../types/aegisCombat';
import { PLAYER_ACTION_POINTS_PER_TURN } from '../types/aegisCombat';
import CombatApPipRow from './combat/CombatApPipRow';
import RunFeedChromeButtons from './run/RunFeedChromeButtons';
import { useCombatDesktopLayout } from '../hooks/useCombatDesktopLayout';
import { DOSSIER_CTA_BG, DOSSIER_ROW_BG } from '../constants/dossierSurface';
import { COMBAT_HUD_TYPE } from '../constants/combatHudTypography';
import { OTT, OTT_LAYOUT } from '../constants/occultTacticalTerminalTheme';
import type { AbilityTargetMode } from '../data/combatTargeting';

const MONO = OTT.mono;
const TILE_HEIGHT = 40;
const TILE_HEIGHT_DASHBOARD = 25;
const TILE_MARGIN_BOTTOM = 8;
const TILE_MARGIN_BOTTOM_DASHBOARD = 2;
const DASHBOARD_MINIGAME_BTN_HEIGHT = TILE_HEIGHT_DASHBOARD;
const DASHBOARD_END_TURN_HEIGHT = TILE_HEIGHT_DASHBOARD - 4;
const GRID_GAP = 6;
const AP_ROW_HEIGHT = 22;
const GRID_BODY_HEIGHT = TILE_HEIGHT * 2 + TILE_MARGIN_BOTTOM * 2 + GRID_GAP;
const INITIATIVE_FLOAT_MS = 800;
const INITIATIVE_SURGE_MS = 300;
const INITIATIVE_GLOW = OTT.fluxViolet;
const INITIATIVE_GLOW_PALE = OTT.cyanSelect;
const END_TURN_ENABLED = OTT.soulRed;
const END_TURN_BORDER = OTT.dangerRedDark;
const END_TURN_BORDER_MUTED = 'rgba(158, 40, 48, 0.45)';

export const COMMAND_DECK_MIN_HEIGHT = AP_ROW_HEIGHT + GRID_GAP + GRID_BODY_HEIGHT + 10;
export const COMMAND_DECK_MIN_HEIGHT_WITH_ULTIMATE = COMMAND_DECK_MIN_HEIGHT;

interface CombatCommandDeckProps {
  loadout: readonly string[];
  selectedAbility: string | null;
  onSelectAbility: (ability: string) => void;
  onConfirm: () => void;
  onAbort: () => void;
  onEndTurn: () => void;
  actionPoints: number;
  displayActionPoints?: number | null;
  maxActionPoints?: number;
  isActionEnabled: (ability: string) => boolean;
  canSelectActions?: boolean;
  getActionDisableReason?: (ability: string) => string | null;
  canEndTurn: boolean;
  getAbilityLabel: (ability: string) => string;
  /** Concept card category line (MELEE / DEFENSE / …). */
  getAbilityCategory?: (ability: string) => string;
  /** Damage / buff / debuff chips — same idle and selected. */
  getAbilityEffectTags?: (ability: string) => string;
  /** Target mode drives confirm-on-card for NONE abilities. */
  getAbilityTargetMode?: (ability: string) => AbilityTargetMode;
  initiativeQueued?: boolean;
  initiativeProcSeq?: number;
  onInitiativeProcComplete?: () => void;
  getStagedCostImpact: (ability: string) => string;
  getStagedAbilityDescription: (ability: string) => string;
  getActionAccent?: (ability: string) => string | undefined;
  bloodForTimeAvailable?: boolean;
  bloodForTimeEnabled?: boolean;
  onBloodForTime?: () => void;
  combatReloadAvailable?: boolean;
  combatReloadEnabled?: boolean;
  onCombatReload?: () => void;
  voidWardAvailable?: boolean;
  voidWardEnabled?: boolean;
  voidWardPrimed?: boolean;
  onVoidWardPrime?: () => void;
  /** Phase 3 — Aegis Riposte Ready chip. */
  riposteReady?: boolean;
  catalyticConsoleAvailable?: boolean;
  catalyticConsoleEnabled?: boolean;
  catalyticConsoleRotStacks?: number;
  onCatalyticConsole?: () => void;
  borderColor: string;
  primaryColor: string;
  mutedColor: string;
  frameless?: boolean;
  dashboardLayout?: boolean;
}

export default function CombatCommandDeck({
  loadout,
  selectedAbility,
  onSelectAbility,
  onConfirm,
  onAbort,
  onEndTurn,
  actionPoints,
  displayActionPoints = null,
  maxActionPoints = PLAYER_ACTION_POINTS_PER_TURN,
  isActionEnabled,
  canSelectActions = true,
  getActionDisableReason,
  canEndTurn,
  getAbilityLabel,
  getAbilityCategory,
  getAbilityEffectTags,
  getAbilityTargetMode,
  initiativeQueued = false,
  initiativeProcSeq = 0,
  onInitiativeProcComplete,
  getStagedCostImpact,
  getStagedAbilityDescription,
  getActionAccent,
  bloodForTimeAvailable = false,
  bloodForTimeEnabled = false,
  onBloodForTime,
  combatReloadAvailable = false,
  combatReloadEnabled = false,
  onCombatReload,
  voidWardAvailable = false,
  voidWardEnabled = false,
  voidWardPrimed = false,
  onVoidWardPrime,
  riposteReady = false,
  catalyticConsoleAvailable = false,
  catalyticConsoleEnabled = false,
  catalyticConsoleRotStacks = 0,
  onCatalyticConsole,
  borderColor,
  primaryColor,
  mutedColor,
  frameless = false,
  dashboardLayout = false,
}: CombatCommandDeckProps): React.JSX.Element {
  const { isCombatDesktop, fontScale, scaleCombatFont, scaleCombatSize } = useCombatDesktopLayout();
  const desktopDeck = dashboardLayout && isCombatDesktop;
  const webStagedFocus = Platform.OS === 'web' && selectedAbility != null;
  const shownAp = displayActionPoints ?? actionPoints;
  const lastProcSeqRef = useRef(0);
  const queuePulse = useRef(new Animated.Value(0)).current;
  const surgeScale = useRef(new Animated.Value(0.92)).current;
  const surgeOpacity = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const floatTranslateY = useRef(new Animated.Value(8)).current;
  const floatScale = useRef(new Animated.Value(0.86)).current;
  const [floatVisible, setFloatVisible] = useState(false);
  const [hoveredAbility, setHoveredAbility] = useState<string | null>(null);

  useEffect(() => {
    if (!initiativeQueued) {
      queuePulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(queuePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(queuePulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [initiativeQueued, queuePulse]);

  useEffect(() => {
    if (initiativeProcSeq <= 0 || initiativeProcSeq === lastProcSeqRef.current) return;
    lastProcSeqRef.current = initiativeProcSeq;
    setFloatVisible(true);
    floatOpacity.setValue(0);
    floatTranslateY.setValue(8);
    floatScale.setValue(0.86);
    surgeScale.setValue(0.92);
    surgeOpacity.setValue(0);

    const riseMs = Math.floor(INITIATIVE_FLOAT_MS * 0.55);
    const fadeMs = Math.floor(INITIATIVE_FLOAT_MS * 0.45);

    Animated.parallel([
      Animated.timing(surgeOpacity, {
        toValue: 1,
        duration: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(surgeScale, {
        toValue: 1.08,
        duration: INITIATIVE_SURGE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(floatOpacity, {
        toValue: 1,
        duration: Math.min(120, riseMs),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(floatTranslateY, {
        toValue: -28,
        duration: riseMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(floatScale, {
        toValue: 1.08,
        duration: riseMs,
        easing: Easing.out(Easing.back(1.12)),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(surgeOpacity, {
          toValue: 0,
          duration: Math.max(120, INITIATIVE_SURGE_MS - 80),
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(surgeScale, {
          toValue: 1.16,
          duration: Math.max(120, INITIATIVE_SURGE_MS - 80),
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    });

    Animated.sequence([
      Animated.delay(riseMs),
      Animated.timing(floatOpacity, {
        toValue: 0,
        duration: fadeMs,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      setFloatVisible(false);
      onInitiativeProcComplete?.();
    });
  }, [
    floatOpacity,
    floatScale,
    floatTranslateY,
    initiativeProcSeq,
    onInitiativeProcComplete,
    surgeOpacity,
    surgeScale,
  ]);

  const queuedBorderColor = queuePulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(167, 139, 250, 0.35)', 'rgba(186, 230, 253, 0.82)'],
  });

  const deckShellStyle = [
    styles.commandDeck,
    frameless ? styles.commandDeckFrameless : null,
    !frameless ? { borderColor } : null,
  ];

  const labelFor = (ability: string) => getAbilityLabel(ability);

  const tileHeight = dashboardLayout
    ? (desktopDeck ? undefined : TILE_HEIGHT_DASHBOARD)
    : TILE_HEIGHT;
  const desktopBtnStyle = desktopDeck ? {
    borderWidth: 2,
    minHeight: scaleCombatSize(44),
  } : null;
  const desktopLabelStyle = desktopDeck ? {
    fontSize: scaleCombatFont(9),
    letterSpacing: 0.35,
  } : null;
  const desktopActionLabelStyle = desktopDeck ? desktopLabelStyle : null;
  const apTypography = desktopDeck ? {
    labelFontSize: scaleCombatFont(9),
    hexSize: scaleCombatSize(10),
  } : null;

  const dashboardTwinBtnStyle = dashboardLayout ? styles.dashboardTwinActionBtn : null;

  const renderClassActionButtons = (includeEndTurn: boolean) => {
    if (webStagedFocus) return null;
    return (
      <>
        {renderVoidWardButton()}
        {renderCatalyticConsoleButton()}
        {renderCombatReloadButton()}
        {includeEndTurn ? renderEndTurnButton() : null}
      </>
    );
  };

  const renderWebStagedApRow = () => (
    <View style={[styles.topBand, dashboardLayout && styles.topBandDashboard]}>
      <View style={[styles.apColumn, webStagedFocus && styles.webStagedApColumn]}>
        <CombatApPipRow
          current={shownAp}
          max={maxActionPoints}
          accent={primaryColor}
          mutedColor={mutedColor}
          queued={initiativeQueued}
          fontScale={desktopDeck ? fontScale : 1}
          labelFontSize={apTypography?.labelFontSize}
          hexSize={apTypography?.hexSize}
          compact={dashboardLayout}
          centered={dashboardLayout || webStagedFocus}
        />
      </View>
    </View>
  );

  const renderDashboardTopBand = (includeEndTurn: boolean) => (
    <View style={[styles.topBand, dashboardLayout && styles.topBandDashboard]}>
      <View style={styles.apColumn}>
        <CombatApPipRow
          current={shownAp}
          max={maxActionPoints}
          accent={primaryColor}
          mutedColor={mutedColor}
          queued={initiativeQueued}
          fontScale={desktopDeck ? fontScale : 1}
          labelFontSize={apTypography?.labelFontSize}
          hexSize={apTypography?.hexSize}
          compact={dashboardLayout}
          centered={dashboardLayout}
        />
      </View>
      <View style={[styles.apActions, styles.apActionsDashboard]}>
        {renderClassActionButtons(includeEndTurn)}
      </View>
    </View>
  );

  const renderTile = (ability: string) => {
    const enabled = isActionEnabled(ability);
    const accent = getActionAccent?.(ability);
    const costImpact = getStagedCostImpact(ability);
    const isSelected = selectedAbility === ability;
    const tileBorderColor = isSelected
      ? (dashboardLayout ? OTT.cyanSelect : OTT.terminalGreen)
      : enabled && accent
        ? accent
        : OTT.borderSubtle;
    // Pull a rough AP digit from cost strings like "1 AP" when present.
    const apMatch = costImpact.match(/(\d+)\s*AP/i);
    const apCost = apMatch?.[1] ?? '1';

    if (dashboardLayout) {
      const category = getAbilityCategory?.(ability) ?? 'ACTION';
      const abilityName = labelFor(ability).toUpperCase().replace(/^\[\s*/, '').replace(/\s*\]$/, '');
      const effectTags = getAbilityEffectTags?.(ability) ?? '';
      const targetMode = getAbilityTargetMode?.(ability) ?? 'SINGLE';
      const needsConfirm = isSelected
        && enabled
        && (targetMode === 'NONE' || targetMode === 'ALL');
      const confirmLabel = targetMode === 'ALL' ? 'CONFIRM AOE' : 'CONFIRM';
      const spectrallyLit = hoveredAbility === ability;
      const hoverAccent = isSelected
        ? OTT.cyanSelect
        : spectrallyLit
          ? OTT.terminalGreen
          : tileBorderColor;
      const hoverFill = isSelected
        ? 'rgba(98, 220, 229, 0.12)'
        : spectrallyLit
          ? 'rgba(69, 247, 160, 0.14)'
          : 'rgba(8, 12, 14, 0.42)';
      return (
        <HapticPressable
          key={ability}
          onPress={() => {
            if (!canSelectActions) return;
            if (isSelected) {
              // AoE / self casts wait on CONFIRM — don't cancel via card body taps.
              if (targetMode === 'NONE' || targetMode === 'ALL') return;
              onAbort();
              return;
            }
            onSelectAbility(ability);
          }}
          disabled={!canSelectActions}
          onHoverIn={() => setHoveredAbility(ability)}
          onHoverOut={() => setHoveredAbility((current) => (current === ability ? null : current))}
          style={[
            styles.conceptCard,
            {
              borderColor: hoverAccent,
              backgroundColor: hoverFill,
              shadowColor: isSelected || spectrallyLit ? hoverAccent : 'transparent',
              shadowOpacity: isSelected || spectrallyLit ? 0.5 : 0,
              shadowRadius: isSelected || spectrallyLit ? 10 : 0,
              opacity: enabled ? 1 : 0.4,
            },
          ]}
        >
          <View style={styles.conceptCardPress}>
            <View style={styles.conceptCardTop}>
              <View style={styles.conceptCardTopSpacer} />
              <View style={styles.apDiamondHost}>
                <View style={[
                  styles.apDiamond,
                  { borderColor: isSelected ? OTT.cyanSelect : OTT.borderSubtle },
                ]}>
                  <Text style={[
                    styles.apDiamondText,
                    { color: isSelected ? OTT.cyanSelect : OTT.textPrimary },
                  ]}>
                    {apCost}
                  </Text>
                </View>
              </View>
            </View>
            <Text
              style={[styles.conceptCardName, { color: enabled ? OTT.textPrimary : OTT.textMuted }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {abilityName}
            </Text>
            <Text style={styles.conceptCardCategory} numberOfLines={1}>
              {category}
            </Text>
            {effectTags ? (
              <Text
                style={[
                  styles.conceptCardTags,
                  { color: isSelected ? OTT.cyanSelect : OTT.textMuted },
                ]}
                numberOfLines={3}
              >
                {effectTags}
              </Text>
            ) : (
              <View style={styles.conceptCardSpacer} />
            )}
            {needsConfirm ? (
              <HapticPressable
                onPress={onConfirm}
                style={styles.conceptConfirmBtn}
              >
                <Text style={styles.conceptConfirmLabel}>{confirmLabel}</Text>
              </HapticPressable>
            ) : null}
          </View>
        </HapticPressable>
      );
    }

    return (
      <View
        key={ability}
        style={[
          styles.tileSlot,
          {
            borderColor: tileBorderColor,
            borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
            backgroundColor: isSelected ? 'rgba(98, 220, 229, 0.1)' : OTT.deepPanel,
            shadowColor: isSelected ? OTT.cyanSelect : 'transparent',
            shadowOpacity: isSelected ? 0.35 : 0,
            shadowRadius: isSelected ? 6 : 0,
            ...(tileHeight != null ? { height: tileHeight } : null),
          },
        ]}
      >
        <HapticPressable
          onPress={() => canSelectActions && onSelectAbility(ability)}
          disabled={!canSelectActions}
          style={[styles.deckTile, { opacity: enabled ? 1 : 0.38 }]}
        >
          <Text style={[styles.tileSlotIndex, { color: isSelected ? OTT.cyanSelect : OTT.textMuted }]}>
            {`${String(Math.max(1, loadout.indexOf(ability) + 1)).padStart(2, '0')} //`}
          </Text>
          <Text
            style={[
              styles.tileLabel,
              desktopLabelStyle,
              { color: enabled ? (accent || OTT.textPrimary) : OTT.textMuted },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {labelFor(ability)}
          </Text>
          {costImpact ? (
            <Text style={styles.tileMeta} numberOfLines={1}>
              {costImpact}
            </Text>
          ) : null}
        </HapticPressable>
      </View>
    );
  };

  const canExecute = selectedAbility ? isActionEnabled(selectedAbility) : false;

  const desktopMetaLabelStyle = desktopDeck ? {
    fontSize: scaleCombatFont(9),
    letterSpacing: 0.35,
    lineHeight: scaleCombatFont(12),
  } : null;

  const endTurnBorder = dashboardLayout
    ? (canEndTurn ? OTT.cyanSelect : OTT.borderMuted)
    : (canEndTurn ? END_TURN_BORDER : END_TURN_BORDER_MUTED);
  const endTurnText = dashboardLayout
    ? (canEndTurn ? OTT.cyanSelect : OTT.textMuted)
    : (canEndTurn ? END_TURN_ENABLED : mutedColor);

  const renderEndTurnButton = () => (
    initiativeQueued ? (
      <Animated.View
        style={[
          dashboardLayout ? styles.endTurnBtnDashboard : styles.endTurnBtn,
          {
            borderColor: dashboardLayout ? OTT.cyanSelect : queuedBorderColor,
            opacity: canEndTurn ? 1 : 0.4,
            ...(dashboardLayout ? null : desktopBtnStyle),
          },
        ]}
      >
        <HapticPressable
          onPress={onEndTurn}
          disabled={!canEndTurn}
          style={styles.endTurnPressable}
        >
          <Text style={[
            styles.endTurnLabel,
            dashboardLayout && styles.endTurnLabelDashboard,
            dashboardLayout ? null : desktopActionLabelStyle,
            { color: INITIATIVE_GLOW_PALE },
          ]}>
            END TURN
          </Text>
        </HapticPressable>
      </Animated.View>
    ) : (
      <HapticPressable
        onPress={onEndTurn}
        disabled={!canEndTurn}
        style={[
          dashboardLayout ? styles.endTurnBtnDashboard : styles.endTurnBtn,
          {
            borderColor: endTurnBorder,
            backgroundColor: dashboardLayout
              ? 'rgba(98, 220, 229, 0.06)'
              : (canEndTurn ? '#1a1212' : DOSSIER_ROW_BG),
            opacity: canEndTurn ? 1 : 0.4,
            ...(dashboardLayout ? null : desktopBtnStyle),
          },
        ]}
      >
        <Text style={[
          styles.endTurnLabel,
          dashboardLayout && styles.endTurnLabelDashboard,
          dashboardLayout ? null : desktopActionLabelStyle,
          { color: endTurnText },
        ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          END TURN
        </Text>
      </HapticPressable>
    )
  );

  const renderCombatReloadButton = () => {
    if (!combatReloadAvailable) return null;
    if (dashboardLayout) {
      return (
        <HapticPressable
          onPress={onCombatReload}
          disabled={!combatReloadEnabled}
          style={[
            styles.catalystTile,
            {
              borderColor: combatReloadEnabled ? OTT.warningAmber : OTT.borderSubtle,
              opacity: combatReloadEnabled ? 1 : 0.42,
            },
          ]}
        >
          <Text style={[styles.catalystTitle, { color: combatReloadEnabled ? OTT.warningAmber : OTT.textSecondary }]}>
            RELOAD
          </Text>
          <Text style={styles.catalystSub}>CLASS ACTION</Text>
          <Text style={[styles.catalystStatus, { color: combatReloadEnabled ? OTT.warningAmber : OTT.textMuted }]}>
            {combatReloadEnabled ? 'READY' : 'LOCKED'}
          </Text>
        </HapticPressable>
      );
    }
    return (
      <HapticPressable
        onPress={onCombatReload}
        disabled={!combatReloadEnabled}
        style={[
          styles.combatReloadBtn,
          {
            borderColor: combatReloadEnabled ? '#fbbf24' : borderColor,
            opacity: combatReloadEnabled ? 1 : 0.4,
            ...desktopBtnStyle,
          },
        ]}
      >
        <Text
          style={[
            styles.combatReloadLabel,
            desktopActionLabelStyle,
            { color: combatReloadEnabled ? '#fbbf24' : mutedColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          [ RELOAD ]
        </Text>
      </HapticPressable>
    );
  };

  const renderCatalyticConsoleButton = () => {
    if (!catalyticConsoleAvailable) return null;
    const ready = catalyticConsoleEnabled && catalyticConsoleRotStacks > 0;
    const accent = ready ? OTT.terminalGreen : OTT.borderSubtle;
    const statusLabel = ready ? 'READY' : catalyticConsoleRotStacks > 0 ? 'LOCKED' : 'CHARGING';
    if (dashboardLayout) {
      return (
        <HapticPressable
          onPress={onCatalyticConsole}
          disabled={!catalyticConsoleEnabled}
          style={[
            styles.catalystTile,
            {
              borderColor: accent,
              opacity: catalyticConsoleEnabled ? 1 : 0.42,
            },
          ]}
        >
          <Text style={[styles.catalystTitle, { color: ready ? OTT.terminalGreen : OTT.textSecondary }]}>
            CATALYST
          </Text>
          <Text style={styles.catalystSub}>CLASS ACTION</Text>
          <Text style={[styles.catalystStatus, { color: ready ? OTT.terminalGreenMuted : OTT.textMuted }]}>
            {statusLabel}
          </Text>
        </HapticPressable>
      );
    }
    return (
      <HapticPressable
        onPress={onCatalyticConsole}
        disabled={!catalyticConsoleEnabled}
        style={[
          dashboardTwinBtnStyle,
          styles.combatReloadBtn,
          {
            borderColor: catalyticConsoleEnabled ? accent : borderColor,
            opacity: catalyticConsoleEnabled ? 1 : 0.4,
            ...desktopBtnStyle,
          },
        ]}
      >
        <Text
          style={[
            styles.combatReloadLabel,
            desktopActionLabelStyle,
            { color: catalyticConsoleEnabled ? accent : mutedColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          CATALYST
        </Text>
      </HapticPressable>
    );
  };

  const renderVoidWardButton = () => {
    if (!voidWardAvailable) return null;
    const primed = voidWardPrimed;
    const enabled = voidWardEnabled && !primed;
    const accent = riposteReady
      ? OTT.warningAmber
      : primed || enabled
        ? OTT.cyanSelect
        : OTT.borderSubtle;
    const statusLabel = riposteReady ? 'RIPOSTE' : primed ? 'PRIMED' : enabled ? 'READY' : 'LOCKED';
    if (dashboardLayout) {
      return (
        <HapticPressable
          onPress={onVoidWardPrime}
          disabled={!enabled}
          style={[
            styles.catalystTile,
            {
              borderColor: accent,
              opacity: primed || enabled || riposteReady ? 1 : 0.42,
            },
          ]}
        >
          <Text style={[styles.catalystTitle, { color: accent === OTT.borderSubtle ? OTT.textSecondary : accent }]}>
            {riposteReady ? 'RIPOSTE' : 'PARRY'}
          </Text>
          <Text style={styles.catalystSub}>CLASS ACTION</Text>
          <Text style={[styles.catalystStatus, { color: accent === OTT.borderSubtle ? OTT.textMuted : accent }]}>
            {statusLabel}
          </Text>
        </HapticPressable>
      );
    }
    return (
      <HapticPressable
        onPress={onVoidWardPrime}
        disabled={!enabled}
        style={[
          styles.combatReloadBtn,
          {
            borderColor: riposteReady
              ? '#fbbf24'
              : primed
                ? '#7dd3fc'
                : enabled
                  ? '#38bdf8'
                  : borderColor,
            opacity: primed || enabled || riposteReady ? 1 : 0.4,
            ...desktopBtnStyle,
          },
        ]}
      >
        <Text
          style={[
            styles.combatReloadLabel,
            desktopActionLabelStyle,
            {
              color: riposteReady
                ? '#fde68a'
                : primed
                  ? '#bae6fd'
                  : enabled
                    ? '#38bdf8'
                    : mutedColor,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {riposteReady ? '[ RIPOSTE ]' : primed ? '[ WARD ]' : '[ PARRY ]'}
        </Text>
      </HapticPressable>
    );
  };

  const renderSecondaryActions = () => {
    if (!bloodForTimeAvailable) return null;
    return (
      <View style={styles.secondaryActionsRow}>
        {bloodForTimeAvailable ? (
          <HapticPressable
            onPress={onBloodForTime}
            disabled={!bloodForTimeEnabled}
            style={[
              styles.bloodForTimeBtn,
              {
                borderColor: bloodForTimeEnabled ? '#c41e1e' : borderColor,
                opacity: bloodForTimeEnabled ? 1 : 0.4,
              },
            ]}
          >
            <Text
              style={[styles.bloodForTimeLabel, { color: bloodForTimeEnabled ? '#f87171' : mutedColor }]}
              numberOfLines={1}
            >
              [ BLOOD FOR TIME ]
            </Text>
          </HapticPressable>
        ) : null}
      </View>
    );
  };

  const renderStagedActionRow = () => {
    if (dashboardLayout) {
      return (
        <View style={[styles.stagedActionRow, styles.stagedActionRowDashboard]}>
          <View style={[
            styles.tileSlot,
            {
              borderColor: primaryColor,
              borderWidth: desktopDeck ? 2 : 1,
              ...(tileHeight != null ? { height: tileHeight } : null),
              minHeight: desktopDeck ? scaleCombatSize(44) : DASHBOARD_END_TURN_HEIGHT,
            },
          ]}>
            <HapticPressable
              onPress={onConfirm}
              disabled={!canExecute}
              style={[styles.deckTile, { opacity: canExecute ? 1 : 0.45 }]}
            >
              <Text style={[
                styles.tileLabel,
                styles.tileLabelDashboard,
                desktopLabelStyle,
                { color: primaryColor },
              ]}>
                [ EXECUTE ]
              </Text>
            </HapticPressable>
          </View>
          <View style={[
            styles.tileSlot,
            {
              borderColor,
              borderWidth: desktopDeck ? 2 : 1,
              ...(tileHeight != null ? { height: tileHeight } : null),
              minHeight: desktopDeck ? scaleCombatSize(44) : DASHBOARD_END_TURN_HEIGHT,
            },
          ]}>
            <HapticPressable onPress={onAbort} style={styles.deckTile}>
              <Text style={[
                styles.tileLabel,
                styles.tileLabelDashboard,
                desktopLabelStyle,
                { color: mutedColor },
              ]}>
                [ ABORT ]
              </Text>
            </HapticPressable>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.stagedActionRow, dashboardLayout && styles.stagedActionRowDashboard]}>
        <View style={[styles.tileSlot, { borderColor: primaryColor, height: tileHeight }]}>
          <HapticPressable
            onPress={onConfirm}
            disabled={!canExecute}
            style={[styles.deckTile, { opacity: canExecute ? 1 : 0.45 }]}
          >
            <Text style={[styles.tileLabel, { color: primaryColor }]}>
              [ EXECUTE ]
            </Text>
          </HapticPressable>
        </View>
        <View style={[styles.tileSlot, { borderColor, height: tileHeight }]}>
          <HapticPressable onPress={onAbort} style={styles.deckTile}>
            <Text style={[styles.tileLabel, { color: mutedColor }]}>
              [ ABORT ]
            </Text>
          </HapticPressable>
        </View>
      </View>
    );
  };

  const renderStagedMeta = () => {
    if (!selectedAbility) return null;
    const disableReason = !canExecute ? getActionDisableReason?.(selectedAbility) : null;
    const metaTextStyle = [
      styles.execCost,
      dashboardLayout && styles.execCostDashboard,
      desktopMetaLabelStyle ?? (dashboardLayout ? styles.execCostDashboard : null),
      { color: mutedColor },
    ];
    return (
      <View style={[styles.stagedMeta, dashboardLayout && styles.stagedMetaDashboard]}>
        {!webStagedFocus ? (
          <Text
            style={metaTextStyle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {getStagedCostImpact(selectedAbility)}
          </Text>
        ) : null}
        {disableReason ? (
          <Text
            style={[
              styles.execBlocked,
              dashboardLayout && styles.execBlockedDashboard,
              desktopMetaLabelStyle,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {`BLOCKED: ${disableReason}`}
          </Text>
        ) : null}
        <Text
          style={[
            styles.execDetail,
            dashboardLayout && styles.execDetailDashboard,
            desktopMetaLabelStyle ?? (dashboardLayout ? styles.execDetailDashboard : null),
            { color: mutedColor },
          ]}
          numberOfLines={dashboardLayout ? 4 : 3}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {getStagedAbilityDescription(selectedAbility)}
        </Text>
      </View>
    );
  };

  const renderStagedPanel = () => (
    <View style={[styles.stagedPanel, dashboardLayout && styles.stagedPanelDashboard]}>
      {webStagedFocus
        ? renderWebStagedApRow()
        : (dashboardLayout ? renderDashboardTopBand(false) : null)}
      {renderStagedActionRow()}
      {renderStagedMeta()}
    </View>
  );

  const renderClassActionDeckCard = () => {
    if (!dashboardLayout) return null;

    if (combatReloadAvailable) {
      const ready = combatReloadEnabled;
      const accent = ready ? OTT.warningAmber : OTT.borderSubtle;
      return (
        <HapticPressable
          key="class-action-reload"
          onPress={onCombatReload}
          disabled={!ready}
          onHoverIn={() => setHoveredAbility('__CLASS_RELOAD__')}
          onHoverOut={() => setHoveredAbility((current) => (current === '__CLASS_RELOAD__' ? null : current))}
          style={[
            styles.conceptCard,
            {
              borderColor: hoveredAbility === '__CLASS_RELOAD__' || ready ? accent : OTT.borderSubtle,
              backgroundColor: hoveredAbility === '__CLASS_RELOAD__'
                ? 'rgba(224, 180, 90, 0.14)'
                : 'rgba(8, 12, 14, 0.42)',
              opacity: ready ? 1 : 0.42,
            },
          ]}
        >
          <View style={styles.conceptCardPress}>
            <View style={styles.conceptCardTop}>
              <Text style={[styles.conceptSlot, { color: OTT.textMuted }]}>05 //</Text>
              <Text style={[styles.conceptClassBadge, { color: accent }]}>CA</Text>
            </View>
            <Text
              style={[styles.conceptCardName, { color: ready ? OTT.warningAmber : OTT.textMuted }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              RELOAD
            </Text>
            <Text style={styles.conceptCardCategory} numberOfLines={1}>CLASS ACTION</Text>
            <Text style={styles.conceptCardDesc} numberOfLines={3}>
              {ready ? 'Chamber tactical reload.' : 'Reload locked.'}
            </Text>
            <Text style={[styles.conceptArmed, { color: accent }]}>
              {ready ? 'READY' : 'LOCKED'}
            </Text>
          </View>
        </HapticPressable>
      );
    }

    if (catalyticConsoleAvailable) {
      const ready = catalyticConsoleEnabled && catalyticConsoleRotStacks > 0;
      const accent = ready ? OTT.terminalGreen : OTT.borderSubtle;
      const statusLabel = ready ? 'READY' : catalyticConsoleRotStacks > 0 ? 'LOCKED' : 'CHARGING';
      return (
        <HapticPressable
          key="class-action-catalyst"
          onPress={onCatalyticConsole}
          disabled={!catalyticConsoleEnabled}
          onHoverIn={() => setHoveredAbility('__CLASS_CATALYST__')}
          onHoverOut={() => setHoveredAbility((current) => (current === '__CLASS_CATALYST__' ? null : current))}
          style={[
            styles.conceptCard,
            {
              borderColor: hoveredAbility === '__CLASS_CATALYST__' || ready ? accent : OTT.borderSubtle,
              backgroundColor: hoveredAbility === '__CLASS_CATALYST__'
                ? 'rgba(69, 247, 160, 0.14)'
                : 'rgba(8, 12, 14, 0.42)',
              opacity: catalyticConsoleEnabled ? 1 : 0.42,
            },
          ]}
        >
          <View style={styles.conceptCardPress}>
            <View style={styles.conceptCardTop}>
              <Text style={[styles.conceptSlot, { color: OTT.textMuted }]}>05 //</Text>
              <Text style={[styles.conceptClassBadge, { color: ready ? OTT.terminalGreen : OTT.textMuted }]}>CA</Text>
            </View>
            <Text
              style={[styles.conceptCardName, { color: ready ? OTT.terminalGreen : OTT.textMuted }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              CATALYST
            </Text>
            <Text style={styles.conceptCardCategory} numberOfLines={1}>CLASS ACTION</Text>
            <Text style={styles.conceptCardDesc} numberOfLines={3}>
              {`Discharge Veil Rot payload. ${catalyticConsoleRotStacks} stacks.`}
            </Text>
            <Text style={[styles.conceptArmed, { color: ready ? OTT.terminalGreen : OTT.textMuted }]}>
              {statusLabel}
            </Text>
          </View>
        </HapticPressable>
      );
    }

    if (voidWardAvailable) {
      const primed = voidWardPrimed;
      const enabled = voidWardEnabled && !primed;
      const accent = riposteReady
        ? OTT.warningAmber
        : primed || enabled
          ? OTT.cyanSelect
          : OTT.borderSubtle;
      const title = riposteReady ? 'RIPOSTE' : 'PARRY';
      const statusLabel = riposteReady ? 'RIPOSTE' : primed ? 'PRIMED' : enabled ? 'READY' : 'LOCKED';
      return (
        <HapticPressable
          key="class-action-parry"
          onPress={onVoidWardPrime}
          disabled={!enabled}
          onHoverIn={() => setHoveredAbility('__CLASS_PARRY__')}
          onHoverOut={() => setHoveredAbility((current) => (current === '__CLASS_PARRY__' ? null : current))}
          style={[
            styles.conceptCard,
            {
              borderColor: hoveredAbility === '__CLASS_PARRY__' || accent !== OTT.borderSubtle
                ? accent
                : OTT.borderSubtle,
              backgroundColor: hoveredAbility === '__CLASS_PARRY__'
                ? 'rgba(98, 220, 229, 0.14)'
                : 'rgba(8, 12, 14, 0.42)',
              opacity: primed || enabled || riposteReady ? 1 : 0.42,
            },
          ]}
        >
          <View style={styles.conceptCardPress}>
            <View style={styles.conceptCardTop}>
              <Text style={[styles.conceptSlot, { color: OTT.textMuted }]}>05 //</Text>
              <Text style={[styles.conceptClassBadge, { color: accent === OTT.borderSubtle ? OTT.textMuted : accent }]}>CA</Text>
            </View>
            <Text
              style={[
                styles.conceptCardName,
                { color: accent === OTT.borderSubtle ? OTT.textMuted : accent },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {title}
            </Text>
            <Text style={styles.conceptCardCategory} numberOfLines={1}>CLASS ACTION</Text>
            <Text style={styles.conceptCardDesc} numberOfLines={3}>
              {riposteReady
                ? 'Counter window open.'
                : primed
                  ? 'Ward primed.'
                  : enabled
                    ? 'Prime defensive ward.'
                    : 'Parry locked.'}
            </Text>
            <Text style={[styles.conceptArmed, { color: accent === OTT.borderSubtle ? OTT.textMuted : accent }]}>
              {statusLabel}
            </Text>
          </View>
        </HapticPressable>
      );
    }

    return null;
  };

  const renderAbilityGrid = () => {
    if (dashboardLayout) {
      return (
        <View style={styles.conceptCardRow}>
          {loadout.slice(0, 4).map((ability) => renderTile(ability))}
          {renderClassActionDeckCard()}
        </View>
      );
    }
    return (
      <View style={styles.deckBody}>
        <View style={styles.abilityGrid}>
          <View style={styles.abilityRow}>
            {renderTile(loadout[0])}
            {renderTile(loadout[1])}
          </View>
          <View style={styles.abilityRow}>
            {renderTile(loadout[2])}
            {renderTile(loadout[3])}
          </View>
        </View>
      </View>
    );
  };

  const renderConceptDashboard = () => (
    <View style={styles.conceptDeck}>
      <View style={styles.conceptMain}>
        <View style={styles.conceptApBand}>
          <CombatApPipRow
            current={shownAp}
            max={maxActionPoints}
            accent={OTT.cyanSelect}
            mutedColor={OTT.cyanSelect}
            queued={initiativeQueued}
            conceptBand
            centered
          />
        </View>
        {renderAbilityGrid()}
      </View>
      <View style={styles.conceptTurnCol}>
        <View style={styles.conceptTurnActions}>
          <View style={styles.conceptActionSlot}>
            {renderEndTurnButton()}
          </View>
        </View>
        <View style={styles.conceptChromeSpacer} />
        <View style={styles.conceptChrome}>
          <RunFeedChromeButtons
            accent={OTT.terminalGreen}
            mutedColor={OTT.textMuted}
            terminal
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.deckHost, dashboardLayout && styles.deckHostDashboard]}>
      {floatVisible ? (
        <Animated.Text
          style={[
            styles.initiativeFloat,
            {
              color: INITIATIVE_GLOW_PALE,
              opacity: floatOpacity,
              transform: [{ translateY: floatTranslateY }, { scale: floatScale }],
              ...textGlow({ color: INITIATIVE_GLOW, radius: 8, offset: { width: 0, height: 0 } }),
              pointerEvents: 'none',
            },
          ]}
        >
          INITIATIVE SEIZED
        </Animated.Text>
      ) : null}

      <View style={[styles.deckShellWrap, dashboardLayout && styles.deckShellWrapDashboard]}>
        <Animated.View
          style={[
            styles.surgeRing,
            {
              opacity: surgeOpacity,
              transform: [{ scale: surgeScale }],
              borderColor: INITIATIVE_GLOW_PALE,
              ...viewShadow({
                color: INITIATIVE_GLOW,
                opacity: 0.85,
                radius: 14,
                offset: { width: 0, height: 0 },
              }),
              pointerEvents: 'none',
            },
          ]}
        />

        <View style={[deckShellStyle, dashboardLayout && styles.commandDeckDashboard]}>
          {dashboardLayout ? (
            renderConceptDashboard()
          ) : selectedAbility ? (
            renderStagedPanel()
          ) : (
            <>
              <View style={styles.apRow}>
                <CombatApPipRow
                  current={shownAp}
                  max={maxActionPoints}
                  accent={primaryColor}
                  mutedColor={mutedColor}
                  queued={initiativeQueued}
                />
                <View style={styles.apActions}>
                  {renderVoidWardButton()}
                  {renderCatalyticConsoleButton()}
                  {renderCombatReloadButton()}
                  {bloodForTimeAvailable ? (
                    <HapticPressable
                      onPress={onBloodForTime}
                      disabled={!bloodForTimeEnabled}
                      style={[
                        styles.bloodForTimeBtn,
                        {
                          borderColor: bloodForTimeEnabled ? '#c41e1e' : borderColor,
                          opacity: bloodForTimeEnabled ? 1 : 0.4,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.bloodForTimeLabel, { color: bloodForTimeEnabled ? '#f87171' : mutedColor }]}
                        numberOfLines={1}
                      >
                        [ BLOOD FOR TIME ]
                      </Text>
                    </HapticPressable>
                  ) : null}
                  {renderEndTurnButton()}
                </View>
              </View>
              {renderAbilityGrid()}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deckHost: {
    width: '100%',
    position: 'relative',
  },
  deckHostDashboard: {
    flex: 1,
    minHeight: 0,
  },
  deckShellWrap: {
    width: '100%',
    position: 'relative',
  },
  deckShellWrapDashboard: {
    flex: 1,
    minHeight: 0,
  },
  surgeRing: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
  },
  initiativeFloat: {
    position: 'absolute',
    top: -18,
    alignSelf: 'center',
    zIndex: 4,
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  commandDeck: {
    flexShrink: 0,
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 4,
    paddingBottom: 2,
    gap: GRID_GAP,
  },
  commandDeckFrameless: {
    borderTopWidth: 0,
    paddingTop: 3,
    paddingBottom: 2,
  },
  commandDeckDashboard: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    borderTopWidth: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 4,
  },
  topBand: {
    flexShrink: 0,
    minHeight: AP_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    width: '100%',
  },
  topBandDashboard: {
    justifyContent: 'space-between',
    gap: 0,
  },
  apColumn: {
    width: '48%',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webStagedApColumn: {
    width: '100%',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    width: '100%',
  },
  abilitiesSection: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  apRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: GRID_GAP,
    width: '100%',
  },
  apActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID_GAP,
    flexShrink: 0,
  },
  apActionsDashboard: {
    width: '48%',
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: GRID_GAP,
  },
  dashboardTwinActionBtn: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: DASHBOARD_MINIGAME_BTN_HEIGHT,
    borderWidth: 1,
    paddingHorizontal: 2,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bloodForTimeBtn: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 108,
    alignItems: 'center',
    backgroundColor: DOSSIER_ROW_BG,
  },
  combatReloadBtn: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 88,
    alignItems: 'center',
    backgroundColor: DOSSIER_ROW_BG,
  },
  combatReloadBtnDashboard: {
    maxWidth: 68,
    paddingHorizontal: 3,
    flexShrink: 0,
  },
  combatMinigameBtnDashboard: {
    flex: 1,
    maxWidth: undefined,
    minWidth: 0,
    minHeight: DASHBOARD_MINIGAME_BTN_HEIGHT,
    paddingVertical: 5,
    justifyContent: 'center',
  },
  combatMinigameLabelDashboard: {
    fontSize: 6,
    letterSpacing: 0.25,
  },
  combatReloadLabel: {
    fontFamily: MONO,
    fontSize: 6,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  combatReloadLabelDashboard: {
    fontSize: 5.5,
    letterSpacing: 0.2,
  },
  bloodForTimeLabel: {
    fontFamily: MONO,
    fontSize: 6,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  endTurnBtn: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 88,
    alignItems: 'center',
    backgroundColor: DOSSIER_ROW_BG,
  },
  endTurnBtnDashboard: {
    width: '100%',
    height: 40,
    maxHeight: 40,
    paddingHorizontal: 8,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: OTT.cyanSelect,
    backgroundColor: 'rgba(98, 220, 229, 0.06)',
    overflow: 'hidden',
  },
  conceptDeck: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  conceptMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    gap: 6,
    alignItems: 'center',
  },
  conceptApBand: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
    width: '100%',
  },
  conceptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexShrink: 0,
  },
  conceptClassActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  conceptCardRow: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 920,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'center',
  },
  conceptCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    maxWidth: 168,
    minWidth: 110,
    height: 198,
    borderWidth: 1.25,
    borderRadius: 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
  },
  conceptCardPress: {
    flex: 1,
    paddingHorizontal: 9,
    paddingVertical: 10,
    gap: 7,
  },
  conceptCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    minHeight: 18,
  },
  conceptCardTopSpacer: {
    flex: 1,
  },
  conceptSlot: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  apDiamondHost: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  apDiamond: {
    width: 14,
    height: 14,
    borderWidth: 1.25,
    backgroundColor: 'transparent',
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  apDiamondText: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '800',
    transform: [{ rotate: '-45deg' }],
  },
  conceptCardName: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.emphasis,
    fontWeight: '800',
    letterSpacing: 0.35,
    width: '100%',
    marginTop: 2,
  },
  conceptCardCategory: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: OTT.textSecondary,
    marginTop: 2,
  },
  conceptCardDesc: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.body,
    lineHeight: COMBAT_HUD_TYPE.lineBody,
    color: OTT.textPrimary,
    marginTop: 4,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  conceptCardSpacer: {
    flexGrow: 1,
    minHeight: 10,
  },
  conceptCardTags: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    letterSpacing: 0.45,
    color: OTT.textMuted,
    marginTop: 4,
    lineHeight: COMBAT_HUD_TYPE.lineCaption,
    flexGrow: 1,
  },
  conceptArmed: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.terminalGreen,
    marginTop: 2,
  },
  conceptConfirmBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: OTT.terminalGreen,
    backgroundColor: 'rgba(69, 247, 160, 0.12)',
    borderRadius: 2,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conceptConfirmLabel: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.terminalGreen,
  },
  conceptClassBadge: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sideCommitBtn: {
    width: '100%',
    height: 40,
    maxHeight: 40,
    borderWidth: 1.5,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 0,
    overflow: 'hidden',
  },
  sideExecuteBtn: {
    borderColor: OTT.terminalGreen,
    backgroundColor: 'rgba(69, 247, 160, 0.08)',
  },
  sideExecuteLabel: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.label,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.terminalGreen,
  },
  sideAbortBtn: {
    borderColor: OTT.borderSubtle,
    backgroundColor: 'rgba(8, 12, 14, 0.55)',
  },
  sideAbortLabel: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.label,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.textSecondary,
  },
  sideCommitLabelMuted: {
    color: OTT.textMuted,
  },
  conceptTurnCol: {
    width: OTT_LAYOUT.consoleSideWidth,
    flexShrink: 0,
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    gap: 0,
    paddingTop: 28,
    paddingBottom: 2,
    overflow: 'hidden',
  },
  conceptTurnActions: {
    flexGrow: 0,
    flexShrink: 0,
    gap: 6,
    justifyContent: 'flex-end',
  },
  conceptActionSlot: {
    flexGrow: 0,
    flexShrink: 0,
    height: 40,
    width: '100%',
    overflow: 'hidden',
  },
  conceptChromeSpacer: {
    height: 14,
    flexGrow: 0,
    flexShrink: 0,
  },
  conceptChrome: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    minHeight: 28,
    alignItems: 'stretch',
    justifyContent: 'center',
    zIndex: 2,
  },
  catalystTile: {
    width: '100%',
    flex: 1,
    minHeight: 72,
    borderWidth: 1.5,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(98, 220, 229, 0.05)',
  },
  catalystTitle: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  catalystSub: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.8,
    color: OTT.textMuted,
    textAlign: 'center',
  },
  catalystStatus: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  endTurnPressable: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endTurnLabel: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
  endTurnLabelDashboard: {
    fontSize: COMBAT_HUD_TYPE.label,
    letterSpacing: 1.1,
    fontWeight: '800',
    textAlign: 'center',
  },
  deckBody: {
    position: 'relative',
    width: '100%',
  },
  abilityGrid: {
    width: '100%',
    gap: GRID_GAP,
  },
  abilityGridDashboard: {
    flex: 1,
    minHeight: 0,
  },
  abilityRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GRID_GAP,
    width: '100%',
  },
  abilityRowDashboard: {
    flex: 1,
    minHeight: 0,
  },
  tileSlotDashboardFill: {
    minHeight: 0,
  },
  tileSlot: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: OTT.deepPanel,
    borderRadius: 2,
  },
  deckTile: {
    flex: 1,
    height: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 1,
  },
  tileSlotIndex: {
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  tileLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'left',
  },
  tileLabelDashboard: {
    fontSize: 6,
    letterSpacing: 0.3,
  },
  tileMeta: {
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: OTT.textSecondary,
  },
  tileArmed: {
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: OTT.cyanSelect,
  },
  stagedPanel: {
    width: '100%',
    gap: GRID_GAP,
  },
  stagedPanelDashboard: {
    flex: 1,
    minHeight: 0,
  },
  stagedActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GRID_GAP,
    width: '100%',
  },
  stagedActionRowDashboard: {
    flexShrink: 0,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
  },
  stagedMeta: {
    width: '100%',
    gap: 2,
    paddingHorizontal: 2,
  },
  stagedMetaDashboard: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  execCost: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.2,
    lineHeight: 9,
    flexShrink: 0,
  },
  execCostDashboard: {
    lineHeight: 9,
  },
  execBlocked: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.2,
    lineHeight: 9,
    color: '#f87171',
    flexShrink: 0,
  },
  execBlockedDashboard: {
    lineHeight: 9,
  },
  execDetail: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.2,
    lineHeight: 9,
    flexShrink: 1,
  },
  execDetailDashboard: {
    lineHeight: 9,
  },
});
