import type { TerminalView } from '../types/terminalNav';

export interface TerminalNavItem {
  key: TerminalView;
  label: string;
  shortLabel: string;
}

export const TERMINAL_NAV_ITEMS: TerminalNavItem[] = [
  { key: 'DEPLOYMENT', label: 'DEPLOYMENT', shortLabel: 'DEPLOY' },
  { key: 'MAP', label: 'SHADOW WAR', shortLabel: 'WAR' },
  { key: 'SAFEHOUSE', label: 'SAFEHOUSE', shortLabel: 'HOUSE' },
];

const DEV_NAV_ITEM: TerminalNavItem = {
  key: 'TEST',
  label: 'TEST',
  shortLabel: 'TEST',
};

/** Hub nav items — TEST tab included in dev builds only. */
export function resolveTerminalNavItems(): TerminalNavItem[] {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return [...TERMINAL_NAV_ITEMS, DEV_NAV_ITEM];
  }
  return TERMINAL_NAV_ITEMS;
}
