import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import type { AegisAbilityId } from '../types/aegisCombat';
import { PLAYER_ACTION_POINTS_PER_TURN } from '../types/aegisCombat';
import CombatApPipRow from './combat/CombatApPipRow';

const MONO = 'monospace';
const TILE_HEIGHT = 40;
const TILE_HEIGHT_DASHBOARD = 25;
const TILE_MARGIN_BOTTOM = 8;
const TILE_MARGIN_BOTTOM_DASHBOARD = 2;
const GRID_GAP = 6;
const AP_ROW_HEIGHT = 22;
const GRID_BODY_HEIGHT = TILE_HEIGHT * 2 + TILE_MARGIN_BOTTOM * 2 + GRID_GAP;
const INITIATIVE_FLOAT_MS = 800;
const INITIATIVE_SURGE_MS = 300;
const INITIATIVE_GLOW = '#a78bfa';
const INITIATIVE_GLOW_PALE = '#bae6fd';

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
  initiativeQueued?: boolean;
  initiativeProcSeq?: number;
  onInitiativeProcComplete?: () => void;
  getStagedHeader: (ability: string) => string;
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
  initiativeQueued = false,
  initiativeProcSeq = 0,
  onInitiativeProcComplete,
  getStagedHeader,
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
  const shownAp = displayActionPoints ?? actionPoints;
  const lastProcSeqRef = useRef(0);
  const queuePulse = useRef(new Animated.Value(0)).current;
  const surgeScale = useRef(new Animated.Value(0.92)).current;
  const surgeOpacity = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const floatTranslateY = useRef(new Animated.Value(8)).current;
  const floatScale = useRef(new Animated.Value(0.86)).current;
  const [floatVisible, setFloatVisible] = React.useState(false);

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
        useNativeDriver: true,
      }),
      Animated.timing(surgeScale, {
        toValue: 1.08,
        duration: INITIATIVE_SURGE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(floatOpacity, {
        toValue: 1,
        duration: Math.min(120, riseMs),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(floatTranslateY, {
        toValue: -28,
        duration: riseMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(floatScale, {
        toValue: 1.08,
        duration: riseMs,
        easing: Easing.out(Easing.back(1.12)),
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(surgeOpacity, {
          toValue: 0,
          duration: Math.max(120, INITIATIVE_SURGE_MS - 80),
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(surgeScale, {
          toValue: 1.16,
          duration: Math.max(120, INITIATIVE_SURGE_MS - 80),
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    });

    Animated.sequence([
      Animated.delay(riseMs),
      Animated.timing(floatOpacity, {
        toValue: 0,
        duration: fadeMs,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
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

  const tileHeight = dashboardLayout ? TILE_HEIGHT_DASHBOARD : TILE_HEIGHT;
  const tileMarginBottom = dashboardLayout ? TILE_MARGIN_BOTTOM_DASHBOARD : TILE_MARGIN_BOTTOM;

  const renderTile = (ability: string) => {
    const enabled = isActionEnabled(ability);
    const accent = getActionAccent?.(ability);
    const tileBorderColor = enabled && accent ? accent : borderColor;
    const isSelected = selectedAbility === ability;

    return (
      <View
        key={ability}
        style={[
          styles.tileSlot,
          {
            borderColor: isSelected ? primaryColor : tileBorderColor,
            backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
            height: tileHeight,
            marginBottom: tileMarginBottom,
          },
        ]}
      >
        <HapticPressable
          onPress={() => canSelectActions && onSelectAbility(ability)}
          disabled={!canSelectActions}
          style={[styles.deckTile, { opacity: enabled ? 1 : 0.4 }]}
        >
          <Text
            style={[
              styles.tileLabel,
              dashboardLayout && styles.tileLabelDashboard,
              { color: enabled && accent ? accent : mutedColor },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {labelFor(ability)}
          </Text>
        </HapticPressable>
      </View>
    );
  };

  const canExecute = selectedAbility ? isActionEnabled(selectedAbility) : false;

  const renderEndTurnButton = () => (
    initiativeQueued ? (
      <Animated.View
        style={[
          styles.endTurnBtn,
          dashboardLayout && styles.endTurnBtnDashboard,
          {
            borderColor: queuedBorderColor,
            opacity: canEndTurn ? 1 : 0.4,
          },
        ]}
      >
        <HapticPressable
          onPress={onEndTurn}
          disabled={!canEndTurn}
          style={styles.endTurnPressable}
        >
          <Text style={[styles.endTurnLabel, { color: INITIATIVE_GLOW_PALE }]}>
            [ END TURN ]
          </Text>
        </HapticPressable>
      </Animated.View>
    ) : (
      <HapticPressable
        onPress={onEndTurn}
        disabled={!canEndTurn}
        style={[
          styles.endTurnBtn,
          dashboardLayout && styles.endTurnBtnDashboard,
          {
            borderColor: canEndTurn ? primaryColor : borderColor,
            opacity: canEndTurn ? 1 : 0.4,
          },
        ]}
      >
        <Text style={[styles.endTurnLabel, { color: canEndTurn ? primaryColor : mutedColor }]}>
          [ END TURN ]
        </Text>
      </HapticPressable>
    )
  );

  const renderCombatReloadButton = () => {
    if (!combatReloadAvailable) return null;
    return (
      <HapticPressable
        onPress={onCombatReload}
        disabled={!combatReloadEnabled}
        style={[
          styles.combatReloadBtn,
          dashboardLayout && styles.combatReloadBtnDashboard,
          {
            borderColor: combatReloadEnabled ? '#fbbf24' : borderColor,
            opacity: combatReloadEnabled ? 1 : 0.4,
          },
        ]}
      >
        <Text
          style={[
            styles.combatReloadLabel,
            dashboardLayout ? styles.combatReloadLabelDashboard : null,
            { color: combatReloadEnabled ? '#fbbf24' : mutedColor },
          ]}
          numberOfLines={1}
        >
          [ RELOAD ]
        </Text>
      </HapticPressable>
    );
  };

  const renderCatalyticConsoleButton = () => {
    if (!catalyticConsoleAvailable) return null;
    const accent = catalyticConsoleRotStacks > 0 ? '#4ade80' : borderColor;
    return (
      <HapticPressable
        onPress={onCatalyticConsole}
        disabled={!catalyticConsoleEnabled}
        style={[
          styles.combatReloadBtn,
          dashboardLayout && styles.combatReloadBtnDashboard,
          {
            borderColor: catalyticConsoleEnabled ? accent : borderColor,
            opacity: catalyticConsoleEnabled ? 1 : 0.4,
          },
        ]}
      >
        <Text
          style={[
            styles.combatReloadLabel,
            dashboardLayout ? styles.combatReloadLabelDashboard : null,
            { color: catalyticConsoleEnabled ? accent : mutedColor },
          ]}
          numberOfLines={1}
        >
          {catalyticConsoleRotStacks > 0
            ? `[ CATALYST // ${catalyticConsoleRotStacks} ]`
            : '[ CATALYST ]'}
        </Text>
      </HapticPressable>
    );
  };

  const renderVoidWardButton = () => {
    if (!voidWardAvailable) return null;
    const primed = voidWardPrimed;
    const enabled = voidWardEnabled && !primed;
    return (
      <HapticPressable
        onPress={onVoidWardPrime}
        disabled={!enabled}
        style={[
          styles.combatReloadBtn,
          dashboardLayout && styles.combatReloadBtnDashboard,
          {
            borderColor: primed ? '#7dd3fc' : enabled ? '#38bdf8' : borderColor,
            opacity: primed || enabled ? 1 : 0.4,
          },
        ]}
      >
        <Text
          style={[
            styles.combatReloadLabel,
            dashboardLayout ? styles.combatReloadLabelDashboard : null,
            { color: primed ? '#bae6fd' : enabled ? '#38bdf8' : mutedColor },
          ]}
          numberOfLines={1}
        >
          {primed ? '[ WARD ]' : '[ PARRY ]'}
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

  const renderAbilityGrid = () => (
    <View style={[styles.deckBody, dashboardLayout && styles.abilitiesSection]}>
      <View style={[styles.abilityGrid, dashboardLayout && styles.abilityGridDashboard]}>
        {renderTile(loadout[0])}
        {renderTile(loadout[1])}
        {renderTile(loadout[2])}
        {renderTile(loadout[3])}
      </View>

      {selectedAbility ? (
        <View style={styles.execOverlay}>
          <View style={styles.gridRow}>
            <View style={[styles.tileSlot, { borderColor: primaryColor, height: tileHeight }]}>
              <HapticPressable
                onPress={onConfirm}
                disabled={!canExecute}
                style={[styles.deckTile, { opacity: canExecute ? 1 : 0.45 }]}
              >
                <Text style={[styles.tileLabel, { color: primaryColor }]}>[ EXECUTE ]</Text>
              </HapticPressable>
            </View>
            <View style={[styles.tileSlot, { borderColor, height: tileHeight }]}>
              <HapticPressable onPress={onAbort} style={styles.deckTile}>
                <Text style={[styles.tileLabel, { color: mutedColor }]}>[ ABORT ]</Text>
              </HapticPressable>
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.execMetaSlot}>
              <Text style={[styles.execHeader, { color: primaryColor }]} numberOfLines={1}>
                {getStagedHeader(selectedAbility)}
              </Text>
              <Text style={[styles.execCost, { color: mutedColor }]}>
                {getStagedCostImpact(selectedAbility)}
              </Text>
              {!canExecute && getActionDisableReason?.(selectedAbility) ? (
                <Text style={[styles.execDetail, { color: '#f87171' }]}>
                  {`BLOCKED: ${getActionDisableReason(selectedAbility)}`}
                </Text>
              ) : null}
              <ScrollView
                style={styles.execDetailScroll}
                contentContainerStyle={styles.execDetailScrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <Text style={[styles.execDetail, { color: mutedColor }]}>
                  {getStagedAbilityDescription(selectedAbility)}
                </Text>
              </ScrollView>
            </View>
          </View>
        </View>
      ) : null}
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
              textShadowColor: INITIATIVE_GLOW,
            },
          ]}
          pointerEvents="none"
        >
          INITIATIVE SEIZED
        </Animated.Text>
      ) : null}

      <View style={[styles.deckShellWrap, dashboardLayout && styles.deckShellWrapDashboard]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.surgeRing,
            {
              opacity: surgeOpacity,
              transform: [{ scale: surgeScale }],
              borderColor: INITIATIVE_GLOW_PALE,
              shadowColor: INITIATIVE_GLOW,
            },
          ]}
        />

        <View style={[deckShellStyle, dashboardLayout && styles.commandDeckDashboard]}>
          {dashboardLayout ? (
            <>
              <View style={styles.topBand}>
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
                  {renderEndTurnButton()}
                </View>
              </View>
              {renderSecondaryActions()}
              {renderAbilityGrid()}
            </>
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
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: 2,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
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
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
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
  bloodForTimeBtn: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 108,
    alignItems: 'center',
  },
  combatReloadBtn: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 88,
    alignItems: 'center',
  },
  combatReloadBtnDashboard: {
    maxWidth: 68,
    paddingHorizontal: 3,
    flexShrink: 0,
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
  },
  endTurnBtnDashboard: {
    minWidth: 80,
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  endTurnPressable: {
    width: '100%',
    alignItems: 'center',
  },
  endTurnLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
  deckBody: {
    position: 'relative',
    width: '100%',
  },
  abilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    rowGap: GRID_GAP,
  },
  abilityGridDashboard: {
    alignContent: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GRID_GAP,
    width: '100%',
    height: TILE_HEIGHT,
  },
  tileSlot: {
    width: '48%',
    borderWidth: 1,
  },
  deckTile: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tileLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  tileLabelDashboard: {
    fontSize: 6,
    letterSpacing: 0.25,
  },
  execOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 16, 0.92)',
    gap: GRID_GAP,
    paddingTop: 0,
  },
  execMetaSlot: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
    gap: 2,
  },
  execHeader: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.4,
    flexShrink: 0,
  },
  execCost: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.2,
    lineHeight: 9,
    flexShrink: 0,
  },
  execDetailScroll: {
    flex: 1,
    minHeight: 0,
  },
  execDetailScrollContent: {
    paddingBottom: 4,
  },
  execDetail: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.2,
    lineHeight: 9,
  },
});
