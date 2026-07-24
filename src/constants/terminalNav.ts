import type { TerminalView } from '../types/terminalNav';

export interface TerminalNavItem {
  key: TerminalView;
  label: string;
  shortLabel: string;
  /** Secondary meta line under the primary label (concept theater rail). */
  subtitle: string;
}

export const TERMINAL_NAV_ITEMS: TerminalNavItem[] = [
  { key: 'MAP', label: 'VEIL FRONT', shortLabel: 'FRONT', subtitle: 'SECTOR CONTROL' },
  { key: 'CONTRACTS', label: 'CONTRACT BOARD', shortLabel: 'JOBS', subtitle: 'OFFERS' },
  { key: 'BLACK_MARKET', label: 'BLACK MARKET', shortLabel: 'MARKET', subtitle: 'INVENTORY' },
  { key: 'LOADOUT', label: 'LOADOUT', shortLabel: 'LOAD', subtitle: 'RUNNER READY' },
];

const DEV_NAV_ITEM: TerminalNavItem = {
  key: 'TEST',
  label: 'DEBUG',
  shortLabel: 'DEBUG',
  subtitle: 'SANDBOX',
};

/**
 * Debug / sandbox hub tab (formerly ARCHIVE placeholder).
 * Still gated to __DEV__ so production builds omit it.
 */
const SHOW_DEV_TEST_NAV = true;

/** Hub nav items. Debug sandbox tab is gated behind SHOW_DEV_TEST_NAV + __DEV__. */
export function resolveTerminalNavItems(): TerminalNavItem[] {
  if (
    SHOW_DEV_TEST_NAV
    && typeof __DEV__ !== 'undefined'
    && __DEV__
  ) {
    return [...TERMINAL_NAV_ITEMS, DEV_NAV_ITEM];
  }
  return TERMINAL_NAV_ITEMS;
}
