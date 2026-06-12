export type UnidentifiedTemplateId = 'item_casket_tier1' | 'item_core_tier1';

export type UnidentifiedItemState = 'LOCKED_CONTAINER' | 'DECRYPTING' | 'REVEALED';

export interface UnidentifiedStashItem {
  instanceId: string;
  templateId: UnidentifiedTemplateId;
  state: UnidentifiedItemState;
}

export const UNIDENTIFIED_TEMPLATE_LABELS: Record<UnidentifiedTemplateId, string> = {
  item_casket_tier1: 'Sealed Containment Casket [UNIDENTIFIED]',
  item_core_tier1: 'Anomalous Core [UNIDENTIFIED]',
};

export const DECRYPTION_COST: Record<UnidentifiedTemplateId, ReadonlyArray<{ resourceId: import('./resourceItem').ResourceItemId; quantity: number }>> = {
  item_casket_tier1: [{ resourceId: 'echo-glass-shard', quantity: 10 }],
  item_core_tier1: [{ resourceId: 'echo-glass-shard', quantity: 10 }],
};
