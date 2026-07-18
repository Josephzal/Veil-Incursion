import type { ResourceItemId } from '../types/resourceItem';
import { createDefaultCargoRunState } from '../types/cargoGrid';
import {
  ALL_RESOURCE_ITEM_IDS,
  RESOURCE_REGISTRY,
  RESOURCES_BY_CATEGORY,
} from './resourceRegistry';
import { validateResourceRegistry } from './resourceValidation';
import {
  addLootToContainmentDetailed,
  countCargoItemInstances,
  hasOpenCargoFootprint,
} from './cargoGridEngine';
import { getCargoStackCap, previewCargoLootPickup } from './cargoStackEngine';

/** Phase 2A — dump cargo/stash stack caps and grid footprints. */
export function formatCargoStackRulesReport(): string {
  const lines: string[] = [
    '=== PHASE 2A // CARGO STACK RULES ===',
    'Stash stack = hub ownership (soft). Cargo stack = one grid footprint.',
    '',
  ];

  (['STABLE', 'INTEL', 'UNSTABLE', 'CONTRABAND'] as const).forEach((category) => {
    lines.push(`-- ${category} --`);
    RESOURCES_BY_CATEGORY[category].forEach((id) => {
      const def = RESOURCE_REGISTRY[id];
      lines.push(
        `${def.shortName.padEnd(22)} ${def.gridWidth}x${def.gridHeight}  cargoCap=${def.cargoStackCap}  stashCap=${def.stashStackCap}  canStack=${def.canStack ? 'Y' : 'N'}`,
      );
    });
    lines.push('');
  });

  lines.push(`Roster size: ${ALL_RESOURCE_ITEM_IDS.length}`);
  const issues = validateResourceRegistry().filter((issue) => (
    issue.message.includes('cargoStackCap')
    || issue.message.includes('stashStackCap')
    || issue.message.includes('maxStack')
    || issue.message.includes('UNSTABLE')
    || issue.message.includes('ROUTE_INTEL')
  ));
  lines.push(`Validation stack issues: ${issues.length}`);
  issues.slice(0, 12).forEach((issue) => {
    lines.push(`  [${issue.severity}] ${issue.resourceId ?? '?'}: ${issue.message}`);
  });

  return lines.join('\n');
}

/** Smoke-test merge behavior for a stackable common resource. */
export function formatCargoStackMergeSmokeTest(
  resourceId: ResourceItemId = 'ley-slag',
): string {
  const cap = getCargoStackCap(resourceId);
  let cargo = createDefaultCargoRunState();
  const seedQty = cap > 1 ? cap - 1 : 1;
  const addQty = 3;
  const first = addLootToContainmentDetailed(cargo, resourceId, seedQty);
  cargo = first.cargo;
  const second = addLootToContainmentDetailed(cargo, resourceId, addQty);
  cargo = second.cargo;
  const total = countCargoItemInstances(cargo, resourceId);
  const stacks = cargo.containment.filter((item) => item.itemId === resourceId).length
    + cargo.grid.placed.filter((item) => item.itemId === resourceId).length;
  const preview = previewCargoLootPickup(
    cargo,
    resourceId,
    2,
    (id) => hasOpenCargoFootprint(cargo, id),
  );
  const expectedTotal = seedQty + addQty;
  const expectedStacks = Math.ceil(expectedTotal / cap);
  const expectedMerged = cap > 1 ? Math.min(1, addQty) : 0;
  const pass = total === expectedTotal
    && stacks === expectedStacks
    && second.mergedQuantity === expectedMerged;

  return [
    '=== PHASE 2A // STACK MERGE SMOKE ===',
    `Resource: ${resourceId} (cap ${cap})`,
    `After fill ${seedQty} then +${addQty}: totalUnits=${total} stacks=${stacks} merged=${second.mergedQuantity} newStacks=${second.newStackCount}`,
    `Preview +2: mergeable=${preview.mergeableQty} newStackQty=${preview.newStackQty} gridFull=${preview.gridFullForNewStack}`,
    pass
      ? 'PASS — merge/split math matches cargoStackCap.'
      : 'FAIL — unexpected stack geometry.',
  ].join('\n');
}
