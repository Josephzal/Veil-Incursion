import type { RunItemDefinition, RunItemUsableContext } from '../types/runItem';

export type RunItemActiveContext =
  | RunItemUsableContext
  | 'HUB'
  | 'UNKNOWN';

export function isRunItemUsableInContext(
  def: RunItemDefinition,
  context: RunItemActiveContext,
): boolean {
  if (context === 'HUB' || context === 'UNKNOWN') return false;
  return def.usableContexts.includes(context);
}

export function canUseRunItemOfferNow(
  def: RunItemDefinition,
  context: RunItemActiveContext,
): boolean {
  if (def.slotType === 'COMBAT') {
    return context === 'COMBAT';
  }
  return isRunItemUsableInContext(def, context);
}

export function formatRunItemSlotLabel(slotType: 'COMBAT' | 'FIELD', slotIndex: number): string {
  const bucket = slotType === 'COMBAT' ? 'COMBAT' : 'FIELD';
  return `${bucket} ${slotIndex + 1}`;
}
