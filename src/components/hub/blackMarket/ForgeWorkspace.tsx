import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import { usePlayerAccount } from '../../../context/PlayerAccountContext';
import { useHubLayout } from '../../../context/HubLayoutContext';
import { getAccountProgressionProfile } from '../../../data/progressionDebugEngine';
import {
  getRecipesByKind,
  PERMANENT_AUGMENTS,
  type CraftingRecipe,
} from '../../../data/craftingRegistry';
import {
  buildRunItemCraftingRecipes,
  filterRunItemCraftingRecipes,
  isRunItemCraftOutput,
  type RunItemCraftFilter,
} from '../../../data/runItemCraftingBridge';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from '../../../data/resourceRegistry';
import { getStashCount } from '../../../data/resourceStashEngine';
import { buildResourceDiscoveryCard } from '../../../data/resourceDiscoveryEngine';
import type { ResourceItemId } from '../../../types/resourceItem';
import {
  buildForgeSchematicPresentation,
  listVisibleForgePresentations,
  type ForgeSchematicPresentation,
} from './forgePresentation';
import {
  resolveSchematicGlyphFamily,
  SchematicGlyphMark,
} from './SchematicGlyph';

const TERMINAL = '#69c8ad';
const TERMINAL_BRIGHT = '#8ee0c6';
const MISSING = '#d88984';
const OCCULT = '#9988b3';
const META = '#7a8f99';

interface ForgeWorkspaceProps {
  selectedRecipeId: string | null;
  onSelectRecipe: (recipeId: string) => void;
  compact?: boolean;
  narrow?: boolean;
  /** Resource IDs to pulse once during fabrication material convergence. */
  pulseResourceIds?: readonly string[];
}

function stateColor(status: ForgeSchematicPresentation['status']): string {
  if (status === 'fabricable') return TERMINAL_BRIGHT;
  if (status === 'missing') return MISSING;
  if (status === 'rumored' || status === 'sealed') return OCCULT;
  return META;
}

function materialSubtitle(resourceId: ResourceItemId, discovered: boolean): string {
  if (!discovered) return 'Unidentified reagent';
  const def = RESOURCE_REGISTRY[resourceId];
  const raw = def.description?.split(/[.—]/)[0]?.trim();
  if (raw && raw.length > 4 && raw.length <= 42) return raw;
  if (raw) return `${raw.slice(0, 40).trim()}…`;
  const role = def.primaryRole.replace(/_/g, ' ').toLowerCase();
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function markerTone(resourceId: string): string {
  let hash = 0;
  for (let i = 0; i < resourceId.length; i += 1) {
    hash = (hash + resourceId.charCodeAt(i) * (i + 3)) % 360;
  }
  return `hsla(${120 + (hash % 40)}, 18%, 42%, 0.85)`;
}

function kindLabel(entry: ForgeSchematicPresentation): string {
  if (entry.visibility === 'RUMORED') return 'RUMORED SCHEMATIC';
  if (entry.recipe.kind === 'AUGMENT') return 'PERMANENT AUGMENT';
  if (isRunItemCraftOutput(entry.recipe.outputId)) return 'RUN ITEM SCHEMATIC';
  return 'TACTICAL CONSUMABLE';
}

export default function ForgeWorkspace({
  selectedRecipeId,
  onSelectRecipe,
  compact = false,
  narrow = false,
  pulseResourceIds = [],
}: ForgeWorkspaceProps): React.JSX.Element {
  const { account } = usePlayerAccount();
  const { scaleSpacing } = useHubLayout();
  const [runItemFilter, setRunItemFilter] = useState<RunItemCraftFilter>('ALL');
  const materialPulse = useRef(new Animated.Value(1)).current;

  const profile = useMemo(() => getAccountProgressionProfile(account), [account]);

  const ownedResources = useMemo(
    () => ALL_RESOURCE_ITEM_IDS.filter((id) => getStashCount(account.resourceStash, id) > 0),
    [account.resourceStash],
  );

  const augmentRows = useMemo(
    () => listVisibleForgePresentations(profile, account, PERMANENT_AUGMENTS),
    [profile, account],
  );

  const runItemRecipes = useMemo(
    () => filterRunItemCraftingRecipes(buildRunItemCraftingRecipes(), runItemFilter),
    [runItemFilter],
  );
  const runItemRows = useMemo(
    () => listVisibleForgePresentations(profile, account, runItemRecipes),
    [profile, account, runItemRecipes],
  );

  const consumableRecipes = useMemo(
    () => getRecipesByKind('CONSUMABLE').filter((recipe) => !isRunItemCraftOutput(recipe.outputId)),
    [],
  );
  const consumableRows = useMemo(
    () => listVisibleForgePresentations(profile, account, consumableRecipes),
    [profile, account, consumableRecipes],
  );

  const allRows = useMemo(
    () => [...augmentRows, ...runItemRows, ...consumableRows],
    [augmentRows, runItemRows, consumableRows],
  );

  const selectedEntry = useMemo(
    () => (selectedRecipeId
      ? allRows.find((row) => row.recipe.id === selectedRecipeId) ?? null
      : null),
    [allRows, selectedRecipeId],
  );

  const requiredIds = useMemo(() => {
    if (!selectedEntry || selectedEntry.visibility === 'RUMORED') return null;
    return new Set(selectedEntry.requirements.map((req) => req.resourceId));
  }, [selectedEntry]);

  useEffect(() => {
    if (!selectedRecipeId || !requiredIds?.size) {
      materialPulse.setValue(1);
      return;
    }
    materialPulse.setValue(0.55);
    Animated.timing(materialPulse, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [materialPulse, requiredIds, selectedRecipeId]);

  const renderSchematic = (entry: ForgeSchematicPresentation) => {
    const selected = selectedRecipeId === entry.recipe.id;
    const sealed = entry.status === 'rumored' || entry.status === 'sealed';
    const family = isRunItemCraftOutput(entry.recipe.outputId) && entry.recipe.kind !== 'AUGMENT'
      ? 'run' as const
      : resolveSchematicGlyphFamily(entry.recipe.id, entry.recipe.kind, sealed);

    return (
      <View
        key={entry.recipe.id}
        style={[styles.signal, selected && styles.signalSelected]}
        {...(Platform.OS === 'web' ? ({ 'data-selected': selected ? 'true' : 'false' } as object) : null)}
      >
        {selected ? <View style={styles.signalAccent} /> : null}
        <HapticPressable
          onPress={() => onSelectRecipe(entry.recipe.id)}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={`Inspect ${entry.recipe.label}`}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
            styles.signalSelect,
            compact && styles.signalSelectCompact,
            narrow && styles.signalSelectNarrow,
            selected && styles.signalSelectSelected,
            ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
            pressed && { opacity: 0.92 },
          ])}
        >
          <View style={styles.glyphSlot}>
            <SchematicGlyphMark family={family} size={compact ? 26 : 30} sealed={sealed} />
          </View>
          <View style={styles.signalMain}>
            <TerminalText
              size={11.5}
              letterSpacing={0.15}
              style={[
                styles.signalTitle,
                sealed && { color: '#c9c2d6' },
              ]}
              numberOfLines={1}
            >
              {entry.recipe.label.toUpperCase()}
            </TerminalText>
            <TerminalText size={8} style={styles.signalEffect} numberOfLines={1}>
              {entry.effectLine}
            </TerminalText>
            <TerminalText size={7} letterSpacing={0.2} style={styles.signalReqs} numberOfLines={1}>
              {entry.requirementsLine}
            </TerminalText>
          </View>
          <View style={styles.signalStamp}>
            <TerminalText size={6.5} letterSpacing={0.7} style={styles.signalKind} numberOfLines={1}>
              {kindLabel(entry)}
            </TerminalText>
            <TerminalText
              size={7}
              letterSpacing={0.7}
              style={[styles.signalState, { color: stateColor(entry.status) }]}
            >
              {entry.stateLabel}
            </TerminalText>
          </View>
        </HapticPressable>
      </View>
    );
  };

  return (
    <View style={[styles.catalog, narrow && styles.catalogNarrow]}>
      <View style={[styles.materials, narrow && styles.materialsNarrow]}>
        <View style={styles.catalogHeader}>
          <TerminalText size={7} letterSpacing={1.05} style={styles.catalogHeaderText}>
            MATERIAL HOLDINGS
          </TerminalText>
          <TerminalText size={7} letterSpacing={0.9} style={styles.catalogHeaderMeta}>
            {`${String(ownedResources.length).padStart(2, '0')} TYPES`}
          </TerminalText>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: scaleSpacing(10) }}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web'
            ? ({
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(105, 200, 173, 0.22) transparent',
              } as object)
            : null)}
        >
          {ownedResources.length === 0 ? (
            <TerminalText size={8} style={styles.emptyCopy}>
              No resources in stash.
            </TerminalText>
          ) : (
            ownedResources.map((resourceId, index) => {
              const quantity = getStashCount(account.resourceStash, resourceId);
              const card = buildResourceDiscoveryCard(resourceId, account.resourceDiscovery);
              const def = RESOURCE_REGISTRY[resourceId];
              const isRequired = requiredIds?.has(resourceId) ?? false;
              const dimmed = requiredIds != null && !isRequired;
              const req = selectedEntry?.requirements.find((row) => row.resourceId === resourceId);
              const missing = isRequired && req != null && !req.ready;
              const ready = isRequired && req?.ready === true;
              const converging = pulseResourceIds.includes(resourceId);

              return (
                <Animated.View
                  key={resourceId}
                  style={[
                    styles.materialRow,
                    dimmed && styles.materialDimmed,
                    ready && styles.materialRequired,
                    missing && styles.materialMissing,
                    converging && styles.materialConverging,
                    isRequired && {
                      opacity: materialPulse.interpolate({
                        inputRange: [0.55, 1],
                        outputRange: [0.72 + Math.min(index, 4) * 0.02, 1],
                      }),
                    },
                  ]}
                >
                  <View style={[styles.materialMarker, { backgroundColor: markerTone(resourceId) }]} />
                  {missing ? <View style={styles.materialNotch} /> : null}
                  <View style={styles.materialIdentity}>
                    <View style={styles.materialTop}>
                      <TerminalText
                        size={8}
                        letterSpacing={0.2}
                        style={[styles.materialName, ready && { color: '#e8f2ee' }]}
                        numberOfLines={1}
                      >
                        {(card.discovered ? card.title : def.shortName).toUpperCase()}
                      </TerminalText>
                      <TerminalText size={9.5} style={styles.materialQtyValue}>
                        {quantity}
                      </TerminalText>
                    </View>
                    <View style={styles.materialBottom}>
                      <TerminalText size={7} style={styles.materialMeta} numberOfLines={1}>
                        {materialSubtitle(resourceId, card.discovered)}
                      </TerminalText>
                      {isRequired ? (
                        <TerminalText
                          size={6.5}
                          letterSpacing={0.8}
                          style={{
                            color: missing ? MISSING : TERMINAL,
                            fontWeight: '700',
                          }}
                        >
                          {missing ? 'SHORT' : 'REQUIRED'}
                        </TerminalText>
                      ) : null}
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      </View>

      <View style={styles.feed}>
        <View style={styles.catalogHeader}>
          <TerminalText size={7} letterSpacing={1.05} style={styles.catalogHeaderText}>
            SCHEMATIC FEED
          </TerminalText>
          <TerminalText size={7} letterSpacing={0.9} style={styles.catalogHeaderMeta}>
            {`${allRows.length} ${allRows.length === 1 ? 'RECORD' : 'RECORDS'}`}
          </TerminalText>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: scaleSpacing(12) }}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web'
            ? ({
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(105, 200, 173, 0.22) transparent',
              } as object)
            : null)}
        >
          {augmentRows.length > 0 ? (
            <>
              <TerminalText size={7} letterSpacing={1.05} style={styles.sectionLabel}>
                PERMANENT AUGMENTS
              </TerminalText>
              {augmentRows.map(renderSchematic)}
            </>
          ) : null}

          {runItemRows.length > 0 ? (
            <>
              <View style={styles.filterRow}>
                {(['ALL', 'COMBAT', 'FIELD'] as const).map((filter) => (
                  <HapticPressable
                    key={filter}
                    onPress={() => setRunItemFilter(filter)}
                    style={[
                      styles.filterChip,
                      runItemFilter === filter && styles.filterChipActive,
                    ]}
                  >
                    <TerminalText
                      size={7}
                      letterSpacing={0.6}
                      style={{
                        color: runItemFilter === filter ? TERMINAL_BRIGHT : '#7f928c',
                        fontWeight: '700',
                      }}
                    >
                      {filter === 'ALL' ? 'ALL RUN ITEMS' : filter}
                    </TerminalText>
                  </HapticPressable>
                ))}
              </View>
              <TerminalText size={7} letterSpacing={1.05} style={styles.sectionLabel}>
                RUN ITEM SCHEMATICS
              </TerminalText>
              {runItemRows.map(renderSchematic)}
            </>
          ) : null}

          {consumableRows.length > 0 ? (
            <>
              <TerminalText size={7} letterSpacing={1.05} style={styles.sectionLabel}>
                TACTICAL CONSUMABLES
              </TerminalText>
              {consumableRows.map(renderSchematic)}
            </>
          ) : null}

          {allRows.length === 0 ? (
            <TerminalText size={8} style={styles.emptyCopy}>
              No schematics available in the current forge cycle.
            </TerminalText>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

/** Resolve selected forge presentation for the shared dossier. */
export function resolveForgeSelection(
  account: ReturnType<typeof usePlayerAccount>['account'],
  recipeId: string | null,
): ForgeSchematicPresentation | null {
  if (!recipeId) return null;
  const profile = getAccountProgressionProfile(account);
  const pool: CraftingRecipe[] = [
    ...PERMANENT_AUGMENTS,
    ...buildRunItemCraftingRecipes(),
    ...getRecipesByKind('CONSUMABLE'),
  ];
  const recipe = pool.find((entry) => entry.id === recipeId);
  if (!recipe) return null;
  return buildForgeSchematicPresentation(profile, account, recipe);
}

const styles = StyleSheet.create({
  catalog: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  catalogNarrow: {},
  materials: {
    width: 268,
    maxWidth: 292,
    minWidth: 236,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(137, 170, 163, 0.16)',
    backgroundColor: '#030808',
    overflow: 'hidden',
  },
  materialsNarrow: {
    width: 236,
    maxWidth: 236,
  },
  feed: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#020606',
    position: 'relative',
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    paddingHorizontal: 16,
    flexShrink: 0,
    zIndex: 1,
  },
  catalogHeaderText: {
    color: '#7f928c',
    fontWeight: '700',
  },
  catalogHeaderMeta: {
    color: META,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  emptyCopy: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    color: '#91a39f',
  },
  materialRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  materialDimmed: {
    opacity: 0.34,
  },
  materialRequired: {
    backgroundColor: 'rgba(100, 211, 175, 0.045)',
  },
  materialConverging: {
    backgroundColor: 'rgba(105, 200, 173, 0.1)',
    ...Platform.select({
      web: {
        transition: 'background-color 160ms ease-out',
      } as object,
      default: {},
    }),
  },
  materialMissing: {
    backgroundColor: 'rgba(216, 137, 132, 0.04)',
  },
  materialMarker: {
    width: 2,
    marginRight: 10,
    marginVertical: 4,
    borderRadius: 1,
  },
  materialNotch: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 2,
    backgroundColor: MISSING,
  },
  materialIdentity: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  materialTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  materialBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  materialName: {
    flex: 1,
    minWidth: 0,
    color: '#d8e2de',
    fontWeight: '700',
  },
  materialMeta: {
    flex: 1,
    minWidth: 0,
    color: META,
  },
  materialQtyValue: {
    color: '#f2f7f5',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectionLabel: {
    marginTop: 14,
    marginBottom: 2,
    paddingHorizontal: 18,
    color: '#7f928c',
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  filterChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(137, 170, 163, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  filterChipActive: {
    borderColor: 'rgba(105, 200, 173, 0.45)',
    backgroundColor: 'rgba(105, 200, 173, 0.06)',
  },
  signal: {
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  signalSelected: {
    backgroundColor: 'transparent',
  },
  signalAccent: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 0,
    width: 2,
    backgroundColor: '#75d4b3',
    zIndex: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 0 12px rgba(117, 212, 179, 0.25)',
      } as object,
      default: {},
    }),
  },
  signalSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 78,
    paddingVertical: 12,
    paddingHorizontal: 18,
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  signalSelectHover: {
    ...Platform.select({
      web: {
        backgroundImage: [
          'linear-gradient(#a7b0ac, #a7b0ac)',
          'linear-gradient(90deg, rgba(167, 176, 172, 0.1), rgba(167, 176, 172, 0.018) 72%)',
        ].join(', '),
        backgroundSize: '2px calc(100% - 20px), auto',
        backgroundPosition: 'left center, 0 0',
        backgroundRepeat: 'no-repeat, no-repeat',
      } as object,
      default: {
        backgroundColor: 'rgba(167, 176, 172, 0.08)',
        borderLeftWidth: 2,
        borderLeftColor: '#a7b0ac',
      },
    }),
  },
  signalSelectSelected: {
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, rgba(100, 211, 175, 0.09), rgba(100, 211, 175, 0.015) 72%)',
      } as object,
      default: {
        backgroundColor: 'rgba(100, 211, 175, 0.07)',
      },
    }),
  },
  signalSelectCompact: {
    minHeight: 70,
    paddingVertical: 10,
  },
  signalSelectNarrow: {
    gap: 12,
  },
  glyphSlot: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.88,
    flexShrink: 0,
  },
  signalMain: {
    flex: 1,
    minWidth: 0,
  },
  signalTitle: {
    color: '#f1f6f3',
    fontWeight: '700',
  },
  signalEffect: {
    marginTop: 4,
    color: '#a7b6b1',
    letterSpacing: 0,
    lineHeight: 16,
  },
  signalReqs: {
    marginTop: 5,
    color: '#6f8480',
    fontWeight: '600',
  },
  signalStamp: {
    width: 128,
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 5,
  },
  signalKind: {
    color: META,
    fontWeight: '700',
    textAlign: 'right',
  },
  signalState: {
    fontWeight: '700',
    textAlign: 'right',
  },
});
