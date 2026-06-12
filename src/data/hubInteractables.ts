export interface HubInteractable {
  id: string;
  label: string;
  prompt: string;
  x: number;
  y: number;
  radius: number;
}

export const HUB_CRAFTING_BENCH: HubInteractable = {
  id: 'crafting-bench',
  label: 'FABRICATION BENCH',
  prompt: '[ ENTER CRAFTING BENCH ]',
  x: 180,
  y: 220,
  radius: 42,
};

export const HUB_INTERACTABLES: HubInteractable[] = [HUB_CRAFTING_BENCH];
