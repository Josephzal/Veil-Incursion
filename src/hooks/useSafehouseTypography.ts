import { useHubTypography } from './useHubTypography';

/** @deprecated Prefer useHubTypography() — shim for Safehouse migration. */
export function useSafehouseTypography() {
  return useHubTypography();
}
