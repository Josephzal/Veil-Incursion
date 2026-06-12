import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CRAFTING_REGISTRY } from '../data/craftingRegistry';
import { canAffordRecipe, getStashCount } from '../data/resourceStashEngine';
import { RESOURCE_REGISTRY } from '../data/resourceRegistry';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import type { ResourceItemId } from '../types/resourceItem';

interface CraftingMenuPanelProps {
  onClose: () => void;
}

export default function CraftingMenuPanel({ onClose }: CraftingMenuPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, craftRecipe, appendHubLog } = usePlayerAccount();

  const recipes = useMemo(() => CRAFTING_REGISTRY, []);

  const handleCraft = (recipeId: string) => {
    const result = craftRecipe(recipeId);
    appendHubLog(result.logLine);
  };

  return (
    <View style={[styles.root, { borderColor: theme.borderColor, backgroundColor: '#050608' }]}>
      <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
        <Text style={[styles.title, { color: theme.primaryColor }]}>FABRICATION BENCH // METRO HUB</Text>
        <Pressable onPress={onClose} style={[styles.closeBtn, { borderColor: theme.statusColor }]}>
          <Text style={[styles.closeBtnText, { color: theme.statusColor }]}>[ CLOSE ]</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.stashPanel, { borderColor: theme.borderColor }]}>
          <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>RESOURCE STASH</Text>
          {Object.keys(account.resourceStash).length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.mutedColor }]}>
              No resources banked — extract salvage from incursions to craft.
            </Text>
          ) : (
            Object.entries(account.resourceStash).map(([id, count]) => (
              <Text key={id} style={[styles.stashLine, { color: theme.textColor }]}>
                {`${count}x ${RESOURCE_REGISTRY[id as ResourceItemId]?.name ?? id}`}
              </Text>
            ))
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>AVAILABLE SCHEMATICS</Text>
        {recipes.map((recipe) => {
          const affordable = canAffordRecipe(account.resourceStash, recipe);
          const alreadyUnlocked = account.unlockedBlueprints.includes(recipe.outputId);
          return (
            <View
              key={recipe.id}
              style={[styles.recipeCard, { borderColor: affordable ? theme.statusColor : theme.borderColor }]}
            >
              <Text style={[styles.recipeTitle, { color: theme.primaryColor }]}>{recipe.label.toUpperCase()}</Text>
              {recipe.description ? (
                <Text style={[styles.recipeBody, { color: theme.mutedColor }]}>{recipe.description}</Text>
              ) : null}
              <View style={styles.reqBlock}>
                {recipe.requirements.map((req) => (
                  <Text
                    key={`${recipe.id}-${req.resourceId}`}
                    style={[
                      styles.reqLine,
                      {
                        color: getStashCount(account.resourceStash, req.resourceId) >= req.quantity
                          ? theme.textColor
                          : '#ef4444',
                      },
                    ]}
                  >
                    {`${req.quantity}x ${RESOURCE_REGISTRY[req.resourceId].name} (owned: ${getStashCount(account.resourceStash, req.resourceId)})`}
                  </Text>
                ))}
              </View>
              <Pressable
                disabled={!affordable || alreadyUnlocked}
                onPress={() => handleCraft(recipe.id)}
                style={({ pressed }) => [
                  styles.craftBtn,
                  {
                    borderColor: affordable && !alreadyUnlocked ? theme.statusColor : '#1a2e22',
                    opacity: pressed ? 0.75 : affordable && !alreadyUnlocked ? 1 : 0.45,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.craftBtnText,
                    { color: affordable && !alreadyUnlocked ? theme.statusColor : '#2a4032' },
                  ]}
                >
                  {alreadyUnlocked ? '[ BLUEPRINT UNLOCKED ]' : '[ FABRICATE ]'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {account.unlockedBlueprints.length > 0 ? (
          <View style={[styles.stashPanel, { borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>UNLOCKED BLUEPRINTS</Text>
            {account.unlockedBlueprints.map((blueprintId) => (
              <Text key={blueprintId} style={[styles.stashLine, { color: theme.statusColor }]}>
                {blueprintId.replace(/_/g, ' ').toUpperCase()}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderWidth: 1,
    minHeight: 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  closeBtn: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeBtnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  stashPanel: {
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  stashLine: {
    fontFamily: 'monospace',
    fontSize: 8,
  },
  emptyText: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
  },
  recipeCard: {
    borderWidth: 1,
    padding: 10,
    gap: 6,
    backgroundColor: '#0a0b0f',
  },
  recipeTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  recipeBody: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
  },
  reqBlock: {
    gap: 2,
  },
  reqLine: {
    fontFamily: 'monospace',
    fontSize: 7,
  },
  craftBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  craftBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
