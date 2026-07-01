import React, { useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import HapticPressable from './HapticPressable';
import HubCargoIconBox from './safehouse/HubCargoIconBox';
import {
  getRecipesByKind,
  isRecipeOutputOwned,
  PERMANENT_AUGMENTS,
  type CraftingRecipe,
} from '../data/craftingRegistry';
import { canAffordRecipe, getStashCount } from '../data/resourceStashEngine';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from '../data/resourceRegistry';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useHubTypography } from '../hooks/useHubTypography';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { viewShadow } from '../utils/adaptiveStyles';
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';
import {
  HIDDEN_SCROLLBAR_VIEW_STYLE,
  HIDDEN_SCROLLVIEW_PROPS,
} from '../utils/hiddenScrollbarStyle';
import type { ResourceItemId } from '../types/resourceItem';
import type { ResourceQuantity } from '../types/resourceItem';

const STARK_WHITE = '#F8FAFC';
const MUTED_SLATE = '#94A3B8';
const ACCENT_CYAN = '#06B6D4';
const PHOSPHOR_GREEN = '#4ADE80';
const RUST_RED = '#EF4444';
const LEDGER_BG = 'rgba(9, 9, 11, 0.9)';
const LEDGER_BORDER = '#1e293b';
const CARD_BG = 'rgba(15, 23, 42, 0.6)';
const CARD_BORDER = '#1e293b';
const CHIP_BG = 'rgba(9, 9, 11, 0.85)';
const CHIP_BORDER = '#334155';

interface CraftingMenuPanelProps {
  onClose?: () => void;
  embedded?: boolean;
}

interface ResourceTileProps {
  resourceId: ResourceItemId;
  quantity: number;
  borderColor: string;
  iconSize: number;
  fontScale: number;
}

function ResourceTile({
  resourceId,
  quantity,
  borderColor,
  iconSize,
  fontScale,
}: ResourceTileProps): React.JSX.Element {
  const def = RESOURCE_REGISTRY[resourceId];

  return (
    <View
      style={[
        styles.resourceTile,
        {
          paddingVertical: 8 * fontScale,
          gap: 6 * fontScale,
        },
      ]}
    >
      <HubCargoIconBox
        itemId={resourceId}
        borderColor={borderColor}
        iconSize={iconSize}
        variant="tile"
      />
      <Text
        style={[
          styles.resourceQty,
          {
            color: STARK_WHITE,
            fontSize: 13 * fontScale,
            lineHeight: 13 * fontScale * 1.2,
          },
        ]}
      >
        {quantity}
      </Text>
      <Text
        style={[
          styles.resourceName,
          {
            color: MUTED_SLATE,
            fontSize: 8 * fontScale,
            lineHeight: 8 * fontScale * 1.35,
          },
        ]}
        numberOfLines={2}
      >
        {def.name.toUpperCase()}
      </Text>
    </View>
  );
}

interface ResourceLedgerProps {
  stash: ResourceQuantity;
  fontScale: number;
  borderColor: string;
  iconSize: number;
}

function ResourceLedger({
  stash,
  fontScale,
  borderColor,
  iconSize,
}: ResourceLedgerProps): React.JSX.Element {
  const ownedResources = useMemo(
    () => ALL_RESOURCE_ITEM_IDS.filter((resourceId) => getStashCount(stash, resourceId) > 0),
    [stash],
  );

  return (
    <View
      style={[
        styles.ledgerPanel,
        {
          padding: 24 * fontScale,
        },
      ]}
    >
      <Text
        style={[
          styles.panelEyebrow,
          {
            color: MUTED_SLATE,
            fontSize: 8 * fontScale,
            lineHeight: 8 * fontScale * 1.4,
            marginBottom: 12 * fontScale,
          },
        ]}
      >
        RESOURCE LEDGER
      </Text>
      <ScrollView
        style={[
          styles.ledgerScroll,
          Platform.OS === 'web' && styles.ledgerScrollWeb,
          HIDDEN_SCROLLBAR_VIEW_STYLE,
        ]}
        contentContainerStyle={styles.ledgerGrid}
        {...HIDDEN_SCROLLVIEW_PROPS}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {ownedResources.length === 0 ? (
          <Text
            style={[
              styles.emptyLedger,
              {
                color: MUTED_SLATE,
                fontSize: 9 * fontScale,
                lineHeight: 9 * fontScale * 1.45,
              },
            ]}
          >
            // NO RESOURCES IN STASH
          </Text>
        ) : (
          ownedResources.map((resourceId) => (
            <View key={resourceId} style={styles.ledgerGridCell}>
              <ResourceTile
                resourceId={resourceId}
                quantity={getStashCount(stash, resourceId)}
                borderColor={borderColor}
                iconSize={iconSize}
                fontScale={fontScale}
              />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

interface RequirementChipProps {
  resourceId: ResourceItemId;
  requiredCount: number;
  ownedCount: number;
  fontScale: number;
}

function RequirementChip({
  resourceId,
  requiredCount,
  ownedCount,
  fontScale,
}: RequirementChipProps): React.JSX.Element {
  const satisfied = ownedCount >= requiredCount;
  const name = RESOURCE_REGISTRY[resourceId].name.toUpperCase();

  return (
    <View
      style={[
        styles.requirementChip,
        {
          paddingHorizontal: 10 * fontScale,
          paddingVertical: 6 * fontScale,
          borderColor: satisfied ? 'rgba(74, 222, 128, 0.35)' : 'rgba(239, 68, 68, 0.35)',
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          {
            color: satisfied ? PHOSPHOR_GREEN : RUST_RED,
            fontSize: 8 * fontScale,
            lineHeight: 8 * fontScale * 1.4,
          },
        ]}
        numberOfLines={1}
      >
        {`${name} ${ownedCount}/${requiredCount}`}
      </Text>
    </View>
  );
}

interface AugmentFabricationCardProps {
  recipe: CraftingRecipe;
  stash: ResourceQuantity;
  alreadyOwned: boolean;
  onFabricate: (recipeId: string) => void;
  fontScale: number;
}

function AugmentFabricationCard({
  recipe,
  stash,
  alreadyOwned,
  onFabricate,
  fontScale,
}: AugmentFabricationCardProps): React.JSX.Element {
  const affordable = canAffordRecipe(stash, recipe);
  const canFabricate = affordable && !alreadyOwned;
  const description = recipe.effectSummary ?? recipe.description ?? '';

  return (
    <View
      style={[
        styles.augmentCard,
        viewShadow({
          color: '#000000',
          opacity: 0.45,
          radius: 12,
          offset: { width: 0, height: 4 },
        }),
        {
          padding: 24 * fontScale,
          gap: 12 * fontScale,
        },
      ]}
    >
      <View style={{ gap: 6 * fontScale }}>
        <Text
          style={[
            styles.augmentTitle,
            {
              color: STARK_WHITE,
              fontSize: 13 * fontScale,
              lineHeight: 13 * fontScale * 1.25,
            },
          ]}
        >
          {recipe.label.toUpperCase()}
        </Text>
        {description ? (
          <Text
            style={[
              styles.augmentDescription,
              {
                color: MUTED_SLATE,
                fontSize: 9 * fontScale,
                lineHeight: 9 * fontScale * 1.5,
              },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.chipRow, { gap: 6 * fontScale }]}>
          {recipe.requirements.map((req) => (
            <RequirementChip
              key={`${recipe.id}-${req.resourceId}`}
              resourceId={req.resourceId}
              requiredCount={req.quantity}
              ownedCount={getStashCount(stash, req.resourceId)}
              fontScale={fontScale}
            />
          ))}
        </View>

        <HapticPressable
          disabled={!canFabricate}
          onPress={() => onFabricate(recipe.id)}
          style={(state) => [
            styles.fabricateBtn,
            {
              borderColor: canFabricate ? ACCENT_CYAN : CHIP_BORDER,
              opacity: alreadyOwned ? 0.25 : canFabricate ? (state.pressed ? 0.85 : 1) : 0.1,
              paddingHorizontal: 14 * fontScale,
              paddingVertical: 10 * fontScale,
              minWidth: 108 * fontScale,
            },
            terminalHoverStyle(readPressableHover(state), state.pressed),
          ]}
        >
          <Text
            style={[
              styles.fabricateBtnText,
              {
                color: canFabricate ? STARK_WHITE : MUTED_SLATE,
                fontSize: 9 * fontScale,
                lineHeight: 9 * fontScale * 1.3,
              },
            ]}
          >
            {alreadyOwned ? '[ FORGED ]' : '[ FABRICATE ]'}
          </Text>
        </HapticPressable>
      </View>
    </View>
  );
}

interface FabricationMatrixProps {
  recipes: readonly CraftingRecipe[];
  stash: ResourceQuantity;
  onFabricate: (recipeId: string) => void;
  fontScale: number;
  sectionLabel?: string;
  isOwned: (recipe: CraftingRecipe) => boolean;
}

function FabricationMatrix({
  recipes,
  stash,
  onFabricate,
  fontScale,
  sectionLabel,
  isOwned,
}: FabricationMatrixProps): React.JSX.Element {
  return (
    <View style={{ gap: 16 * fontScale }}>
      {sectionLabel ? (
        <Text
          style={[
            styles.panelEyebrow,
            {
              color: MUTED_SLATE,
              fontSize: 8 * fontScale,
              lineHeight: 8 * fontScale * 1.4,
            },
          ]}
        >
          {sectionLabel}
        </Text>
      ) : null}
      {recipes.map((recipe) => (
        <AugmentFabricationCard
          key={recipe.id}
          recipe={recipe}
          stash={stash}
          alreadyOwned={isOwned(recipe)}
          onFabricate={onFabricate}
          fontScale={fontScale}
        />
      ))}
    </View>
  );
}

export default function CraftingMenuPanel({
  onClose,
  embedded = false,
}: CraftingMenuPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, craftRecipe, appendHubLog } = usePlayerAccount();
  const { isDesktop, fontScale } = useResponsiveLayout();
  const { iconSize } = useHubTypography();

  const secondaryRecipes = useMemo(
    () => ({
      LOADOUT: getRecipesByKind('LOADOUT'),
      CONSUMABLE: getRecipesByKind('CONSUMABLE'),
    }),
    [],
  );

  const handleFabricate = (recipeId: string) => {
    const result = craftRecipe(recipeId);
    appendHubLog(result.logLine);
  };

  const isOutputOwned = (recipe: CraftingRecipe) => isRecipeOutputOwned(
    recipe.outputId,
    account.unlockedBlueprints,
    account.craftedAugments,
  );

  const matrixContent = (
    <View
      style={[
        styles.matrixPanel,
        {
          padding: 32 * fontScale,
          gap: 24 * fontScale,
        },
      ]}
    >
      <Text
        style={[
          styles.matrixTitle,
          {
            color: STARK_WHITE,
            fontSize: 11 * fontScale,
            lineHeight: 11 * fontScale * 1.35,
          },
        ]}
      >
        FABRICATION MATRIX
      </Text>

      <ScrollView
        style={[styles.matrixScroll, HIDDEN_SCROLLBAR_VIEW_STYLE]}
        contentContainerStyle={{ gap: 24 * fontScale, paddingBottom: 16 * fontScale }}
        {...HIDDEN_SCROLLVIEW_PROPS}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <FabricationMatrix
          recipes={PERMANENT_AUGMENTS}
          stash={account.resourceStash}
          onFabricate={handleFabricate}
          fontScale={fontScale}
          isOwned={isOutputOwned}
        />

        {secondaryRecipes.LOADOUT.length > 0 ? (
          <FabricationMatrix
            recipes={secondaryRecipes.LOADOUT}
            stash={account.resourceStash}
            onFabricate={handleFabricate}
            fontScale={fontScale}
            sectionLabel="LOADOUT SCHEMATICS"
            isOwned={isOutputOwned}
          />
        ) : null}

        {secondaryRecipes.CONSUMABLE.length > 0 ? (
          <FabricationMatrix
            recipes={secondaryRecipes.CONSUMABLE}
            stash={account.resourceStash}
            onFabricate={handleFabricate}
            fontScale={fontScale}
            sectionLabel="TACTICAL CONSUMABLES"
            isOwned={() => false}
          />
        ) : null}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.root, embedded ? styles.rootEmbedded : null]}>
      {!embedded ? (
        <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
          <Text style={[styles.headerTitle, { color: STARK_WHITE, fontSize: 10 * fontScale }]}>
            FABRICATION MATRIX // METRO HUB
          </Text>
          {onClose ? (
            <HapticPressable
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: ACCENT_CYAN }]}
            >
              <Text style={[styles.closeBtnText, { color: ACCENT_CYAN, fontSize: 8 * fontScale }]}>
                [ CLOSE ]
              </Text>
            </HapticPressable>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.dashboard,
          { flexDirection: isDesktop ? 'row' : 'column' },
        ]}
      >
        <View
          style={[
            styles.ledgerColumn,
            isDesktop ? styles.ledgerColumnDesktop : styles.ledgerColumnMobile,
          ]}
        >
          <ResourceLedger
            stash={account.resourceStash}
            fontScale={fontScale}
            borderColor={theme.borderColor}
            iconSize={iconSize}
          />
        </View>

        <View style={[styles.matrixColumn, isDesktop ? styles.matrixColumnDesktop : null]}>
          {matrixContent}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#050608',
  },
  rootEmbedded: {
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
    flex: 1,
  },
  closeBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeBtnText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  dashboard: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  ledgerColumn: {
    minHeight: 0,
  },
  ledgerColumnMobile: {
    maxHeight: 300,
    flexShrink: 0,
  },
  ledgerColumnDesktop: {
    flex: 0.35,
    borderRightWidth: 1,
    borderRightColor: LEDGER_BORDER,
  },
  matrixColumn: {
    flex: 1,
    minHeight: 0,
  },
  matrixColumnDesktop: {
    flex: 0.65,
  },
  ledgerPanel: {
    flex: 1,
    minHeight: 0,
    backgroundColor: LEDGER_BG,
  },
  panelEyebrow: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  ledgerScroll: {
    flex: 1,
    minHeight: 0,
  },
  ledgerScrollWeb: Platform.select({
    web: { height: 0, overflow: 'auto' as const },
    default: {},
  }),
  ledgerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    width: '100%',
  },
  ledgerGridCell: {
    width: '50%',
    maxWidth: '50%',
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  resourceTile: {
    alignItems: 'center',
    width: '100%',
  },
  emptyLedger: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.5,
    width: '100%',
    textAlign: 'center',
    paddingVertical: 12,
  },
  resourceQty: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  resourceName: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.35,
    textAlign: 'center',
    width: '100%',
  },
  matrixPanel: {
    flex: 1,
    minHeight: 0,
  },
  matrixTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1.2,
    flexShrink: 0,
  },
  matrixScroll: {
    flex: 1,
    minHeight: 0,
  },
  augmentCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  augmentTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  augmentDescription: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.35,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  chipRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minWidth: 0,
  },
  requirementChip: {
    backgroundColor: CHIP_BG,
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    borderRadius: 2,
  },
  chipText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  fabricateBtn: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  fabricateBtnText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});
