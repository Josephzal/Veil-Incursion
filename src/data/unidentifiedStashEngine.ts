import type { UnidentifiedStashItem, UnidentifiedTemplateId } from '../types/unidentifiedItem';

let unidentifiedCounter = 0;

export function createUnidentifiedInstanceId(prefix = 'locked'): string {
  unidentifiedCounter += 1;
  return `${prefix}-${Date.now()}-${unidentifiedCounter}`;
}

export function createLockedContainer(
  templateId: UnidentifiedTemplateId,
): UnidentifiedStashItem {
  return {
    instanceId: createUnidentifiedInstanceId(templateId),
    templateId,
    state: 'LOCKED_CONTAINER',
  };
}

export function gatekeeperLockedTemplate(resourceId: string): UnidentifiedTemplateId {
  if (resourceId === 'anomalous-core') return 'item_core_tier1';
  return 'item_casket_tier1';
}
