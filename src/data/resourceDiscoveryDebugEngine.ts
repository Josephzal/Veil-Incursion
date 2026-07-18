import { ECONOMY_V1_RESOURCE_IDS } from './economyRosterV1';
import { RESOURCE_REGISTRY, getResourceDisplayName } from './resourceRegistry';
import {
  buildResourceDiscoveryCard,
  countDiscoveredResources,
  createEmptyResourceDiscoveryState,
  foggedResourceTitle,
  listDiscoveredResourceIds,
  markResourcesDiscovered,
  seedDiscoveryFromStash,
} from './resourceDiscoveryEngine';
import type { ResourceDiscoveryState } from '../types/resourceDiscovery';
import type { ResourceQuantity } from '../types/resourceItem';
import { createEmptyResourceStash } from './resourceStashEngine';

/** Phase 2I — discovery / light-codex debug report. */
export function formatResourceDiscoveryReport(
  state?: ResourceDiscoveryState,
  stash?: ResourceQuantity,
): string {
  const discovery = state
    ?? seedDiscoveryFromStash(stash ?? createEmptyResourceStash(), createEmptyResourceDiscoveryState());
  const discovered = countDiscoveredResources(discovery);
  const lines: string[] = [
    '=== ECONOMY SPINE // PHASE 2I — RESOURCE DISCOVERY ===',
    '',
    `Discovered: ${discovered} / ${ECONOMY_V1_RESOURCE_IDS.length}`,
    '',
    '-- SAMPLE CARDS --',
  ];

  const samples = [
    'rail-capacitor',
    'cinder-wire',
    'breach-thread',
    'anomalous-core',
    'nullcrete-shard',
  ] as const;

  // Undiscovered sample
  const empty = createEmptyResourceDiscoveryState();
  samples.forEach((id) => {
    const fog = buildResourceDiscoveryCard(id, empty, { sectorKnown: id === 'cinder-wire' });
    lines.push(`[${fog.tier}] ${fog.title}`);
    fog.lines.forEach((line) => lines.push(`  ${line}`));
    lines.push('');
  });

  lines.push('-- DISCOVERED SAMPLE (seeded) --');
  const seeded = markResourcesDiscovered(empty, ['rail-capacitor', 'nullcrete-shard'] as const).state;
  (['rail-capacitor', 'nullcrete-shard'] as const).forEach((id) => {
    const card = buildResourceDiscoveryCard(id, seeded);
    lines.push(`[${card.tier}] ${card.title}`);
    card.lines.forEach((line) => lines.push(`  ${line}`));
    lines.push('');
  });

  if (state) {
    lines.push('-- ACCOUNT DISCOVERED --');
    listDiscoveredResourceIds(state).slice(0, 12).forEach((id) => {
      lines.push(`  ${getResourceDisplayName(id, true)}`);
    });
    lines.push('');
  }

  // Acceptance checks
  const fogTitle = foggedResourceTitle('rail-capacitor');
  const issues: string[] = [];
  if (!fogTitle.includes('UNKNOWN')) {
    issues.push('Rail Capacitor fog title must be UNKNOWN*');
  }
  const before = buildResourceDiscoveryCard('rail-capacitor', empty);
  const after = buildResourceDiscoveryCard(
    'rail-capacitor',
    markResourcesDiscovered(empty, ['rail-capacitor']).state,
  );
  if (before.discovered || before.title === after.title) {
    issues.push('Discovery must change fogged title → true name');
  }
  if (!after.discovered || after.title !== getResourceDisplayName('rail-capacitor', true)) {
    issues.push('Discovered Rail Capacitor must show true name');
  }
  if (!RESOURCE_REGISTRY['rail-capacitor']) {
    issues.push('Missing rail-capacitor registry');
  }

  lines.push('-- ACCEPTANCE --');
  lines.push(
    issues.length === 0
      ? 'PASS — discovery fog → true name; best source + uses earned.'
      : `FAIL — ${issues.join('; ')}`,
  );
  lines.push('Rule: ledger identity is earned by extraction, not given.');

  return lines.join('\n');
}

export function formatDiscoveryClearLog(): string {
  return '>> DEBUG DISCOVERY — cleared resource discovery state.';
}

export function formatDiscoveryGrantLog(count: number): string {
  return `>> DEBUG DISCOVERY — marked ${count} economy resources discovered.`;
}

export function debugClearResourceDiscovery(): ResourceDiscoveryState {
  return createEmptyResourceDiscoveryState();
}

export function debugDiscoverAllEconomyResources(): ResourceDiscoveryState {
  return markResourcesDiscovered(
    createEmptyResourceDiscoveryState(),
    ECONOMY_V1_RESOURCE_IDS,
  ).state;
}
