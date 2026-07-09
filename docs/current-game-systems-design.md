# Veil Incursion Current Systems Design

Last updated: 2026-07-08 (echo encounters v1 phase 4)

This document captures the current implemented design surface for Veil Incursion: player-facing hub systems, run progression, economy, cargo/items, enemies, combat mechanics, and known partial implementations. It is intended as a working reference for design iteration and balancing, not a final player-facing manual.

## Source Of Truth

Primary data and implementation files:

- Hub navigation and screens: `src/constants/terminalNav.ts`, `src/screens/OverworldHubScreen.tsx`, `src/components/hub/LoadoutHubPanel.tsx`, `src/components/hub/BlackMarketHubPanel.tsx`, `src/components/hub/ContractBoardPanel.tsx`
- Contracts: `src/types/contract.ts`, `src/data/contractTemplates.ts`, `src/data/contractGenerator.ts`, `src/data/contractResolver.ts`, `src/data/contractRunProgressEngine.ts`, `src/utils/contractUi.ts`
- Debrief: `src/data/runDebriefEngine.ts`, `src/data/runDebriefResourceEngine.ts`, `src/screens/OperationDebriefScreen.tsx`, `src/hooks/useRunDeathFinalizer.ts`, `src/utils/operationDebriefUi.ts`
- World state / operations: `src/data/worldStateEngine.ts`, `src/data/anchorRegistry.ts`, `src/data/operationGenerator.ts`, `src/data/operationRulesEngine.ts`, `src/data/operationLifecycleEngine.ts`, `src/context/WorldStateContext.tsx`
- Run flow: `src/context/RunContext.tsx`, `src/context/GameFlowContext.tsx`, `src/data/descentEngine.ts`, `src/data/sectorGraphEngine.ts`
- Cargo/items/resources: `src/types/resourceItem.ts`, `src/types/runResourceLedger.ts`, `src/types/cargoGrid.ts`, `src/types/unstableCargoEffects.ts`, `src/data/resourceRegistry.ts`, `src/data/resourceValidation.ts`, `src/data/runResourceLedgerEngine.ts`, `src/data/extractionPersistenceEngine.ts`, `src/data/unstableCargoEffectsEngine.ts`, `src/data/lazyNodeContextEngine.ts`, `src/data/runDebriefUnstableCargoEngine.ts`, `src/data/blackMarket.ts`, `src/data/craftingRegistry.ts`, `src/data/consumableRegistry.ts`
- Enemies: `src/data/enemyRoster.ts`, `src/data/enemyDefinitions.ts`, `src/data/enemyCombatConfig.ts`, `src/data/combatRosterAI.ts`, `src/data/enemyAlphaConfig.ts`
- Combat execution: `src/components/TacticalCombatHub.tsx`, `src/data/combatRosterActions.ts`, `src/data/combatFractureEngine.ts`
- Class abilities: `src/data/aegisAbilities.ts`, `src/data/hexShotAbilities.ts`, `src/data/envoyAbilities.ts`
- Progression and boons: `src/data/boundRequisitions.ts`, `src/data/leyLineMutations.ts`, `src/data/regions.ts`

## High-Level Game Loop

1. Player starts in the hub (no faction lock-in at game start).
2. Player configures prep through:
   - **Contract Board:** select sponsor contract or Independent Breach (`selectedContract` in world state).
   - **Veil Front:** sector briefing, selected contract summary, sector compatibility markers, and breach deployment.
   - **Black Market:** Forge and Vendor.
   - **Loadout:** class/weapon/trinket/ability deck and cargo packing.
3. Player initiates a breach from Veil Front.
4. Current loadout and cargo are committed into run state; **active contract** frozen on incursion (`freezeContractForRun`).
5. The run proceeds through procedural depths/nodes.
6. Nodes can include combat, elite combat, boss combat, narrative events, sanctuary, black market, resource harvest, extraction vectors, and boon nodes.
7. Combat and events award resources, credits, trinkets, boons, cargo, or progression. Run events update `contractRunProgress` (depth, elites, boss, emergency recall, operation targets, anomalies).
8. **Extraction** resolves through **Run Debrief** (`OperationDebriefScreen`): run outcome, extraction method, contract result (+ bonus objectives), grouped resource resolution, operation contribution, and community progress. Contract rewards and sponsor reputation grant on successful extraction only.
9. **Death** resolves through the same **Run Debrief** screen (failed outcome): run stats, grouped resource resolution (lost vs banked), failed contract result, informational operation contribution (not applied without extraction). Banked safehouse cargo persists to hub stash.
10. After any run, contract board refreshes to Independent Breach with a new job board.

### Sponsors And Contracts (v1)

**Cabals are sponsors, not player factions.** Players do not commit to Terran Grid, Legion, or Solaris at game start.

| Sponsor | Contract flavor | Reward profile |
|---|---|---|
| Terran Grid | Intel recovery, clean extraction, stable resources | Credits, defensive bonuses, scanner crafting, reputation |
| Legion | Elite/boss kills, emergency recall extractions, Blood-Iron | Weapon materials, combat consumables, rare loot, reputation |
| Solaris | Unstable cargo, anomaly interaction, apex resources | Occult materials, rare resource bonuses, reputation |

**UI direction:** Hub terminal styling follows Terran Grid aesthetic for all players regardless of contract sponsor.

**State naming:** `selectedContract` in `WorldStatePersistedState.contractBoard` — stores Independent Breach or a full sponsor contract snapshot, not a permanent allegiance.

**Legion emergency recall contracts:** Use existing **Emergency Recall** extraction language (`EMERGENCY_RECALL` review kind, cargo bleed %) — not a separate "dirty extraction" system name.

**Independent Breach:** No sponsor contract; base sector rewards and operation progress still apply.

**Contract resolution rules:**
- Resource objectives count only **banked or extracted** cargo (`runResourceLedger`).
- Combat objectives (elite, boss, emergency recall, operation target) require **successful extraction**.
- Boss kill operation contribution requires **successful extraction** (`computeRunOperationContribution`).
- Bonus objectives (clean extraction, early extract, depth boss, depth extract, anomaly clear) award extra credits/reputation when the primary contract succeeds.

**Debrief sections (extraction):** Run Outcome, Extraction Method, Extraction Payout, Contract Result (+ bonus), Resource Resolution (grouped by category), Operation Contribution (`+N progress this run` headline, mid-run transmission, extract breakdown, total this run), Community Progress (before→after %).

**Debrief sections (death):** Run stats, grouped Resource Resolution (lost vs banked), failed Contract Result, Operation Contribution (informational; shows `No operation progress generated this run` when nothing credited, or mid-run transmission when applicable), Community Progress.

**Mid-run operation contribution:** Clearing operation target or anchor signal nodes applies `clearOperationTarget` contribution immediately during the run (`RunWorldStateBridge` + `RunContext`). Tracked on incursion as `operationContributionTransmitted` and surfaced on debrief as **Mid-incursion transmission**.

**Operation contribution rule:** Depth boss contribution credits apply only when the player **successfully extracts** (`runDebriefEngine.ts`).

## Hub Systems

### Main Hub Navigation

The current main hub rail contains:

- Veil Front
- Black Market
- Loadout
- Test in dev builds only

Safehouse was removed from the main hub navigation. In-run safehouse remains available as a separate run/intermission screen.

### Veil Front

Veil Front is the main deployment screen. It contains:

- Sector map and active sector briefing.
- Operation tab: lifecycle status, run window, **reward preview**, contribution rules, progress (`current/required` + %), and recent **operation intel** log lines.
- Anchor tab; compact **selected contract** summary with sponsor perks (`SelectedContractSummary`).
- Sector threat/reward/echo/anchor/resource readouts.
- Sector compatibility markers for the selected contract (`getContractSectorCompatibility`).
- Deployment confirmation modal (operation lifecycle, **operation reward preview**, sponsor perks when applicable).
- Initiate Breach call to action.

The main deploy/start-run button is consolidated here. Veil Front does **not** show the full contract board.

### Procedural Operations & Anchor Behavior

Persistent world state drives run generation. Each of the 5 sectors has exactly one **Veil Anchor** (fixed per sector) and one **active Operation** (rotates over time).

**Anchor types (sector-locked):**

| Sector | Anchor | Run pressure focus |
|--------|--------|-------------------|
| Slag Works | Choir Spire | Echo / resonance bleed |
| Abyssal Sink | Null Monolith | Scanner distortion / intel |
| Null Zone | Ley Nexus | Resource density |
| Blackline Terminus | Rift Engine | Combat / industrial pressure |
| Ashen Wastes | Ashen Heart | Elite / boss pressure |

**Operation types (5 archetypes):** `ANCHOR_ASSAULT`, `ECHO_RECOVERY`, `EXTRACTION_SURGE`, `RESOURCE_SURVEY`, `BOSS_SUPPRESSION`. After each sector's 2 hand-authored starter operations, procedural generation weighted by anchor type rolls new instances with **title/description variants** and sector-specific reward emphasis.

**Lifecycle:** `ACTIVE` (5 runs) → `COMPLETED` → `AFTERMATH` (2 runs) → rotate to next operation. Expired operations rotate without completion. Completed operations deactivate linked anchors for a type-specific duration and apply per-type completion effects (reward surge, scanner visibility, elite pressure reduction, etc.).

**Contribution:** Per-operation-type rules in `operationRulesEngine.ts`. Credits apply on successful extraction unless mid-run transmission (scanner node clears). Sources include extraction, emergency recall, safehouse banking, depth boss, elites, anchor elites/core, target resources (capped), and operation target nodes.

**Scanner integration:** Depth-based probabilistic rolls for anchor signals and operation targets (`nodeGenerationContextEngine.ts`). Operation target overlays only appear on rolled nodes; mid-run clears contribute immediately.

**Echo encounters (v1 — Phases 1–6):** Echo signals are scanner overlays, not enemy origin rolls. `assignEchoOverlaysForDepth` stamps `echoOverlay` at scanner layer unlock (and depth 1 at tree gen). Caps: max 1 echo signal per procedural depth, max 2/run (3 during `ECHO_RECOVERY`). At engagement, `resolveEchoEncounterAtEngagement` weights and picks encounter kind: `FALLEN_RUNNER_ECHO` (narrative loot/stabilize/leave), `HOSTILE_ECHO` (authored combat template), `ASSIST_ECHO` (next-combat buff), `CARGO_ECHO` (salvage + ambush risk), `EXTRACTION_ECHO` (route reveal). **Phase 3:** three class-inspired hostile templates (Fallen Aegis / Hex Shot / Envoy) plus depth-3 corrupted legendary variants; `pickEchoTemplateForNode` prefers class templates when snapshot `sourceClass` matches; depth scaling softens class echoes at depth 1 and toughens standard class echoes at depth 3; `echoRewardEngine.ts` rolls Echo-Glass, credits, and class-biased bonus salvage on hostile victory via `grantHostileEchoRewards`. **Phase 4:** `runDebriefEchoEngine.ts` builds Echo debrief block (signals, resolutions, glass extracted/banked/lost, Echo Recovery progress lines); `computeRunOperationContribution` credits granular echo events on `ECHO_RECOVERY` runs; dev echo forcing via `echoDebugEngine.ts` + Dev Test hub buttons. **Phase 6:** Veil Front player-facing echo intel — `echoIntelEngine.ts` feeds scanner telemetry (`scannerSignalEngine.ts`), sector briefing ECHO INTEL block (`SectorBriefingPanel.tsx`), deploy confirm Echo Intel line (`VeilFrontDeployConfirmModal.tsx`), and objective-aware contribution hints (`formatOperationContributesForObjective` on `ActiveOperationCard.tsx` + briefing); `echoRunState.echoRewardsExtracted` tracks reward stacks banked/extracted; fallen-runner loot can drop Smuggler's Ledger (8% on cargo echo); extraction echo sets `extractionRecallBonusPending` for a one-time −5% emergency recall cargo bleed (`RunContext.applyEmergencyRecallCargoBleed`); world-state dev validation appends static echo pipeline checks (`validateEchoEncounterPipeline` via `WorldStateContext.devGetValidationReport`). Run tracking via `echoRunState` on incursion. Source: `src/types/echoEncounter.ts`, `src/types/echoElite.ts`, `src/data/echoEncounterEngine.ts`, `src/data/echoEncounterKindEngine.ts`, `src/data/echoEncounterResolver.ts`, `src/data/echoNarrativeEngine.ts`, `src/data/echoEliteCatalog.ts`, `src/data/echoRecoveryEngine.ts`, `src/data/echoRewardEngine.ts`, `src/data/echoRunState.ts`, `src/data/echoIntelEngine.ts`, `src/data/runDebriefEchoEngine.ts`, `src/data/echoDebugEngine.ts`.

**Echo encounters v1 — acceptance criteria (all met):**

1. ✅ Echo Signal exists as a scanner overlay/context (`ProceduralEchoOverlay`, `NodeContextModifiers.echoSignal`).
2. ✅ Echo Signal spawn scales with sector `echoActivity`, depth stage, anchor bias (`signalRollModifiers.echoSignalChance`), and `ECHO_RECOVERY` operation (`resolveEchoSignalRollChance`).
3. ✅ Echo Signal is a node-context overlay, never a normal enemy origin roll (`encounterEchoOverride.ts` bypasses origin roll only for stamped echo nodes).
4. ✅ Echo Signal nodes resolve into authored encounters at engagement (`resolveEchoEncounterAtEngagement`).
5. ✅ Fallen Runner Echo (narrative loot/stabilize/leave — `echoNarrativeEngine.ts`).
6. ✅ Hostile Echo (authored combat template).
7. ✅ Assist Echo (next-combat buff / reveal).
8. ✅ Cargo Echo (salvage + ambush risk).
9. ✅ Extraction Echo (route reveal).
10. ✅ Three class hostile templates — Fallen Aegis / Hex Shot / Envoy (+ depth-3 corrupted variants) in `echoEliteCatalog.ts`.
11. ✅ Echo rewards granted via `echoRewardEngine.ts` + resolvers.
12. ✅ Echo rewards route through cargo (`addLootToContainment`) and follow normal extraction/bank/death ledger rules.
13. ✅ `ECHO_RECOVERY` operations gain progress from echo events (`computeRunOperationContribution`).
14. ✅ Debrief shows Echo activity + contribution (`runDebriefEchoEngine.ts`, `OperationDebriefScreen`).
15. ✅ Dev tools force/test echoes (`echoDebugEngine.ts`, Dev Test hub ECHO // DEBUG row, `hostile-echo-combat` sandbox preset).
16. ✅ No real player snapshot system (only `EchoSnapshotPlaceholder` future-hook fields).
17. ✅ No online multiplayer sync.
18. ✅ No bribe/betrayal system.
19. ✅ No faction territory/control system.
20. ✅ Existing runs remain playable (echo hooks are additive; no new pre-existing typecheck regressions).

**Future player-snapshot hooks (not implemented):** `EchoSnapshotPlaceholder` reserves `sourcePlayerId`, `sourceRunId`, `sourceClass`, `sourceLoadoutSummary`, `sourceDeathDepth`, `sourceCargoSummary`, `echoRarity`; `EchoEliteTemplate.loadoutSummary` carries authored flavor in v1.

**Key files:** `anchorRegistry.ts`, `operationGenerator.ts`, `operationRulesEngine.ts`, `operationLifecycleEngine.ts`, `echoEncounterEngine.ts`, `echoValidation.ts`, `worldStateValidation.ts`, `worldStateDebugEngine.ts` (dev only).

**Veil Front surfaces:** Active operation/anchor cards, sector intel (operation type + lifecycle), briefing tabs, deploy confirmation (reward preview + contribution hints + echo intel), operation intel log, ECHO RECOVERY contribution hints on active operation card.

**Debrief surfaces:** `+N progress this run` headline, mid-incursion transmission, per-type completion effect lines, community progress bar.

### Black Market

Black Market is a hub screen with two internal tabs:

- Forge: crafting bench for blueprints, augments, and consumables.
- Vendor: contraband cargo/consumable shop.

Vendor stock includes Soul Core as an always-stocked item plus a rotating pool of combat and scanner tools.

### Loadout

Loadout is a hub screen with two internal tabs:

- Loadout: operative class selector, weapon chassis, trinket socket, and ability deck editor.
- Cargo: pre-run cargo grid and stash packing interface.

The class selector is a compact operative identity strip with class cycling. Weapons and trinkets are surfaced even though trinket equipment is still limited.

## Run And Progression Systems

### Run State

Run state tracks:

- Current depth/node.
- Soul Anchor HP and max HP.
- Stamina and max stamina.
- Active class and class loadout.
- Active cargo and containment.
- **`runBankedSnapshot`** — physical cargo secured at in-run safehouse (survives death).
- **`runResourceLedger`** — collected, banked, extracted, lost, consumed resource counts.
- Active trinkets and run modifiers.
- Resonance, sector state, operation state, and world context.
- Run log and encounter/session flags.

### Node Types

Implemented node categories include:

- Standard combat.
- Elite combat.
- Boss combat.
- Narrative event.
- Sanctuary.
- Black market.
- Resource harvest.
- Emergency extraction.
- Safe anchor extraction.
- Master extraction link.
- Veil bleed boon.
- Anomaly.

### Resource Harvesting

Harvest has three yield modes:

- Quick Siphon: 50% yield, low noise.
- Full Extraction: 75% yield.
- Deep Gore: 100% yield, violent extraction flavor.

Harvested items enter cargo systems and can be extracted/banked depending on run route and extraction state.

### Bound Requisition

Bound Requisition is the pre-run boon/passive selection layer. It offers standard requisitions plus faction mandates at higher tiers.

Examples:

- Hazard Pay: start with 50 credits.
- Standard-Issue Coagulant: start with one Coagulation Stitch in cargo.
- Adrenaline Primer: +1 AP on the first turn of the first three combat nodes.
- Reinforced Trench-Coat: +10% max HP.
- Smuggler's Pockets: +2 cargo slots, with resonance tradeoff.
- Chalk-Line Ward: first three depths generate no resonance from scans.
- Blood Price: start with a powerful Ley-Scar, missing 25% max HP.
- Scavenger's Mark: first Black Market has 50% discount, starts with resonance.
- Wiretap Override: early depths reveal enemy types on scan.
- Bribe the Ferryman: guarantees early evac, elites hit harder.
- Kinetic Battery: defending boosts next attack damage.
- Hollow-Point Requisition: bonus against frontline corporeal enemies, penalty against backline spectral enemies.
- Void-Touched Artifact: start with a high-tier weapon blueprint in cargo, with locked cargo slots.
- Apex Bait: elite rewards improve, start with resonance.
- Martyr's Bargain: keep exactly one cargo item on death, start with reduced max HP.
- Ironclad Logistics: Terran mandate, expanded cargo and guaranteed Depth 10 evac, no Ley-Scars.
- Sunken Rite: Solaris mandate, Ley-Scars and resonance immunity, max HP halved.
- Endless March: Legion mandate, heal/damage ramp per clear, evac nodes locked.

## Economy And Inventory

### Persistent Account Economy

Persistent account state includes:

- Cabal credits.
- Veil residue.
- Resource stash.
- Banked cargo value.
- Crafted augment unlocks.
- Blueprint unlocks.
- Hub-crafted consumables.
- Pre-run cargo draft.
- Class ability unlocks and loadouts.
- Unidentified/decryption stash.

### Resources

Resources are persistent stash materials carried in the cargo grid during runs. Each resource has a **category** (behavior class), a **primary role** (gameplay purpose), **usage tags** (contract/crafting eligibility), and **eligibility flags** that systems read instead of inferring from category alone.

Source: `src/types/resourceItem.ts`, `src/data/resourceRegistry.ts`, `src/data/resourceValidation.ts`.

#### Resource Categories

| Category | Role |
|---|---|
| STABLE | Normal crafting and economy materials; lost on death if unbanked |
| UNSTABLE | Valuable cargo targets; contract and operation eligible |
| INTEL | Scanner intel, economy intel, or fence-value recovery targets |
| CONTRABAND | High-risk sealed cargo; contract targets; future bribe hooks |

#### Category vs Role

Category does **not** decide all behavior. Example: Encrypted Grid-Drive is INTEL but craftable; Smuggler's Ledger is INTEL but **not** craftable (economy/fence value only).

#### Eligibility Flags (per resource)

- `canBeCraftingIngredient` — forge recipes may consume only when true
- `canBeSoldToFence` — vendor fence tab
- `canBeContractTarget` — procedural sponsor contracts
- `canBeOperationTarget` — sector operation contribution
- `canBeBankedAtSafehouse` — physical safehouse banking (Phase 2)
- `requiresExtractionForValue` — payout only after extract or bank
- `lostOnDeathIfUnbanked` — all resources true for v1

#### Resource Registry (v1)

| Resource | Category | Primary Role | Stack | Size | Short Name | Craft | Fence |
|---|---|---|---:|---:|---|:---:|:---:|
| Ley-Slag | STABLE | CRAFTING_MATERIAL | 5 | 1×1 | Ley-Slag | ✓ | ✓ |
| Sanguine Ampoule | STABLE | CRAFTING_MATERIAL | 3 | 1×1 | Sanguine Ampoule | ✓ | — |
| Encrypted Grid-Drive | INTEL | SCANNER_INTEL | 1 | 1×2 | Grid-Drive | ✓ | ✓ |
| Legion Blood-Iron | STABLE | CRAFTING_MATERIAL | 1 | 2×1 | Blood-Iron | ✓ | — |
| Anomalous Core | UNSTABLE | APEX_CARGO | 1 | 2×2 | Anomalous Core | ✓ | — |
| Echo-Glass Shard | STABLE | CRAFTING_MATERIAL | 10 | 1×1 | Echo-Glass | ✓ | — |
| Veil-Ash Canister | UNSTABLE | VOLATILE_CARGO | 1 | 1×2 | Veil-Ash | ✓ | — |
| The Smuggler's Ledger | INTEL | ECONOMY_INTEL | 1 | 2×1 | Smuggler Ledger | — | ✓ |
| Ossified Ley-Knot | UNSTABLE | OCCULT_CARGO | 1 | 1×1 | Ley-Knot | ✓ | — |
| Sealed Containment Casket | CONTRABAND | UNIDENTIFIED_CONTAINER | 1 | 3×1 | Casket | — | ✓ |
| Tarnished Dog Tags | INTEL | FENCE_VALUE | 10 | 1×1 | Dog Tags | — | ✓ |
| Combustion Cylinder | STABLE | EXPLOSIVE_MATERIAL | 1 | 1×2 | Combustion Cylinder | ✓ | — |

**Smuggler's Ledger:** INTEL / ECONOMY_INTEL / FENCE_VALUE — not a crafting ingredient. High fence payout (250 credits).

**Tarnished Dog Tags:** stackable INTEL / FENCE_VALUE — not a crafting ingredient.

**Sealed Containment Casket:** CONTRABAND / UNIDENTIFIED_CONTAINER — not craftable while sealed; `canOpenAtHub` reserved for future appraisal.

Each resource also defines `validSectorIds` for contract generation validation.

#### Debrief Grouping

Run debrief resource resolution groups materials by category and role (`runDebriefResourceEngine.ts`):

| Group | Source |
|---|---|
| Stable Materials | Extracted STABLE category resources |
| Extracted Unstable Cargo | Extracted UNSTABLE category resources |
| Intel Recovered | INTEL category |
| Contraband | CONTRABAND category |
| Fence-Value Items | FENCE_VALUE / ECONOMY_INTEL roles and fence-eligible items |
| Banked at Safehouse | Physical cargo secured in-run (death debrief) |
| Lost in the Veil | Unbanked cargo lost on death |

**Cargo Pressure debrief block** (`runDebriefUnstableCargoEngine.ts`): when unstable cargo was carried or resolved this run, debrief shows which carried-effect types were active and a per-outcome unstable cargo tally (extracted / banked / lost).

Resources are mirrored into the cargo catalog as cargo-compatible items with role tags (`UNSTABLE`, `VOLATILE`, `APEX`, `OCCULT`) for resonance and future systems.

### Cargo Grid

Current cargo grid constants:

- Grid: 4 rows x 3 columns.
- Occupancy resonance threshold: 70%.
- Resonance multiplier: 2× when grid occupancy ≥ 70% (`getCargoResonanceMultiplier`).

Cargo items have:

- Width/height.
- Base value.
- Resonance weight.
- Tags.
- Optional scanner use.
- Optional combat use.
- Optional combat effect and AP cost.

#### Unstable Cargo Carried Effects (v1)

Three UNSTABLE resources apply **carried effects** while physically present in run cargo (grid or containment). Effects read live cargo — banking removes physical copies and ends pressure; safehouse bank snapshot does not apply carried modifiers.

| Resource | Role | Upside | Downside |
|---|---|---|---|
| Anomalous Core | APEX_CARGO (2×2) | +10% rare loot | +10% ELITE type weight; +10% Anchor signal at breach |
| Veil-Ash Canister | VOLATILE_CARGO (1×2) | — | +10% ANOMALY type weight; +10% anomaly/context pressure at breach; emergency recall hazard log |
| Ossified Ley-Knot | OCCULT_CARGO (1×1) | +10% occult loot | −10% healing received (multiplicative) |

**Stacking:** Each unique unstable type applies once — duplicate copies do not stack (`buildActiveCarriedCargoSnapshot`).

**Combat / economy hooks:** Rare and occult drop bonuses in `grantCombatResourceDrops`; healing multiplier in combat consumables, sanctuary attune, and bench restore.

**Scanner lazy rolls (procedural runs):**

1. **Type assignment (layer unlock):** Depths 2–14 start as COMBAT placeholders until the scanner layer unlocks. `assignPendingDepthTypes` rolls final node types with cargo bias (Anomalous Core → ELITE weight; Veil-Ash → ANOMALY weight). Triggered via `syncProceduralScannerTypes` when depth advances or cargo changes.
2. **Context modifiers (breach):** Anchor / high-value / hazard context modifiers roll at node engagement. Cargo biases anchor signal and high-value rolls (`ensureNodeContextModifiersAtEngagement`). **Echo signal overlays** are visible on scanner after layer unlock; hostile template + `echoEncounterKind` resolve at engagement.

**UI:** `CargoPressurePanel` on cargo overlay, run chrome, and event headers when effects are active. First pickup logs once per type per incursion (`unstableCargoPickupLogged`).

**Debrief:** `unstableCargoEffectsSeen` tracks types that were physically carried; debrief Cargo Pressure section summarizes carried pressure and unstable resolution.

**Resonance:** Veil-Ash Canister catalog tag `VOLATILE` contributes per-item volatile resonance bonus. Grid occupancy ≥ 70% applies the 2× cargo resonance multiplier.

Source: `src/types/unstableCargoEffects.ts`, `src/data/unstableCargoEffectsEngine.ts`, `src/data/lazyNodeContextEngine.ts`, `src/data/nodeGenerator.ts`, `src/data/proceduralScannerBridge.ts`, `src/components/CargoPressurePanel.tsx`.

### Cargo And Consumable Items

#### Combat-Usable Items

| Item | Size | Effect |
|---|---:|---|
| Soul Core | 1x1 | Heal 50% Soul Anchor in combat |
| Veil Shard | 1x1 | Max hostile fracture gauge and disrupt charge/stun channels |
| Grave-Dust Ampoule | 1x1 | Stamina/AP surge |
| Grid-Cracker Mag | 1x1 | Shatter kinetic armor |
| Eclipse Flare | 1x1 | Strip occult wards |
| Coagulation Stitch | 1x1 | Clear debuffs and heal 10% HP |
| Spall-Weave Vest | 1x1 | Absorb next lethal hit |
| Void-Surge Catalyst | 1x1 | Max Abyssal Reserve |
| Sanguine Coagulant | 1x1 | Heal 50% HP and purge Bleeding/Fractured |
| Veil-Ash Grenade | 1x1 | Blind enemy frontline for 2 turns |
| Spectral Salt | 1x1 | Spectral weapon imbue |
| God Mode | 1x1 | Debug combat item, no AP cost |

#### Scanner/Field Tools

| Item | Size | Effect |
|---|---:|---|
| Focusing Ampoule | 1x1 | Scanner/attunement use |
| Dead-Drop Token | 1x1 | Instant cargo extraction tool |
| Resonance Bribe | 1x1 | Reduce resonance on scanner use |
| Sonar-Ping | 1x1 | Scanner/extraction tool |

#### Loot, Narrative, Or Partial Items

| Item | Size | Status |
|---|---:|---|
| Null Crystal Shard | 1x1 | Loot value |
| Null Crystal Matrix | 2x2 | Loot value |
| Veil Residue | 1x1 | Volatile/high-value loot |
| Gravity Grapple | 1x1 | Tool tag, no combat handler |
| Rift Iron Cache | 1x1 | Metal loot |
| Target Fragment | 1x1 | Combat effect marked unimplemented |
| Kinetic Hollow Points / Veil-Vial | 1x1 | Damage buff item, combat effect marked unimplemented |
| Smoke Ampoule | 1x1 | Narrative/obscure tag |
| Null-Key | 1x1 | Narrative/breach tag |
| Hazmat Shielding | 1x2 | Narrative/shield tag |

### Black Market Vendor Listings

Always stocked:

- Soul Core.

Rotating pool:

- Veil Shard.
- Grave-Dust Ampoule.
- Grid-Cracker Mag.
- Eclipse Flare.
- Coagulation Stitch.
- Dead-Drop Token.
- Resonance Bribe.
- Spall-Weave Vest.
- Void-Surge Catalyst.

### Forge Recipes

Weapon/blueprint recipes:

- Pulse Rifle Frame -> Riftshot Pulse Rifle.
- Claymore Strike -> Aegis Claymore.
- Containment Rig -> Envoy Hex.

Augment recipes:

- Chalk-Line Ward.
- Adrenaline Primer.
- Blood Price.
- Smuggler's Pockets.
- Kinetic Battery.
- Dead-Drop Tracker.

Consumable recipes:

- Standard Coagulant -> Coagulation Stitch.
- Trauma Patch -> Sanguine Coagulant.
- Veil-Vial -> Kinetic Hollow Points.
- Veil-Ash Grenade.
- Sonar-Ping.

### Weapon Blueprints

| Blueprint | Class | Effect |
|---|---|---|
| Anomaly-Treated Claymore | Aegis | On hit vs fractured hostiles, grant +10 shield for 1 turn |
| Pulse Shot Rifle | Hex Shot | On fire, self 5% HP; spectral targets take 2x damage |
| Diplomatic Hex Sigil | Envoy | Each operative turn, one random hostile gains Vulnerable (+15% damage taken) |

### Trinkets

Run-time trinkets:

- Tuning Fork: +20% parry window, -5% slice damage.
- Ghost Battery: start fights with 25% Abyssal Reserve.
- Anchor Plate: +15 max Soul Anchor HP.
- Counter Matrix: +10% parry counter damage.
- Ley Suture: restore 20 Soul Anchor HP.
- Stamina Coil: restore 30 stamina.

Post-combat boon variants:

- Tuning Fork: +20% parry window.
- Aegis Matrix: +10% parry counter.
- Reservoir Coil: +25% start Abyssal Reserve.
- Veil Plate: +10 max HP.
- Monomolecular Edge: reduces slice penalty.

## Combat Systems

### Core Combat Model

Combat uses:

- 2x2 enemy grid: two frontline slots and two backline slots.
- Player AP.
- Player stamina.
- Soul Anchor HP.
- Abyssal Reserve.
- Class-specific combat resources.
- Kinetic armor layers.
- Occult ward layers.
- Fracture gauge.
- Enemy intent telegraphs.
- Enemy turn queues and motion stages.
- Cargo consumable deployment.

### Defensive Layers

Key defensive/mitigation systems:

- Kinetic armor.
- Occult wards.
- Fracture and fractured states.
- Evade posture.
- Fortify posture.
- Void Ward / parry for Aegis.
- Shields and temporary player mitigation.
- Veil Barrier charges on enemies.
- Warden intercepts for specific targeting cases.

### Enemy Intent Categories

Shared/common intents:

- Strike: base direct damage.
- Fortify: hardens armor for about two turns, skips attack.
- Evade: adds miss chance for about two turns, skips attack.
- Strip Stamina: drains stamina.
- Siphon Abyssal: drains Abyssal Reserve.
- Charge: telegraph for World-Ender.
- World-Ender: unblockable finisher after charge.
- Double Strike: two strike instances, more for some alpha variants.
- Field Repair: heals allies.
- Artillery Charge: telegraph turn for artillery.
- Artillery Fire: ranged damage, often not parry-eligible.

Special roster intents include:

- Pavement Crusher Charge / Pavement Crusher.
- Occult Tether.
- Swarm Bite.
- Stamina Drain Leap.
- Veil Static.
- Premature Ignition.
- Resonance Overload.
- Sinking Into Grid / Void Ambush.
- Kinetic Aftershock.
- Scavenge.
- Sensory Jam.
- Hex Mark.
- Binding Ward.
- Veil Barrier.
- Target Lock.
- Ashen Rot.
- Laser Sight.
- Tar Bind.
- Stamina Tether.
- Jam Augment.

## Enemy Roster

Stats below are base roster values. Spawned combat values can be replaced or scaled by `enemyDefinitions`, `enemyCombatConfig`, district depth, alpha modifiers, and elite/boss logic.

### Terran Grid Enemies

| Enemy | HP | Damage | Armor/Wards | Role | Special Abilities |
|---|---:|---:|---|---|---|
| Concrete Gargoyle | 72 | 10 | 2K / 0O | Frontline | Pavement Crusher Charge into Pavement Crusher. Alpha Dread gains heavy armor. |
| Gutter Goliath | 88 | 11 | 3K / 0O | Frontline | Strike/Fortify. Enrages below 30% HP, strips armor and boosts damage. Alpha Putrid regenerates. |
| Echoing Brute | 95 | 13 | 2K / 1O | Frontline elite | Kinetic Aftershock, Fortify, Resonance Overload. Enrage forces Overload. Alpha Resonant boosts adaptive damage. |
| Iron Maiden | 135 | 16 | 20K / 0O | Frontline | Strike/Fortify. Alpha Gilded reflects physical damage. |
| Golem | 145 | 14 | 18K / 0O | Frontline | Strike/Fortify. Alpha Meltdown uses heat threshold behavior. |
| Slag Blood | 120 | 20 | 12K / 0O | Frontline | Double Strike. Enrages below 30% HP, strips armor and doubles damage. |
| Sapper | 82 | 22 | 0K / 0O | Backline artillery | Artillery Charge/Fire. Bunker Buster strips shields and hits unblockably. |
| Breacher | 78 | 6 | 0K / 0O | Rival frontline | Strike/Fortify. Breach Strike shreds stamina. |
| Cutter | 74 | 10 | 0K / 0O | Rival frontline | Strike/Evade. Alpha Phantom gets evade after swap. |
| Warden | 128 | 14 | 8K / 0O | Rival frontline | Strike/Fortify. Alpha Bulwark intercepts AoE. |
| Fixer | 88 | 8 | 0K / 0O | Rival backline support | Field Repair/Evade. Alpha Chief AoE-heals allies. |
| Spotter | 84 | 12 | 0K / 0O | Rival backline artillery | Target Lock into artillery burst. |
| Burner | 86 | 9 | 0K / 0O | Rival backline | Strike. Alpha Napalm burns ability buttons. |
| Rival Reaver | 120 | 16 | 0K / 0O | Rival frontline | Strike/Fortify. Alpha Bloodied gets extra attacks. |
| Hollowed Precinct | 220 | 11 | 3K / 1O | Boss | Boss phase behavior. |

### Solaris Enemies

| Enemy | HP | Damage | Armor/Wards | Role | Special Abilities |
|---|---:|---:|---|---|---|
| Ley-Siren | 48 | 11 | 0K / 2O | Backline disruptor | Occult Tether, Target Lock, Veil Static, Siphon Abyssal, Strike. |
| Ash Weeper | 102 | 14 | 2K / 2O | Backline | Siphon, Premature Ignition, Scavenge. Enrage triggers Ignition. Alpha Cinder death explosion. |
| Miasma Tick Swarm | 44 | 8 | 1K / 0O | Frontline | Swarm Bite/Stamina Drain Leap, Strike, Scavenge. Cannot Fortify. Alpha Plague adds stronger stamina drain and bleed. |
| Spall | 72 | 10 | 0K / 0O | Frontline | Strike. Alpha Volatile explodes and pierces defend. |
| Scuttler | 70 | 9 | 0K / 0O | Frontline | Strike/Evade. High evade profile. |
| Smog Caller | 100 | 12 | 0K / 1O | Backline disruptor | Strike/Siphon Abyssal. Alpha Suffocating increases melee stamina penalty. |
| Resonance Caster | 88 | 14 | 0K / 1O | Backline artillery | Artillery Charge/Fire. Alpha Harmonic scales damage per turn. |
| Tar Spitter | 86 | 12 | 0K / 0O | Backline artillery | Artillery Charge, Tar Bind, Strike. Alpha Fossilizing roots longer. |
| Splinter | 84 | 13 | 0K / 0O | Backline artillery | Artillery pattern; fire can apply Searing. Alpha Scorching increases searing damage. |
| Rival Veilbinder | 88 | 8 | 0K / 1O | Rival backline | Binding Ward, Field Repair, Evade. |
| Hollow Lung | 92 | 10 | 0K / 1O | Veil backline | Strike. Alpha Collapsed drains max HP. |
| Choir of Rust | 280 | 10 | 1K / 2O | Boss | Boss phase behavior. |

### Legion Enemies

| Enemy | HP | Damage | Armor/Wards | Role | Special Abilities |
|---|---:|---:|---|---|---|
| Fracture Hound | 60 | 11 | 1K / 1O | Frontline | Strike, possible Double Strike, shield drain. Alpha Rabid can hit three times. |
| Null Shade | 54 | 10 | 0K / 2O | Backline | Sinking Into Grid into Void Ambush, Evade, Veil Barrier, Ashen Rot. Alpha Void can AoE barrier. |
| Spatial Glitch | 108 | 15 | 3K / 1O | Backline elite | Strike, Sensory Jam, Fortify, Siphon. Alpha Paradox drains stamina on teleport. |
| Thrall | 85 | 11 | 3K / 0O | Frontline | Strike. Alpha Undying revives. |
| Hook Weaver | 92 | 11 | 0K / 1O | Backline disruptor | Stamina Tether, Strike. |
| Memory Leech | 85 | 10 | 0K / 2O | Backline disruptor | Jam Augment, Strike. Alpha Cognitive disables more augment slots. |
| Wire Ghoul | 72 | 10 | 0K / 0O | Frontline | Strike/Evade. Alpha Neural increases AP cost. |
| Coil Spike Sniper | 80 | 18 | 0K / 0O | Backline artillery | Laser Sight into true shot. Alpha Executioner has short lock wind-up. |
| Churn | 90 | 20 | 0K / 0O | Backline artillery | Strike. Alpha Slaughter changes ally-kill requirement behavior. |
| Grave Robber | 90 | 11 | 0K / 0O | Backline | Scavenge/Strike, corpse-consuming behavior. |
| Amalgam | 160 | 17 | 12K / 0O | Frontline, 2-wide | Strike/Fortify. Regenerates armor. |
| Rival Hexer | 82 | 9 | 0K / 1O | Rival backline | Hex Mark, Strike, Evade. |
| Primeval Rift-Walker | 360 | 16 | 2K / 3O | Boss | Boss phase behavior. |

### Alpha Variant Mechanics

Alpha variants add a name prefix and multipliers by default:

- HP x1.3.
- Fracture threshold x1.5.
- Damage x1.25.

Notable alpha mechanics:

- Dread Concrete Gargoyle: armor override.
- Putrid Gutter Goliath: regen.
- Resonant Echoing Brute: adaptive damage.
- Gilded Iron Maiden: physical reflect.
- Boiling Slag Blood: desperation damage.
- Monstrous Amalgam: armor regeneration.
- Eclipse Ley-Siren: armor grant.
- Cinder Ash Weeper: death explosion.
- Plague Miasma Swarm: stamina drain and bleed.
- Cruel Hook Weaver: tether stamina penalty.
- Cognitive Memory Leech: disables more augment slots.
- Suffocating Smog Caller: melee stamina multiplier.
- Neural Wire Ghoul: AP cost increase.
- Collapsed Hollow Lung: max HP drain.
- Rabid Fracture Hound: extra attacks and shield damage.
- Void Null Shade: AoE barrier target.
- Paradox Spatial Glitch: stamina drain on teleport.
- Apex Scuttler: higher evade.
- Volatile Spall: explosion and pierce defend.
- Undying Thrall: revive.
- Siege Breacher: stamina shred.
- Bulwark Warden: AoE intercept.
- Chief Fixer: AoE heal.
- Vanguard Spotter: instant lock.
- Napalm Burner: burns buttons.
- Bloodied Rival Reaver: extra attacks.
- Harmonic Resonance Caster: damage scaling.
- Fossilizing Tar Spitter: longer root.
- Scorching Splinter: stronger searing.
- Gorging Grave Robber: corpse-only behavior.

## Player Class Systems

### Aegis

Design identity: melee, kinetic, fracture, Abyssal Reserve, Runic Brands, parry/ward.

Abilities:

- Strike.
- Ruin.
- Wraith Parry / Void Ward.
- Grave Bind.
- Shadow Step.
- Veil-Piercer.
- Ashen Mantle.
- Nail to Grid.
- Blood Tithe.
- Demon's Lung.
- Crimson Pact.
- Eviscerate.
- Devastate.
- Abyssal Fault.
- Blood-Bound Carapace.
- Reave.

Recent state: Ruin is a full-grid 2x2 AoE affecting frontline and backline targets.

### Hex Shot

Design identity: ballistic control, overcharge, mark/round effects, cloak and reload tempo.

Abilities:

- Silver-Core Sidearm.
- Zero Protocol.
- Phase-Shift Reload.
- Ash Jacket Salvo.
- Singularity Slug.
- Panopticon Protocol.
- Revenant's Echo.
- Rift Snare.
- Phosphorus Hex.
- Null Space Cloak.
- Ghost Grid Camo.
- Astral Target Lock.
- Bleeding Payload.
- Wraith Piercer Round.
- Blood Tracer Round.
- Stasis Lock Slug.

### Envoy

Design identity: occult, Veil Rot, curses, warding, flesh/phase manipulation.

Abilities:

- Veil-Splinter.
- Cataclysm Sigil.
- Astral Lance.
- Necrotic Bloom.
- Flux Purge.
- Dimensional Shear.
- Rift Ward.
- Phase Step.
- Aetheric Transfusion.
- Soul Tether.
- Entropy Hex.
- Flesh Warp.
- Paralytic Miasma.
- Mind Sunder.

## Ley-Line Mutations, Boons, And Grafts

Implemented systems include:

- Ley-line mutations through `leyLineMutations.ts` and `boonEngine.ts`.
- Class boons through Aegis, Hex Shot, and Envoy hook runners.
- Grafts for Hex Shot, Envoy, and Veil systems.
- Mutation-driven combat modifiers such as Venomous Ruin, Spiked Ward, Relentless Momentum, Heavy Caliber, and related action hooks.

These systems are spread across:

- `src/data/leyLineMutations.ts`
- `src/data/boonEngine.ts`
- `src/data/aegisBoonHookRunner.ts`
- `src/data/classBoonHookRunner.ts`
- `src/data/envoyBoonHookRunner.ts`
- `src/data/classGraftEngine.ts`
- `src/data/veilGraftEngine.ts`

## Narrative And World Systems

Current world/narrative surface includes:

- Procedural sector graph.
- Macro sector/world catalog.
- Climate clusters.
- Region/biome pools.
- Scanner signal generation.
- Scanner anomalies.
- Anchor assault.
- Echo elite override/recovery (Phase 1–4: overlay at layer unlock, hostile resolution at breach, class templates + reward engine + debrief + dev tools).
- Patrol spawn.
- Resonance escalation.
- Narrative events and D20 skill checks.
- Operation progress.
- Sector map data and Veil Front overlays.

## Known Partial Implementations / Design Debt

- **Contract loop v1 (complete):** Resource model, physical banking, contract board, Veil Front integration, run event tracking, contract resolver, unified run debrief (extract + death via `OperationDebriefScreen`), procedural operation generation, operation lifecycle (ACTIVE / COMPLETED / expiration / AFTERMATH rotation), mid-run operation target contribution with debrief transmission line, sponsor perks on deploy/contract summary, operation intel log on Veil Front briefing, expanded operation contribution on extract, **debrief progress headline** (`+N progress this run`), **reward preview** on Veil Front cards/briefing/deploy modal, and **world state validation + dev debug tooling** (Phases A–F).
- **Unstable cargo carried effects v1 (complete):** Three unstable resources with deduped carried modifiers, lazy procedural type/context rolls, cargo pressure UI, debrief Cargo Pressure block, volatile resonance tagging, occupancy resonance multiplier, emergency recall Veil-Ash warning log.
- **Echo encounters v1 (complete — Phases 1–6):** Echo scanner overlays at layer unlock, per-depth/run caps, weighted encounter kinds, fallen-runner narrative, assist/cargo/extraction immediate resolution, hostile combat routing, class-based hostile templates with depth scaling, hostile echo reward rolls, debrief Echo section, dev forcing tools, echo pipeline validation (reward-resource existence + Echo Recovery contribution rules), `echoRunState` tracking, Veil Front echo intel surfaces, reward-stack extraction tracking, Smuggler's Ledger fallen-runner drop, extraction echo emergency-recall bleed bonus. Acceptance criteria (20) verified in the Echo Encounters v1 section below.
- **Safehouse banking:** Physical in-run banking via `runBankedSnapshot` — banked cargo survives death and routes to hub stash. Unbanked cargo is lost on death (`runResourceLedger.lostOnDeath`). Extraction merges banked + carried cargo before deposit.
- Target Fragment has a catalogued combat effect but is marked `unimplemented`.
- Kinetic Hollow Points / Veil-Vial is described as next attack +15 damage but is marked `unimplemented`.
- Gravity Grapple exists as a cargo tool tag but does not have a wired combat/scanner handler in the inspected files.
- Hub trinket equipment is mostly placeholder; run-time trinkets work in run state.
- Some item descriptions and implementation values drift:
  - Standard Coagulant craft description says 25 HP, while Coagulation Stitch catalog uses 10% HP.
- SafehouseHubPanel still exists in code but is no longer in the hub navigation.
- Some enemy/boss behaviors are phase-driven or hook-driven and should be documented more deeply per boss/encounter if balancing continues.
- Base enemy roster stats and scaled encounter stats are separate; tuning should check both `enemyRoster.ts` and `enemyDefinitions.ts`.

## Design Implications

- The game already has enough systemic surface to support a strong tactical roguelite loop: prep, risk routing, cargo management, tactical combat, resource extraction, and sponsor contracts.
- Resource taxonomy now separates category from role (crafting intel vs economy intel vs fence value).
- Enemy identity is strong, but intent documentation should become a player-facing codex or internal balancing table.
- Cargo is doing several jobs at once: loot value, tactical consumables, scanner tools, extraction tension, and resonance risk. This should remain central to run identity.
- Loadout now functions as the correct home for class, ability deck, weapon display, trinket display, and cargo prep.
- Black Market now has a clean split: Forge for crafting, Vendor for contraband.

