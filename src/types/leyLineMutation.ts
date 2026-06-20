export type LeyLineMutationTier = 'KINETIC' | 'OCCULT' | 'SYSTEM' | 'SYNAPTIC' | 'AP_BOOST';

export type LeyLineMutationId =
  | 'SHARPENED'
  | 'VENOMOUS_RUIN'
  | 'SPIKED_WARD'
  | 'RELENTLESS_MOMENTUM'
  | 'HEAVY_CALIBER'
  | 'JUGGERNAUT_PLATING'
  | 'SHATTER_POINT'
  | 'ADRENALINE_SPIKE'
  | 'ABYSSAL_RESONANCE'
  | 'EXECUTIONERS_GRIP'
  | 'BLACK_LIGHT_SIPHON'
  | 'VOID_CONTAGION'
  | 'EVENT_HORIZON'
  | 'ABYSSAL_OVERFLOW'
  | 'REACTIVE_WARDS'
  | 'PHANTOM_STRIKES'
  | 'CORRUPTED_BLOOD'
  | 'UMBRAL_CARAPACE'
  | 'NULL_ZONE'
  | 'ECHOING_VOID'
  | 'DEEP_LUNGS'
  | 'BLOOD_PRICE'
  | 'SECOND_WIND'
  | 'LEY_LINE_TAP'
  | 'HYPER_METABOLISM'
  | 'UNSTOPPABLE_FORCE'
  | 'GRID_GHOST'
  | 'MASOCISTS_JOY'
  | 'PERFECTED_FORM'
  | 'FINAL_STAND'
  | 'EXECUTIONERS_HIGH'
  | 'FLAWLESS_CONDUIT'
  | 'BLOOD_FOR_TIME'
  | 'MOMENTUM_SHIFT'
  | 'MOMENTUM_TRANSFER'
  | 'ABYSSAL_ERUPTION'
  | 'EXECUTIONERS_STRIDE'
  | 'SPALL_SHATTER'
  | 'VOID_RESONANCE'
  | 'TAR_TRAPPED'
  | 'SLIPSTREAM'
  | 'NECROTIC_ATROPHY'
  | 'SUNDER_WEAVE'
  | 'VOIDS_TOLL';

export interface LeyLineMutationDefinition {
  id: LeyLineMutationId;
  name: string;
  tier: LeyLineMutationTier;
  description: string;
  /** Tag-based trigger summary for terminal readouts. */
  effect: string;
}
