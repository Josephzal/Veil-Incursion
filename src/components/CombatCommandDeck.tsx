import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AegisAbilityId } from '../types/aegisCombat';
import { PLAYER_ACTION_POINTS_PER_TURN } from '../types/aegisCombat';

const MONO = 'monospace';
const TILE_HEIGHT = 42;
const GRID_GAP = 6;
const AP_ROW_HEIGHT = 22;
const GRID_BODY_HEIGHT = TILE_HEIGHT * 2 + GRID_GAP;
const INITIATIVE_FLOAT_MS = 800;
const INITIATIVE_SURGE_MS = 300;
const INITIATIVE_GLOW = '#a78bfa';
const INITIATIVE_GLOW_PALE = '#bae6fd';

export const COMMAND_DECK_MIN_HEIGHT = AP_ROW_HEIGHT + GRID_GAP + GRID_BODY_HEIGHT + 14;
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
  canEndTurn: boolean;
  getAbilityLabel: (ability: string) => string;
  initiativeQueued?: boolean;
  initiativeProcSeq?: number;
  onInitiativeProcComplete?: () => void;
  getStagedHeader: (ability: string) => string;
  getStagedCostImpact: (ability: string) => string;
  getActionAccent?: (ability: string) => string | undefined;
  bloodForTimeAvailable?: boolean;
  bloodForTimeEnabled?: boolean;
  onBloodForTime?: () => void;
  combatReloadAvailable?: boolean;
  combatReloadEnabled?: boolean;
  onCombatReload?: () => void;
  borderColor: string;
  primaryColor: string;
  mutedColor: string;
  frameless?: boolean;
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
  canEndTurn,
  getAbilityLabel,
  initiativeQueued = false,
  initiativeProcSeq = 0,
  onInitiativeProcComplete,
  getStagedHeader,
  getStagedCostImpact,
  getActionAccent,
  bloodForTimeAvailable = false,
  bloodForTimeEnabled = false,
  onBloodForTime,
  combatReloadAvailable = false,
  combatReloadEnabled = false,
  onCombatReload,
  borderColor,
  primaryColor,
  mutedColor,
  frameless = false,
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
  const queuedApColor = queuePulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(167, 139, 250, 0.55)', 'rgba(186, 230, 253, 0.95)'],
  });

  const deckShellStyle = [
    styles.commandDeck,
    frameless ? styles.commandDeckFrameless : null,
    !frameless ? { borderColor } : null,
  ];

  const labelFor = (ability: string) => getAbilityLabel(ability);

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
          },
        ]}
      >
        <Pressable
          onPress={() => enabled && onSelectAbility(ability)}
          disabled={!enabled}
          style={[styles.deckTile, { opacity: enabled ? 1 : 0.4 }]}
        >
          <Text
            style={[styles.tileLabel, { color: enabled && accent ? accent : mutedColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {labelFor(ability)}
          </Text>
        </Pressable>
      </View>
    );
  };

  const canExecute = selectedAbility ? isActionEnabled(selectedAbility) : false;

  return (
    <View style={styles.deckHost}>
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

      <View style={styles.deckShellWrap}>
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

        <View style={deckShellStyle}>
          <View style={styles.apRow}>
            {initiativeQueued ? (
              <Animated.Text
                style={[styles.apLabel, styles.apLabelQueued, { color: queuedApColor }]}
                numberOfLines={1}
              >
                {`ACTION PTS // ${shownAp}/${maxActionPoints}`}
              </Animated.Text>
            ) : (
              <Text style={[styles.apLabel, { color: mutedColor }]} numberOfLines={1}>
                {`ACTION PTS // ${shownAp}/${maxActionPoints}`}
              </Text>
            )}
            <View style={styles.apActions}>
              {combatReloadAvailable ? (
                <Pressable
                  onPress={onCombatReload}
                  disabled={!combatReloadEnabled}
                  style={[
                    styles.combatReloadBtn,
                    {
                      borderColor: combatReloadEnabled ? '#fbbf24' : borderColor,
                      opacity: combatReloadEnabled ? 1 : 0.4,
                    },
                  ]}
                >
                  <Text
                    style={[styles.combatReloadLabel, { color: combatReloadEnabled ? '#fbbf24' : mutedColor }]}
                    numberOfLines={1}
                  >
                    [ COMBAT RELOAD ]
                  </Text>
                </Pressable>
              ) : null}
              {bloodForTimeAvailable ? (
                <Pressable
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
                </Pressable>
              ) : null}
              {initiativeQueued ? (
                <Animated.View
                  style={[
                    styles.endTurnBtn,
                    {
                      borderColor: queuedBorderColor,
                      opacity: canEndTurn ? 1 : 0.4,
                    },
                  ]}
                >
                  <Pressable
                    onPress={onEndTurn}
                    disabled={!canEndTurn}
                    style={styles.endTurnPressable}
                  >
                    <Text style={[styles.endTurnLabel, { color: INITIATIVE_GLOW_PALE }]}>
                      [ END TURN ]
                    </Text>
                  </Pressable>
                </Animated.View>
              ) : (
                <Pressable
                  onPress={onEndTurn}
                  disabled={!canEndTurn}
                  style={[
                    styles.endTurnBtn,
                    {
                      borderColor: canEndTurn ? primaryColor : borderColor,
                      opacity: canEndTurn ? 1 : 0.4,
                    },
                  ]}
                >
                  <Text style={[styles.endTurnLabel, { color: canEndTurn ? primaryColor : mutedColor }]}>
                    [ END TURN ]
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.deckBody}>
            <View style={styles.gridRow}>
              {renderTile(loadout[0])}
              {renderTile(loadout[1])}
            </View>
            <View style={styles.gridRow}>
              {renderTile(loadout[2])}
              {renderTile(loadout[3])}
            </View>

            {selectedAbility ? (
              <View style={styles.execOverlay}>
                <View style={styles.gridRow}>
                  <View style={[styles.tileSlot, { borderColor: primaryColor }]}>
                    <Pressable
                      onPress={onConfirm}
                      disabled={!canExecute}
                      style={[styles.deckTile, { opacity: canExecute ? 1 : 0.45 }]}
                    >
                      <Text style={[styles.tileLabel, { color: primaryColor }]}>[ EXECUTE ]</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.tileSlot, { borderColor }]}>
                    <Pressable onPress={onAbort} style={styles.deckTile}>
                      <Text style={[styles.tileLabel, { color: mutedColor }]}>[ ABORT ]</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.execMetaSlot}>
                    <Text style={[styles.execHeader, { color: primaryColor }]} numberOfLines={1}>
                      {getStagedHeader(selectedAbility)}
                    </Text>
                    <Text style={[styles.execDetail, { color: mutedColor }]} numberOfLines={2}>
                      {getStagedCostImpact(selectedAbility)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
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
  deckShellWrap: {
    width: '100%',
    position: 'relative',
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
    height: COMMAND_DECK_MIN_HEIGHT,
    minHeight: COMMAND_DECK_MIN_HEIGHT,
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 1,
    gap: GRID_GAP,
  },
  commandDeckFrameless: {
    borderTopWidth: 0,
    paddingTop: 3,
    paddingBottom: 2,
  },
  apRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: GRID_GAP,
    height: AP_ROW_HEIGHT,
    width: '100%',
  },
  apLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    flex: 1,
  },
  apLabelQueued: {
    textShadowColor: INITIATIVE_GLOW,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
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
    maxWidth: 118,
    alignItems: 'center',
  },
  combatReloadLabel: {
    fontFamily: MONO,
    fontSize: 6,
    fontWeight: 'bold',
    letterSpacing: 0.3,
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
    height: GRID_BODY_HEIGHT,
    minHeight: GRID_BODY_HEIGHT,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GRID_GAP,
    width: '100%',
    height: TILE_HEIGHT,
  },
  tileSlot: {
    flex: 1,
    height: TILE_HEIGHT,
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
  execOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 16, 0.92)',
    gap: GRID_GAP,
    paddingTop: 0,
  },
  execMetaSlot: {
    flex: 1,
    height: TILE_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  execHeader: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
  execDetail: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.2,
    lineHeight: 9,
  },
});
