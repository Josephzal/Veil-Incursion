# Veil Incursion Current Systems Design

Last updated: 2026-07-17 (Economy Spine Phase 2A–2M + polish)

This document captures the current implemented design surface for Veil Incursion: player-facing hub systems, run progression, economy, cargo/items, enemies, combat mechanics, and known partial implementations. It is intended as a working reference for design iteration and balancing, not a final player-facing manual.

## Source Of Truth

Primary data and implementation files:

- Hub navigation and screens: `src/constants/terminalNav.ts`, `src/screens/OverworldHubScreen.tsx`, `src/components/hub/LoadoutHubPanel.tsx`, `src/components/hub/BlackMarketHubPanel.tsx`, `src/components/hub/ContractBoardPanel.tsx`
- Contracts: `src/types/contract.ts`, `src/data/contractTemplates.ts`, `src/data/contractGenerator.ts`, `src/data/contractResolver.ts`, `src/data/contractRunProgressEngine.ts`, `src/utils/contractUi.ts`
- Debrief: `src/data/runDebriefEngine.ts`, `src/data/runDebriefResourceEngine.ts`, `src/screens/OperationDebriefScreen.tsx`, `src/hooks/useRunDeathFinalizer.ts`, `src/utils/operationDebriefUi.ts`
- World state / operations: `src/data/worldStateEngine.ts`, `src/data/anchorRegistry.ts`, `src/data/operationGenerator.ts`, `src/data/operationRulesEngine.ts`, `src/data/operationLifecycleEngine.ts`, `src/context/WorldStateContext.tsx`
- Run world brief + procedural director + sector aftermath: `src/types/runWorldBrief.ts`, `src/data/runWorldBriefEngine.ts`, `src/data/proceduralDirectorEngine.ts`, `src/data/proceduralAftermath.ts`, `src/data/proceduralAftermathEngine.ts`, `src/data/proceduralAftermathCatalog.ts`, `src/data/proceduralAftermathDebriefAdapter.ts`
- Run flow: `src/context/RunContext.tsx`, `src/context/GameFlowContext.tsx`, `src/data/descentEngine.ts`, `src/data/sectorGraphEngine.ts`
- Cargo/items/resources: `src/types/resourceItem.ts`, `src/types/runResourceLedger.ts`, `src/types/cargoGrid.ts`, `src/types/unstableCargoEffects.ts`, `src/data/resourceRegistry.ts`, `src/data/resourceValidation.ts`, `src/data/runResourceLedgerEngine.ts`, `src/data/extractionPersistenceEngine.ts`, `src/data/unstableCargoEffectsEngine.ts`, `src/data/lazyNodeContextEngine.ts`, `src/data/runDebriefUnstableCargoEngine.ts`, `src/data/blackMarket.ts`, `src/data/craftingRegistry.ts`, `src/data/consumableRegistry.ts`
- Enemies: `src/data/enemyRoster.ts`, `src/data/enemyDefinitions.ts`, `src/data/enemyCombatConfig.ts`, `src/data/combatRosterAI.ts`, `src/data/enemyAlphaConfig.ts`
- Combat execution: `src/components/TacticalCombatHub.tsx`, `src/data/combatRosterActions.ts`, `src/data/combatFractureEngine.ts`, `src/data/combatDefenseLayerEngine.ts`, `src/data/aegisAbilityResolver.ts`, `src/data/balance/combatDefenseBalanceConfig.ts`
- Class abilities: `src/data/aegisAbilities.ts`, `src/data/hexShotAbilities.ts`, `src/data/envoyAbilities.ts`
- Progression and boons: `src/data/boundRequisitions.ts`, `src/data/leyLineMutations.ts`, `src/data/regions.ts`
- Progression Spine (career): `src/types/progression.ts`, `src/data/progressionProfileEngine.ts`, `src/data/unlockRegistry.ts`, `src/data/runnerClearanceEngine.ts`, `src/data/sectorAccessMandateEngine.ts`, `src/data/breachGradeEngine.ts`, `src/data/pinnedGoalEngine.ts`, `src/data/classRankEngine.ts`, `src/data/cabalRepEngine.ts`, `src/data/recipeVisibilityEngine.ts`, `src/data/debriefProgressionTheaterEngine.ts`, `src/data/failureRecoveryEngine.ts`, `src/data/progressionEconomySimulationEngine.ts`
- Economy Spine Phase 2A (cargo stacks): `src/data/cargoStackEngine.ts`, `src/data/cargoStackDebugEngine.ts`, `cargoStackCap` / `stashStackCap` on `ResourceItemDefinition`, quantity on `PlacedCargoItem` / `ContainmentItem`
- Economy Spine Phase 2B (registry + ownership): `src/data/resourceSourceIdentity.ts`, `src/data/cargoOwnershipEngine.ts`, `primarySectors` / `secondarySources` / `depthRules` / carried-effect flags, apex mid-run bank block
- Economy Spine Phase 2C (roster freeze): `src/data/economyRosterV1.ts` — 21 economy + 4 route intel, exact-match validation
- Economy Spine Phase 2D (sector resource tables): `src/data/sectorResourceTableEngine.ts` — farming identity per sector; drop bias + validation
- Economy Spine Phase 2E (depth resource rules): `src/data/depthResourceRulesEngine.ts` — Threshold / Breach / Deep Veil eligibility + combat/identity gates
- Economy Spine Phase 2F (reward packets): `src/data/resourceRewardPacketEngine.ts` — typed node packets, Breach Grade quality, extracted yield targets
- Economy Spine Phase 2G (source hints): `src/data/resourceSourceHintEngine.ts` — Exact / Partial / Unknown / contract-directed farming intel
- Economy Spine Phase 2H (economy report): `src/data/economySpineDebugEngine.ts` + `economySpineSimulationEngine.ts` — full report, bottlenecks, drop/run sims
- Economy Spine Phase 2I (discovery): `src/data/resourceDiscoveryEngine.ts` — earned resource identity / light codex state
- Economy Spine Phase 2J (integration): `src/data/economyIntegrationEngine.ts` + `economyValueLaneEngine.ts` — contract/op/fence/appraisal sync + value lanes
- Economy Spine Phase 2K (live telemetry): `src/data/economyRunTelemetryEngine.ts` — live economy events + career aggregates + debug report
- Economy Spine Phase 2L (save migration): `src/data/economySaveMigrationEngine.ts` — legacy resource id remap, stash/contract sanitize, craft/weapon preserve
- Economy Spine Phase 2M (tuning): `src/data/economyTuningEngine.ts` — tuning questions + balance-rule audit, D1 sector packets, recipe diversification
- Economy Spine polish: `src/data/economySpineAuditEngine.ts` — verify/acceptance aggregator; fence lane labels; forge discovery fog; debrief first-find; REPLACE stack qty
- Expedition relics (Trinkets v2): `src/types/expeditionKeepsake.ts`, `src/data/expeditionKeepsakeRegistry.ts`, `src/data/keepsakeRunState.ts`, `src/data/expeditionKeepsakeEngine.ts`, `src/data/expeditionKeepsake*Engine.ts`, `src/components/hub/KeepsakeLoadoutPanel.tsx`, `src/data/runDebriefKeepsakeEngine.ts`, `src/data/expeditionKeepsakeValidation.ts`, `src/data/expeditionKeepsakeAcceptanceEngine.ts`, `src/data/expeditionKeepsakeAuditEngine.ts`
- Run Items v2: `src/types/runItem.ts`, `src/data/runItemRegistry.ts`, `src/data/runItemRunState.ts`, `src/data/runItemCombatEngine.ts`, `src/data/runItemFieldEngine.ts`, `src/data/runItem*Engine.ts`, `src/components/hub/RunItemLoadoutPanel.tsx`, `src/data/runDebriefRunItemEngine.ts`, `src/data/runItemValidation.ts`, `src/data/runItemAcceptanceEngine.ts`, `src/data/runItemAuditEngine.ts`
- Run integration audit: `src/data/runIntegration/*`, extended `OperationDebriefPayload`, `OperationDebriefScreen.tsx`

## High-Level Game Loop

1. Player starts in the hub (no faction lock-in at game start).
2. Player configures prep through:
   - **Contract Board:** select sponsor contract or Independent Breach (`selectedContract` in world state).
   - **Veil Front:** sector briefing (access mandates / grades / pinned goals), selected contract summary, sector compatibility markers, and breach deployment.
   - **Black Market:** Forge and Vendor.
   - **Loadout:** class/weapon/expedition relic/ability deck and cargo packing.
3. Player initiates a breach from Veil Front.
4. Current loadout and cargo are committed into run state; **active contract** frozen on incursion (`freezeContractForRun`).
5. The run proceeds through procedural depths/nodes.
6. Nodes can include combat, elite combat, boss combat, narrative events, sanctuary, black market, resource harvest, extraction vectors, and boon nodes.
7. Combat and events award resources, credits, legacy combat trinkets, boons, cargo, or progression. Run events update `contractRunProgress` (depth, elites, boss, emergency recall, operation targets, anomalies). **Expedition relic** hooks fire on scanner, cargo, economy, contract, safehouse, echo/anchor, and extraction lifecycle events (no direct combat stat bonuses).
8. **Extraction** resolves through **Run Debrief** (`OperationDebriefScreen`): run outcome, extraction method, contract result (+ bonus objectives), grouped resource resolution, operation contribution, community progress, and **progression theater** (clearance/sector/grade/class/cabal/craft/pins). Contract rewards and sponsor reputation grant on successful extraction only.
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

**Debrief sections (extraction):** Run Outcome, Extraction Method, Extraction Payout, Contract Result (+ bonus), Resource Resolution (grouped by category), Operation Contribution (`+N progress this run` headline, mid-run transmission, extract breakdown, total this run), Community Progress (before→after %), **Sector Crisis** (run world brief summary), **Sector Aftermath** (predicted post-run modifiers when rules match).

**Debrief sections (death):** Run stats, grouped Resource Resolution (lost vs banked), failed Contract Result, Operation Contribution (informational; shows `No operation progress generated this run` when nothing credited, or mid-run transmission when applicable), Community Progress, Sector Crisis, Sector Aftermath (when applicable).

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

- Sector map and active sector briefing (locked sectors show **LOCKED / MANDATE / HUNTING** map labels from Progression Spine access state).
- **Breach Grade** selector (playable I–III) and **Pinned Goals** strip on the sector briefing.
- Operation tab: lifecycle status, run window, **reward preview**, contribution rules, progress (`current/required` + %), and recent **operation intel** log lines.
- Anchor tab; compact **selected contract** summary with sponsor perks (`SelectedContractSummary`).
- Sector threat/reward/echo/anchor/resource readouts.
- Sector compatibility markers for the selected contract (`getContractSectorCompatibility`).
- Deployment confirmation modal (operation lifecycle, **operation reward preview**, sponsor perks when applicable, selected breach grade).
- Initiate Breach call to action (blocked when sector locked or contract min grade exceeds selected grade).

The main deploy/start-run button is consolidated here. Veil Front does **not** show the full contract board.

See **Progression Spine (Phase 1)** for Runner Clearance, sector access mandates, grades, and pinned goals.

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

**Veil Front surfaces:** Active operation/anchor cards, sector intel (operation type + lifecycle), briefing tabs, deploy confirmation (reward preview + contribution hints + echo intel), operation intel log, ECHO RECOVERY contribution hints on active operation card, **crisis banner** (procedural director explainability: pressure chips, likely signals/rewards, active sector aftermath chips).

**Debrief surfaces:** `+N progress this run` headline, mid-incursion transmission, per-type completion effect lines, community progress bar, sector crisis block, **sector aftermath block** (new/refreshed modifiers with intensity + duration).

### Run World Brief + Procedural Director + Sector Aftermath (v1)

At deploy, `buildRunGenerationContext()` builds a unified **Run World Brief** — a procedural snapshot of the sector's crisis theme, threat profile, resource stress, scanner/encounter/reward biases, and operation/contract lean. The **Procedural Director** validates that snapshot, scores run pressure, ensures crisis manifestations are wired, applies safety caps, and attaches explainability metadata to the brief.

**Sector Aftermath** is a separate lightweight layer: short-lived (1–3 run) modifiers that persist on `WorldStatePersistedState.sectorAftermathModifiersBySector` and bias the *next* deploy's brief. Aftermath is generated once per run from debrief signals (not at deploy).

**Aftermath types (10):**

| Type | Typical trigger | Stack mode | Effect summary |
|------|-----------------|------------|----------------|
| `ANCHOR_PRESSURE_REDUCED` | Anchor suppressed / signals cleared / Anchor Assault complete | refresh | Lower anchor scanner pressure |
| `ECHO_ACTIVITY_QUIETED` | Echo nodes resolved / Echo Recovery complete | refresh | Quieter echo overlays + resonant reward bump |
| `RESOURCE_VEINS_EXPOSED` | Resource Survey complete / stress-aligned extracts | refresh | High-value resource scanner + sector resource rewards |
| `ROUTES_STABILIZED` | False extraction stabilized / clean extraction | refresh | Clearer extraction overlays |
| `DIRTY_WAKE` | Emergency recall / dirty extraction | intensify | Rival merc weight + rival pressure |
| `UNSTABLE_SCENT` | Unstable cargo extracted / overharvest | intensify | Unstable cargo encounter weight |
| `CONTAINMENT_LEAK` | Appraisable/sealed contraband extracted | refresh | Containment pressure + rare loot bias |
| `RIVAL_ATTENTION` | Contraband extracted / contract paid | intensify | Rival merc weight + rare loot |
| `ELITE_SUPPRESSION` | Boss/elite clears / Boss Suppression op | refresh | Lower elite weight |
| `OPERATION_MOMENTUM` | Operation completed / large progress gain | refresh | Operation signal bias + rare loot |

**Rules:** Max **3** active modifiers per sector. Duplicate `stackKey` either **refreshes** duration or **intensifies** (cap intensity 3). Merge evicts oldest when over cap. Modifiers tick down only for the **sector that just completed a run** (not all sectors). Idempotency via `aftermathMeta.lastAftermathRunId`.

**Pipeline:**
1. Run ends → `buildOperationDebriefPayload()` captures `aftermathInput` from incursion state.
2. Debrief shows **Sector Aftermath** preview (rule matches before persistence).
3. On debrief close → `applyPostRunAftermath(aftermathInput)` merges modifiers; hub log lines for created/refreshed/expired.
4. Next deploy → director applies active aftermath to brief (`generationDebug.appliedAftermathIds`); Veil Front crisis banner shows active aftermath chips.

**Key files:** `runWorldBriefEngine.ts`, `proceduralDirectorEngine.ts`, `proceduralAftermathEngine.ts`, `proceduralAftermathCatalog.ts`, `proceduralAftermathDebriefAdapter.ts`, `runWorldBriefDebriefEngine.ts`, `SectorBriefingPanel.tsx`, `OperationDebriefScreen.tsx`.

**Dev tooling (Dev Test hub):** `[ DIRECTOR REPORT ]`, `[ SIM 100 DIRECTED BRIEFS ]`, `[ SIM AFTERMATH ]`, `[ SIM 10-RUN AFTERMATH ]`, `[ VALIDATE AFTERMATH ]`, `[ EXPIRE ALL AFTERMATH ]`, `[ PROC MEMORY REPORT ]`.

**Not in scope (v1):** Faction territory, online sync, permanent world-state mutation beyond brief biases, player-snapshot echoes.

### Black Market

Black Market is a hub screen with two internal tabs:

- Forge: crafting bench for augments and consumables (weapon unlocks/upgrades live on Loadout → Weapon Chassis, not Forge).
- Vendor: contraband cargo/consumable shop.

Vendor stock includes Soul Core as an always-stocked item plus a rotating pool of combat and scanner tools.

**Fence (v1):** Hub Vendor tab lists fence-eligible stash resources via `listFenceableStashEntries` + `sellFenceResource` → `applyFenceSale`. Post-run cargo routing uses the same `creditFenceSale` path for immediate fencing during debrief (`postRunCargoRoutingEngine.ts`). In-run Black Market fences consumable cargo only (not registry resources).

### Post-Run Cargo Routing v1 (Phases 1–10)

After successful extraction, stable materials auto-stash. Special cargo requires manual routing on the debrief **Cargo Routing** step (skipped when no special cargo is present).

**Special cargo:** UNSTABLE, INTEL, CONTRABAND, contract targets, operation targets (even when category is STABLE).

**Routing actions:** Keep in Stash, Deliver to Sponsor, Accept Rival Offer (when generated), Sell to Black Market, Contribute to Operation, **Appraise** (sealed cargo, pre-decision), **Open / Crack** sealed casket (band-weighted reward table; opening fee waived if appraised).

**Sealed cargo at routing:** Sealed Containment Caskets show state, value band (after appraisal), sell/open fees, and contract warnings. Appraisal deducts credits immediately and refreshes routable item metadata. Opening may spawn **secondary routable resources** (auto-routed with default decisions after confirm).

**Partial routing (Phase 4):** Stackable items (e.g. Tarnished Dog Tags) support routing a subset; remainder auto-keeps in stash.

**Polish pass (Phase 5):** Live projected outcome preview, inline validation, error handling, fence payout labels, casket reward breakdown, expanded dev sims, routable-item validation in debug validate.

**Veil Front + hub intel (Phase 6):** `cargoRoutingIntelEngine.ts` surfaces post-run routing expectations on deploy confirmation, sector briefing (CARGO ROUTING block), contract tab (POST-RUN DELIVERY for resource contracts), operation contribution hints (debrief contribute), Black Market fence copy, and `validateCargoRoutingIntelReferences` in the validation pipeline.

**Integration pass (Phase 7):** `postRunCargoRoutingRunState.ts` tracks special cargo acquired/banked per run; `buildExtractCargoRoutingDebriefSummary` wires through `runDebriefEngine` as `cargoRoutingSummary` (SUMMARY + OPERATION deferred contribution lines); hub Contract Board POST-RUN DELIVERY hints; safehouse + extraction review intel; in-run scanner special-cargo telemetry; `careerCargoRouting` account persistence; `validateAllSpecialCargoRoutingFixtures` in global validation; dev `[ LOG CARGO ROUTING STATE ]`; removed unused `depositAutoStashResources`.

**Polish + shipping pass (Phase 8):** `recordPendingRoutingAtExtract` wired at extract finalize; CONTRACT debrief POST-RUN DELIVERY hints before ROUTING step; hub log on routing confirm (outcomes + contract pending/paid); enriched death cargo resolution with run telemetry; REWARDS career routing totals; loadout CARGO pre-run hints; `CargoPressurePanel` SPECIAL CARGO strip in run chrome; SUMMARY acquired/banked telemetry lines.

**Final v1 audit pass (Phase 9):** `postRunCargoRoutingAuditEngine.ts` mirrors encounter catalog audit (`verifyPostRunCargoRouting` + `auditReportPostRunCargoRouting` + `__DEV__` boot verify); validation pipeline extended with sealed-casket reward table checks, default-apply integrity, synthetic routing sim scenarios, and career-stats validation; `formatSessionCargoRoutingDebriefLines` + `formatActiveContractCargoDeliveryHints` unify debrief copy; `formatCareerCargoRoutingDebugSnapshot` for dev inspect; cargo grid overlay surfaces SPECIAL CARGO; debrief REWARDS splits THIS RUN vs CAREER routing; dev `[ AUDIT ROUTING ]` + enriched `[ VALIDATE ROUTING ]` / `[ INSPECT STATE ]`; global validation report appends routing audit stats.

**Cleanup + ship pass (Phase 10):** `verifyPostRunCargoRoutingEngine()` central aggregator + `verifyLegacyRoutingCleanup()`; shared `contractExtractionKind.ts` + `postRunCargoRoutingFixtures.ts` dedupe extraction-kind and test-ledger helpers; removed dead exports (`buildPendingDeliveryContractResult`, `previewSplitForTestResources`); consolidated contract delivery hint formatters; compact death debrief REWARDS shows cargo resolution instead of auto-stash copy; `activeContract` on debrief payload enables POST-RUN DELIVERY hints without routing state; compact REWARDS shows unstable cargo lost lines.

**Contract delivery:** Resource contracts enter `PENDING_DELIVERY` until sponsor delivery is confirmed in routing. Keeping, fencing, or redirecting contract cargo prevents original sponsor completion; betrayal v1 applies reputation consequences (see Bribes + Betrayal v1).

**Extraction flow:** `useDescentNavigator.finalizeSectorExtraction` excludes pending resources from `persistRunExtraction`, defers contract rewards and world tick until routing completes.

**Key files:** `postRunCargoRoutingEngine.ts`, `postRunCargoRoutingRunState.ts`, `cargoRoutingIntelEngine.ts`, `sealedCasketAppraisalEngine.ts`, `sealedCasketOpenEngine.ts`, `sealedCargoEngine.ts`, `sealedCargoHubEngine.ts`, `runDebriefCargoRoutingEngine.ts`, `postRunCargoRoutingValidation.ts`, `postRunCargoRoutingAuditEngine.ts`, `postRunCargoRoutingFixtures.ts`, `contractExtractionKind.ts`, `CargoRoutingPanel.tsx`, `OperationDebriefScreen.tsx`, `VeilFrontDeployConfirmModal.tsx`, `SectorBriefingPanel.tsx`, `ContractBoardPanel.tsx`, `SafehouseBlackMarketTab.tsx`, `ExtractionReviewScreen.tsx`.

**Veil Front surfaces:** Deploy confirmation Cargo Routing row, sector briefing CARGO ROUTING intel block, operation CONTRIBUTES chips for debrief contribution, contract POST-RUN DELIVERY hints, recommended sector tags for fence-value / post-run contribution runs.

**Post-run cargo routing v1 — acceptance criteria (Phases 1–10):**

1. ✅ Successful extraction opens Cargo Routing when special cargo is present.
2. ✅ Stable resources auto-stash by default.
3. ✅ Unstable cargo routable (keep / deliver / sell / contribute when valid).
4. ✅ Intel items routable when valid.
5. ✅ Contraband routable when valid.
6. ✅ Smuggler's Ledger behaves as INTEL / FENCE_VALUE (not crafting).
7. ✅ Tarnished Dog Tags stackable INTEL / FENCE_VALUE with partial routing.
8. ✅ Sealed Containment Casket — appraisal, band-weighted open table, sell sealed, hub + routing surfaces.
9. ✅ Contract cargo deliverable to sponsor for payout/reputation.
10. ✅ Keeping/selling contract cargo prevents contract completion.
11. ✅ Operation target cargo contributable for operation progress.
12. ✅ Hub Black Market sells fence-eligible stash items.
13. ✅ Sold items grant credits and leave inventory.
14. ✅ Routed items cannot be duplicated (validation in `postRunCargoRoutingValidation.ts`).
15. ✅ Debrief clearly shows where each valuable item went (outcome lines + projected preview).
16. ✅ Death destroys unbanked cargo (no manual routing on death); clearer banked vs lost messaging.
17. ✅ Banked safehouse cargo survives death (existing flow).
18. ✅ Bribes + Betrayal v1 — rival offers, fencing betrayal, reputation hooks (see below).
19. ✅ No full appraisal/unboxing animation system.
20. ✅ Existing runs remain playable (compact debrief when no routing; ROUTING step skipped).
21. ✅ Runtime integrity validation on `applyPostRunCargoRouting` in `__DEV__`.
22. ✅ Operation progress after debrief reflects cargo routing contribution.
23. ✅ Routing confirm disabled until decisions validate; errors surfaced to player.
24. ✅ Dev validate includes routable-item action checks for active pending cargo.
25. ✅ Veil Front deploy + briefing explain post-run cargo routing expectations.
26. ✅ Resource contracts show post-run delivery hints on contract tab.
27. ✅ Black Market fence copy distinguishes hub stash sales vs debrief routing.
28. ✅ Cargo routing intel references validated in `validateCargoRoutingIntelReferences`.
29. ✅ `cargoRoutingRunState` tracks special cargo acquired/banked during runs.
30. ✅ Extract debrief SUMMARY shows structured cargo routing preview before ROUTING step.
31. ✅ OPERATION step shows deferred contribution lines when routing is pending.
32. ✅ Hub Contract Board shows POST-RUN DELIVERY hints for resource contracts.
33. ✅ Safehouse + extraction review explain banking vs post-run routing.
34. ✅ Scanner telemetry surfaces held special cargo count.
35. ✅ `careerCargoRouting` persists routing career totals on player account.
36. ✅ Global validation includes synthetic routable-item fixtures for all special resources.
37. ✅ Dev panel includes `[ LOG CARGO ROUTING STATE ]`.
38. ✅ Unused `depositAutoStashResources` dead code removed.
39. ✅ `pendingRoutingStacksAtExtract` stamped at extract finalize.
40. ✅ CONTRACT debrief step shows POST-RUN DELIVERY hints before ROUTING.
41. ✅ Hub log emits cargo routing outcomes on routing confirm (not only debrief exit).
42. ✅ Death debrief CARGO RESOLUTION includes special-cargo run telemetry + extract-only routing note.
43. ✅ REWARDS step shows full career routing totals after routing apply.
44. ✅ Loadout CARGO tab shows pre-run special cargo count + routing reminder.
45. ✅ In-run cargo pressure chrome surfaces SPECIAL CARGO alongside unstable effects.
46. ✅ SUMMARY shows special acquired/banked telemetry before ROUTING step.
47. ✅ `verifyPostRunCargoRouting` throws on pipeline errors; `__DEV__` boot warns on failure.
48. ✅ `auditReportPostRunCargoRouting` reports catalog coverage stats (special/fence/contract/operation/hub-open/partial).
49. ✅ Validation pipeline includes sealed-casket reward table, default-apply integrity, and synthetic routing sim scenarios.
50. ✅ `validateCareerCargoRoutingStats` guards account career routing totals.
51. ✅ Debrief REWARDS shows THIS RUN routing lines separate from CAREER totals.
52. ✅ Cargo grid overlay passes special cargo stacks to `CargoPressurePanel`.
53. ✅ Dev `[ AUDIT ROUTING ]` surfaces audit report; `[ VALIDATE ROUTING ]` includes career stats.
54. ✅ `[ INSPECT STATE ]` appends `formatCareerCargoRoutingDebugSnapshot`.
55. ✅ Global `devGetValidationReport` appends routing audit stats alongside pipeline validation.
56. ✅ `verifyPostRunCargoRoutingEngine()` centralizes pipeline + legacy cleanup verify on boot.
57. ✅ Shared `resolveContractExtractionKind` replaces duplicated extraction-kind helpers.
58. ✅ Test routing fixtures consolidated in `postRunCargoRoutingFixtures.ts` (no duplicate ledgers).
59. ✅ Dead routing exports removed (`buildPendingDeliveryContractResult`, `previewSplitForTestResources`).
60. ✅ Contract delivery hint formatters share one core implementation.
61. ✅ Compact death debrief REWARDS shows banked/lost cargo resolution (not auto-stash copy).
62. ✅ `activeContract` on debrief payload enables POST-RUN DELIVERY hints without routing state.
63. ✅ Compact REWARDS shows unstable cargo lost lines on death runs.

### Bribes + Betrayal v1

Post-run cargo routing for **eligible contract cargo** can generate **rival sponsor bribe offers** and betrayal outcomes. Sponsors are employers, not faction owners — betrayal affects trust/reputation, not territory or lockout.

**When betrayal applies:** active sponsor contract + recovered contract-relevant cargo + successful extract/bank + post-run routing step. No betrayal if the player dies before banking/extracting, has no contract, or cargo is ineligible.

**Routing outcomes (contract cargo):**

| Action | Contract result | Severity | Original sponsor rep |
|--------|-----------------|---------|----------------------|
| Deliver to sponsor | COMPLETE | NONE | via normal contract payout |
| Accept rival offer | BETRAYED_TO_RIVAL | HARD | −2 |
| Sell to Black Market | FENCED_TO_BLACK_MARKET | SOFT | −1 |
| Keep in stash | KEPT_BY_PLAYER | FAILURE (SOFT if tracked) | 0 / −1 |
| Contribute to operation | CONTRIBUTED_TO_OPERATION | SOFT if tracked | 0 / −1 |
| Open / crack sealed | FAILED | FAILURE (SOFT if tracked) | 0 / −1 |

**Eligible cargo:** UNSTABLE, INTEL, CONTRABAND, APEX_CARGO, CONTRACT_TARGET resources (not common stable mats). Tarnished Dog Tags fence but do not roll major rival bribes. `trackedContractCargo` flag on apex/contraband/sponsor-specific targets. Opening a contract casket prevents sealed delivery.

**Bribe generation:** at routing item build — chance 25% / 40% (unstable+intel) / 70% (apex+contraband); max **one rival offer per item**; Black Market always available when `FENCE_VALUE`. Rival rewards ~135% credits, ~175% rep vs contract base, sponsor-flavored bonus materials.

**Persistence:** `sponsorTrustStats` (completed/failed/betrayed/bribes/cargo counters), `betrayalHistory` (Betrayer Echo hook: `canGenerateBetrayerEchoLater` on hard betrayal), extended `careerCargoRouting` (`deliveredToRival`, `contractsBetrayed`).

**Debrief:** CONTRACT step shows outcome kind, final destination, and **Betrayal Summary** when applicable. Cargo Routing panel shows rival offer card, projected rep/credits, and per-action warnings.

**Mid-run flavor (optional):** `collectMidRunBribeFlavorMessages` for intercepted buyer signals when contract cargo is picked up — decision remains at routing.

**Key files:** `bribeOfferEngine.ts`, `contractBetrayalResolver.ts`, `betrayalConsequencesEngine.ts`, `betrayalValidationEngine.ts`, `betrayalDebugEngine.ts`, extended `postRunCargoRoutingEngine.ts`, `CargoRoutingPanel.tsx`, `OperationDebriefScreen.tsx`.

**Explicitly not in v1:** faction territory, sponsor-owned sectors, PvP, Betrayer Echo spawning, permanent sponsor lockout, hard faction hostility.

**Acceptance criteria:**

1. ✅ Eligible contract cargo can generate alternate routing offers at debrief.
2. ✅ Rival sponsor delivery action with payout + rival rep.
3. ✅ Black Market fence of contract cargo fails original contract + grants credits.
4. ✅ Keeping contract cargo fails contract without crash.
5. ✅ Operation contribution works when operation accepts resource.
6. ✅ Contract result states include betrayal/fence/keep/contribute outcomes.
7. ✅ Cargo cannot duplicate across destinations (integrity validation).
8. ✅ Honor delivery completes contract normally.
9. ✅ Rival delivery betrays original contract and rewards rival.
10. ✅ Fence betrays/fails contract and grants credits.
11. ✅ Sponsor trust + reputation tracked on account.
12. ✅ Debrief explains final cargo destination and betrayal.
13. ✅ Betrayal events recorded for future Betrayer Echo hooks.
14.–20. ✅ No territory/PvP/lockout; existing runs and extraction/death rules intact.

### Enemy + Encounter Depth Identity v1 (Phase A)

Depth stages already map to Threshold / Breach / Deep Veil. Phase A freezes **run identity** when each depth begins so later encounter/enemy work can read Distortion and Law state.

**Depth 2 — Veil Distortion (exactly one):** Bleeding Architecture, Memory Contamination, Predatory Geometry, Unstable Matter, Ritual Pressure. Weighted by sector biome, active Anchor, Operation, echo activity, and resource focus.

**Depth 3 — Deep Veil Law (exactly one):** The Veil Remembers, The Walls Are Hungry, The Roads Are Looping, The Machine Is Praying, The Sky Is Underground. ~55% chance to **intensify** the Depth 2 Distortion into its mapped Law; otherwise weighted by sector/anchor/operation.

**Surfaces:** safehouse district intel, depth-entry toast (`DepthIdentityToast`), run log, debrief **DEPTH EFFECTS**.

**Persistence:** `ActiveIncursionState.depthIdentity` (`activeVeilDistortion`, `activeDeepVeilLaw`, `intensifiedFromDistortion`, `pendingReveal`).

**Scanner hooks (Phase A):** Distortion/Law scan biases multiply Anchor / Operation / High-Risk / High-Value rolls at node engagement via `resolveActiveDepthIdentityScanBias`.

**Not in Phase A:** twisted encounter templates, encounter modifiers, enemy variants, full scanner label degradation UI, Depth 3 encounter templates.

**Key files:** `types/depthIdentity.ts`, `depthIdentityCatalog.ts`, `veilDistortionEngine.ts`, `deepVeilLawEngine.ts`, `depthIdentityEngine.ts`, `depthIdentityDebugEngine.ts`, `runDebriefDepthIdentityEngine.ts`, `DepthIdentityToast.tsx`.

**Phase A acceptance:** Distortion+Law generation, UI/debrief/debug, engagement scan bias, playable saves with null `depthIdentity`.

### Enemy + Encounter Depth Identity v1 (Phase B)

Phase B adds **encounter modifiers** — at most one per node — so Depth 2/3 combat and anomaly engagements feel rule-warped without new enemy templates yet.

**Roll chances:** Depth 1 none (catalog has no D1-eligible mods); Depth 2 ~28% base on eligible combat/anomaly/resource nodes; Depth 3 ~48% base. Distortion/Law favoritism, High-Risk, Anchor/Operation tags, and pending UNSTABLE pressure nudge chance and weights. **CORE_SICK** is Depth 3 only.

**Modifiers:** MIRRORED, BLEEDING, UNSTABLE, FOLDED, STARVED, RESONANT, CORE_SICK.

**Combat hooks (v1):**
- MIRRORED — first kill reflects minor occult pressure
- BLEEDING — every 3rd hostile cycle taxes the operative
- STARVED — heal received ×0.65 this encounter
- FOLDED — one unit starts evade-phased (clears when struck)
- CORE_SICK — one unit gains Anchor-sick HP bump
- RESONANT — enemy outgoing damage +15%
- UNSTABLE — on clear, next engagement elevates High-Risk

**Surfaces:** scanner `MOD // …` signal, encounter banner telegraph, combat intro log, debrief DEPTH EFFECTS (seen/cleared), DevTest force/print/validate.

**Key files:** `encounterModifierCatalog.ts`, `encounterModifierEngine.ts`, `encounterModifierCombatEngine.ts`, lazy roll via `lazyNodeContextEngine` / `nodeGenerationContextEngine`.

**Not in Phase B:** twisted Depth 2 templates, Depth 3 encounter templates, enemy variants / spawn table rewrites.

### Enemy + Encounter Depth Identity v1 (Phase C)

Phase C overlays **five Depth 2 twisted encounter templates** onto existing node types (not new core types).

| Template | Base node | Resolution |
|----------|-----------|------------|
| Corrupted Sanctuary | SANCTUARY | Rest / Purge / Listen / Leave modal |
| False Extraction Signal | Safe-anchor extract | Attempt intercept / Stabilize / Ignore |
| Resource Bloom | RESOURCE / ANOMALY | Careful / Overharvest / Burn / Leave |
| Mirror Combat | COMBAT / ELITE | Auto-stamps MIRRORED modifier |
| Anchor Vein | ANOMALY / RESOURCE / COMBAT / ELITE | Sever / Harvest / Stabilize / Ignore |

**Rules:** Depth 2 primary (rare on D3), max 1 of each template per run, Distortion-favored weights, costs shown before confirm via `TwistedTemplateChoiceOverlay`.

**Surfaces:** scanner `TWIST // …`, encounter banner, engagé log, debrief DEPTH EFFECTS, DevTest force/print/validate.

**Key files:** `twistedTemplateCatalog.ts`, `twistedTemplateEngine.ts`, `twistedTemplateResolutionEngine.ts`, `TwistedTemplateChoiceOverlay.tsx`.

**Not in Phase C:** Depth 3 templates, enemy variants, full scanner label degradation.

### Enemy + Encounter Depth Identity v1 (Phase D)

Phase D adds **six Depth 3 Deep Veil templates** into the same twisted-template pipeline (max 1 each per run; never replace the boss).

| Template | Base node | Notes |
|----------|-----------|--------|
| Anchor Core Breach | Elite / Anomaly / Combat | Ops surge / skim / withdraw; high danger telegraph |
| Veil Proper Cache | Resource / Anomaly | Greed cache — unstable/rare rolls, never guarantee Apex |
| No-Exit Sanctuary | Sanctuary | Harsher Rest / Bargain / Cut Power / Leave |
| Final Route Fracture | Safe-anchor extract | Force intercept / Hold clean / Abort (no soft-lock) |
| Reality Tax | Anomaly | Pay HP / CR / stable / unstable, or refuse into High-Risk |
| Apex Shadow | Elite / Combat | Auto CORE-SICK + High-Risk foreshadow (not a full boss) |

**Key files:** extended `twistedTemplateCatalog.ts` / `twistedTemplateEngine.ts` / `twistedTemplateResolutionEngine.ts`.

**Not in Phase D:** enemy variants, full scanner label degradation UI.

### Enemy + Encounter Depth Identity v1 (Phase E)

Phase E adds **Depth 2 enemy variants**, confirms **Depth 3 exclusives**, tunes **rival merc rarity**, and ships **Depth 3 elite tag variants** as explicit IDs (parent AI/sprites reused).

**Depth 2 variants (8):** Weeping Gargoyle, Phase Scuttler, Remembering Thrall, Tar Choir, Static Caller, Blood-Rusted Golem, Rootbound Weeper, Anchor Husk (Anchor Signal / Operation Target inject only).

**Depth 3 elite tags (6):** Core-Sick Amalgam, Void-Lock Memory Leech, Grave-Engine Churn, Null-Crown Shade, Choir-Bound Resonance Caster, Rift-Spike Sniper.

**Spawn rules:** Variant `spawnGates.allowedDepths` exclude Depth 1; D3 exclusives (incl. Hollow Lung / Grave Robber + elite tags) stay off D1/D2. Rival merc weights ~32/18/8% NORMAL by depth. Anchor Husk prefers ANCHOR node tier + post-squad inject (~42%).

**Combat hooks (soft):** parental lifecycle kits + light extras (weeping fracture pulse, phase slip, tar mark, static melee stamina tax, husk ally damage buff, remembering reform).

**Surfaces:** combat intro VARIANT / DEEP TAG logs, DevTest print/validate, `verifyDepthEnemyVariants` in encounter generator verify.

**Key files:** `depthEnemyVariantCatalog.ts`, `depthEnemyVariantCombatEngine.ts`, `depthEnemyVariantSpawnEngine.ts`, `depthEnemyVariantValidationEngine.ts`, roster/defs/pools updates.

**Not in Phase E:** scanner label degradation (Phase F), full debrief flavor pass (Phase G).

### Enemy + Encounter Depth Identity v1 (Phase F)

Phase F makes scanner readouts depth-aware: label certainty bands, Distortion/Law overlay bias (including Echo), and an anti-stack rule against scanner lies + untelegraphed lethal.

**Label certainty:** D1 ~2% degrade · D2 ~12% · D3 ~24%, plus Distortion/Law `scannerLabelDegradeChance` (cap 55%). Outcomes: RELIABLE / DEGRADED (nearby wrong type) / STRANGE (actionable weird phrase). Gatekeeper never lied. Null-Lens / fully interpreted nodes show truth.

**Overlay bias:** Existing engagement multipliers for Anchor / Op / High-Risk / High-Value stay; Echo layer unlock now multiplies by Distortion/Law `echoSignalMultiplier`. Null-Lens rolls pass the same identity bias.

**Anti-stack:** False Extraction / Final Route clear type corruption (they own the lie). Other lethal stamps (`FOLDED`, `CORE_SICK`, Apex Shadow, etc.) force a HIGH RISK telegraph when a corrupt label is present.

**Surfaces:** `> SCAN CERTAINTY:` on dock readout, DevTest print/validate, `verifyScannerLabelCertainty`.

**Key files:** `scannerLabelCertaintyCatalog.ts`, `scannerLabelCertaintyEngine.ts`, `scannerLabelCertaintyValidationEngine.ts`.

**Not in Phase F:** full sector×depth flavor strings / debrief Depth Effects polish (Phase G).

### Enemy + Encounter Depth Identity v1 (Phase G)

Phase G closes the identity pass with **sector×depth flavor**, **debrief Depth Effects polish**, **Dev force/debug tools**, and **consolidated hard-rule validation**.

**Sector × depth flavor:** `SECTOR_DEPTH_VISUAL_THEMES` for all 5 biomes × depths 1–3 (label + one-line flavor). Surfaces on encounter biome banner (`DEPTH FLAVOR //`) and Operation Debrief Depth Effects.

**Debrief Depth Effects:** Distortion/Law copy, twisted outcomes, Depth 2 variant / Depth 3 exclusive kill tallies, depth-identity op progress, and the sector depth flavor line.

**Dev tools:** force Depth 2/3 enemy variants into next combat spawn; print biome×depth pools and sector flavor; simulate Distortion/Law generation; list unseen twisted templates; `validatePhaseG` / `verifyPhaseGHardRules` (Gargoyle Null Zone only, flavor completeness, plus hard-counter / catalog / variant / scanner verifies).

**Boot:** `verifyEncounterGenerator` calls `verifyPhaseGHardRules`.

**Key files:** `sectorDepthVisualCatalog.ts`, `depthIdentityPhaseGDebugEngine.ts`, `runDebriefDepthIdentityEngine.ts`, `EncounterBiomeBanner.tsx`, DevTest hub buttons.

### Encounter Composition + Reward / Readability Polish v1 (Phase A)

Phase A installs the **composition spine**: every enemy has a primary composition role, 10 role-slot templates exist, fairness validation blocks stacked disable/artillery/true-damage in normal fights, and procedural spawn **prefers template→role fill** with the existing synergy deck as fallback.

**Roles:** BRUISER / DISRUPTOR / ASSASSIN / SUPPORT / ARTILLERY / SWARM / ANCHOR_LINKED / ECHO_SPECIAL / RIVAL_MERC / BOSS — separate from spatial `EncounterRole` (FRONTLINE/BACKLINE).

**Templates:** Simple Patrol, Resource Guard, Anchor Patrol, Echo-Contaminated, Elite Nest, Artillery Killbox, Support Core, Swarm Pressure, Boss Foreshadowing, High-Risk Cargo Guard. Overlays (high-value / high-risk / anchor / echo / elite) bias template weights.

**Spawn:** `pickProceduralSynergySquad` tries `tryPickCompositionSquad` first; on failure uses the deck pipeline. Hard-counter + threat budget still apply.

**Boot:** `verifyEncounterCompositionPhaseA` via `verifyEncounterGenerator`.

**Key files:** `enemyCompositionRoleCatalog.ts`, `encounterCompositionTemplateCatalog.ts`, `encounterCompositionFairnessEngine.ts`, `encounterCompositionPickEngine.ts`, `encounterCompositionValidationEngine.ts`.

**Not in Phase A:** warning cards, reward tier application, boss flavor hooks, debrief highlights, sim matrix / DevTest polish (Phases B–D).

### Encounter Composition + Reward / Readability Polish v1 (Phase B)

Phase B makes composed fights **readable before breach**: risk labels, role/reward preview stamps, pre-combat warning cards, and actionable scanner uncertainty.

**Risk labels:** LOW RISK / STANDARD / ELEVATED / HIGH RISK / ELITE / APEX WARNING — derived from depth, elite, overlays, template, modifiers, reward tier.

**Stamps:** On combat engage, `stampCompositionReadability` writes composition template / risk / roles / reward preview onto `NodeContextModifiers`. Banner shows `RISK //`, `ROLES //`, `REWARD //`. Dock adds risk category when scanner certainty is degraded/strange.

**Warning cards:** Shown for modifier / twist / elite / high-risk / anchor (D2+) / template-flagged fights via `EncounterWarningCardOverlay` ([Enter Combat] / [Back]). Scanning engage waits on the card instead of auto-routing to combat.

**Scanner copy:** Strange labels always include a decision class (Combat Likely, Elite Pressure, Contaminated Exit, etc.) — never blank "???".

**Key files:** `encounterCompositionReadabilityEngine.ts`, `EncounterWarningCardOverlay.tsx`, `IncursionShell.tsx`, `ScanningScreen.tsx`, scanner label catalog + `descentEngine` dock lines.

**Not in Phase B:** reward tier loot application, boss flavor hooks, debrief highlights, sim matrix (Phases C–D).

### Encounter Composition + Reward / Readability Polish v1 (Phase C)

Phase C applies stamped reward tiers to combat payouts and adds light Gatekeeper / depth / anchor flavor — no boss rewrite.

**Reward tier → payout:** On victory, `compositionRewardTier` scales credits (`applyCompositionCreditScaling`) and feeds `grantCombatResourceDrops` / `rollCombatResourceDrops` with rare-loot bonus %, template/biome extras (`compositionExtraLootIds`), and elevated rare rolls for HIGH_VALUE+. High-value / echo / anchor node overlays bias extras (Echo-Glass, Ley-Slag, sector tech pools).

**Boss flavor hooks:** `prepareBossEncounter` logs depth-identity / law / anchor / operation lines via `encounterBossFlavorEngine` plus optional arena labels. Boss victory uses `resolveBossFlavorRewardTier`, soft credit bump (`bossFlavorCreditBonus`), and soft rare-loot bump — Gatekeeper kit unchanged.

**Key files:** `encounterCompositionRewardEngine.ts`, `encounterBossFlavorEngine.ts`, `combatRewardEngine.ts` (`CombatRewardContext`), `CombatScreen.tsx` victory, `RunContext.tsx` `prepareBossEncounter`.

**Acceptance unlocked:** 11–13 (high-risk better rewards; clear elite/anchor/echo/resource profiles; boss/depth/anchor flavor without rewrite).

**Not in Phase C:** sim matrix, content report, DevTest audit tools, debrief encounter highlights (Phase D).

### Encounter Composition + Reward / Readability Polish v1 (Phase D)

Phase D closes the composition pass with **QA / audit tooling**, a **content matrix**, and **debrief Encounter Highlights**.

**Sim matrix:** `debugSimulateCompositionMatrix` rolls biomes × depths × tier cells through `tryPickCompositionSquad`, reporting composition hit rate, template/reward/role distributions, unfair hits, and invalid loot refs. `debugSimulateCompositionSectorRun` walks a 15-node mock sector run.

**Content report:** `formatCompositionContentReport` lists enemy-role coverage, template count, reward profiles, modifiers/twisted/variant/scanner counts, and validation error/warn totals — also appended to the integration CONTENT MATRIX button.

**DevTest:** Force Artillery / Echo Contaminated / Elite Nest (+ clear), print templates/roles, preview warning card, sim matrix/run, content report, validate composition (Phase A+D).

**Telemetry + debrief:** `compositionRunState` records seen/cleared templates, risk/reward tiers, overlay clears, and warning cards. Debrief shows optional **ENCOUNTER HIGHLIGHTS** (hardest clear, notable templates, elevated clears, signal clears, reward tiers, false extraction).

**Validation:** `validateEncounterCompositionPhaseD` checks reward resource IDs and high-risk/baseline mismatches; `verifyEncounterComposition` (boot via `verifyEncounterGenerator`) runs Phase A + D error gates + light per-biome smoke.

**Key files:** `encounterCompositionDebugEngine.ts`, `encounterCompositionTelemetryEngine.ts`, `encounterCompositionValidationEngine.ts`, `runDebriefEncounterCompositionEngine.ts`, `DevTestHubPanel.tsx`, `OperationDebriefScreen.tsx`, `contentMatrixEngine.ts`.

**Acceptance unlocked:** 18–20 (debug sim / content report / debrief highlights) plus consolidated validation polish for the composition system.

### Appraisal + Sealed Cargo v1

**Sealed Containment Casket** is the primary appraisable contraband item. **Blacksite Specimen Jar** is the lower-tier sibling — same Appraise / Open / Sell Sealed / Deliver Sealed pipeline, softer fees and sell bands, and its own open reward table.

Players can inspect value **without consuming** sealed cargo, then choose to open, sell sealed, deliver sealed (contract), or stash.

**Value bands (appraisal roll):** LOW → STANDARD → HIGH → RARE → APEX. Bands affect sell-sealed payout and **open reward tier weights**.

| Container | Unappraised sell | Appraisal / Open fees | Sell band range |
|-----------|------------------|-----------------------|-----------------|
| Containment Casket | 150 CR | 50 / 100 (waived if appraised) | 125–500 CR |
| Specimen Jar | 80 CR | 30 / 50 (waived if appraised) | 60–250 CR |

**Casket open tiers:** Common / Uncommon / Rare Tech / Unstable / Apex / Dud.

**Specimen Jar open tiers:** Common / Biologic / Unstable / Seal / Breach / Dud — contents lean Mycelial, Sanguine, Veil-Ash, Ley-Knot, Containment Seal, rare Breach Thread (never guaranteed Anomalous Core).

**Hub (Black Market):** **APPRAISAL // SEALED CARGO** lists per-stack caskets **and** jars from `sealedCargoStacks` metadata.

**Post-run routing:** Same actions on debrief Cargo Routing; opening may deposit stable loot to stash and queue **special generated resources** for a secondary routing pass.

**Persistence:** `sealedCargoStacks` (per-stack resourceId + SEALED/APPRAISED + band), `careerSealedCargo` counts cover both containers.

**Key files:** `types/sealedCargo.ts`, `sealedCasketAppraisalEngine.ts`, `sealedCasketOpenEngine.ts`, `sealedSpecimenJarOpenEngine.ts`, `sealedContainerOpenEngine.ts`, `sealedCargoEngine.ts`, `sealedCargoHubEngine.ts`, `sealedCargoValidationEngine.ts`, `sealedCargoDebugEngine.ts`, extended `postRunCargoRoutingEngine.ts`, `CargoRoutingPanel.tsx`, `OperationDebriefScreen.tsx`, `SafehouseBlackMarketTab.tsx`, `runDebriefCargoRoutingEngine.ts`.

**Acceptance criteria:**

1. ✅ Appraise reveals value band without consuming sealed cargo.
2. ✅ Open consumes stack and rolls weighted tier table (band-aware; casket or jar table).
3. ✅ Sell sealed grants guaranteed credits (unappraised + band table per container).
4. ✅ Hub Black Market appraisal section for stash sealed stacks.
5. ✅ Post-run routing appraisal button + sealed metadata on routable items.
6. ✅ Opening fee waived after appraisal.
7. ✅ Secondary routing pass for special resources opened from sealed cargo.
8. ✅ `sealedCargoStacks` + `careerSealedCargo` persisted on account.
9. ✅ Contract open prevents sealed delivery with debrief explanation.
10. ✅ Dev validate / sim / force band+tier tooling (casket + jar).

### Loadout

Loadout is a hub screen with two internal tabs:

- **Loadout:** operative class selector, **Weapon Chassis** (family select, unlock, tier upgrade), **Expedition Relic** socket (equip 1 of 20), ability deck editor, and Run Item slots.
- **Cargo:** pre-run cargo grid and stash packing interface.

The class selector is a compact operative identity strip with class cycling. **Weapon Chassis** lists all three weapon families for the active class — unlock with stash resources, equip one per class, upgrade Tier I → II → III. Weapon is locked at descent (mid-run weapon swap disabled in v1). Expedition relic loadout and Run Items are on the same tab. Relics with deployment choices (Signal Compass attunement, Ashen Cartograph route doctrine, Mirror Writ mirrored category) require pre-run configuration before equipping.

### Expedition Relics (Trinkets v2)

**Expedition Relics** are pre-run loadout modifiers — distinct from legacy **combat trinkets** picked up mid-run (`RunState.activeTrinkets` / post-combat boon pool). Players equip **one relic** from a roster of **20** before descent; runtime state lives on `ActiveIncursionState.keepsakeRuntime`.

**Design pillars:**

- **Decisions over passives** — deployment choices, in-run modals (Dead-Drop, Extraction Token, Contract Seal clauses, Mourner's Bell, etc.).
- **No combat stat creep** — relics affect routing, cargo, economy, scanner intel, and extraction tension; they do not modify max HP, parry, or damage.
- **Once-per-run / per-depth guards** — `triggersUsed`, `perDepthTriggersUsed`, and acceptance tests prevent duplicate firing.

**Roster (20):** Signal Compass, Ashen Cartograph, Dead-Drop Receiver, Ley-Siphon Needle, Cargo Seal, Smuggler's Wrap, Black Market Mark, Null Ledger, Extraction Token, Last Light Matchbook, Contract Seal, Anchor Charm, Mourner's Bell, Grave Polaroid, Hollow Keyring, Bloodhound Tag, False Evac Beacon, Gutter Crown, Mirror Writ, Bent Nail.

**Runtime model:** `KeepsakeRuntime` tracks deployment config, trigger guards, `decisions[]`, `flags`, `counters` (matches, contamination, echo thread, scent, keys, …), `stats` (debrief lines), `messages` (trigger log), and `pendingChoice` (in-run modal queue).

**Hook domains:** scanner/route (`expeditionKeepsakeScannerEngine`, `expeditionKeepsakeRouteEngine`), cargo (`expeditionKeepsakeCargoEngine`), economy/extraction (`expeditionKeepsakeEconomyEngine`), contract (`expeditionKeepsakeContractEngine`), safehouse (`expeditionKeepsakeSafehouseEngine`), anchor/echo (`expeditionKeepsakeAnchorEchoEngine`), phase-D relics 13–20 (`expeditionKeepsakePhaseDEngine`), orchestration in `RunContext.tsx`.

**Player-facing surfaces:**

- **Hub loadout** — relic dossier (role, run style, risk, deployment warnings, configure/equip).
- **Run chrome** — `RunGlobalChrome` relic chip + live counters (match, debt, contam, thread, scent, keys).
- **Trigger toasts** — `KeepsakeTriggerToast` on new `runtime.messages`.
- **In-run choices** — `KeepsakeInRunChoiceOverlay` for pending branch modals.
- **Status overlay** — equipped relic, counters, and active risks in run manifest.
- **Debrief** — EXPEDITION RELIC block: decisions, risks, stat lines, trigger log.
- **Dev** — validate registry + acceptance, simulate debrief, force equip, deployment debug.

**Key files:** `expeditionKeepsakeRegistry.ts`, `keepsakeRunState.ts`, `expeditionKeepsakeChoiceEngine.ts`, `expeditionKeepsakeDeploymentEngine.ts`, `runDebriefKeepsakeEngine.ts`, `expeditionKeepsakeRunUiEngine.ts`, `KeepsakeLoadoutPanel.tsx`, `OperationDebriefScreen.tsx`.

**Expedition relics v2 — acceptance criteria (Phases A–F):**

1. ✅ 20-relic roster in registry with unique primary trigger keys and hook metadata.
2. ✅ v2 runtime shape: deployment, decisions, flags, counters, expanded debrief stats.
3. ✅ Account storage: `equippedKeepsakeId`, `unlockedKeepsakeIds`, `keepsakeDeployment`.
4. ✅ Loadout UI renamed to Expedition Relic; rich inspect + deployment modals (Compass / Cartograph / Mirror Writ).
5. ✅ Deployment warnings at equip/inspect time (anchor, echo, sponsor, contraband contexts).
6. ✅ Retained relics 1–12 deepened: attunement, route doctrine/lock, dead-drop chain, ley contamination, cargo seal, smuggler double-wrap, null ledger credit line, matchbook ladder, extraction token, contract clauses, anchor trail, polaroid develop.
7. ✅ New relics 13–20: Mourner's Bell, Hollow Keyring, Bloodhound Tag, False Evac Beacon, Gutter Crown, Mirror Writ, Bent Nail outside hook.
8. ✅ Live HUD counters + trigger toasts + debrief decisions/risks/stats/trigger log.
9. ✅ `verifyExpeditionKeepsakeEngine()` boot verify (registry + combat-stat audit + acceptance sims).
10. ✅ Duplication guards validated: matchbook max 4, dead-drop run-once, anchor trail run-once, per-depth false beacon, no-relic regression.
11. ✅ Runs without equipped relic remain no-ops across core hooks.
12. ✅ No relic assigns combat-stat hooks or modifies operative max HP / parry / damage.

### Run Items v2 (Combat Consumables + Field Tools)

**Run Items** are one-use clutch tools — distinct from **Bound Requisitions** (start-of-run sponsor blessings), **cargo grid loot**, and **Expedition Relics**. Players stage up to **2 combat consumables** and **2 field tools** in dedicated slots before descent; runtime state lives on `ActiveIncursionState.runItems` + `itemRuntime`.

**Design pillars:**

- **Clutch one-use effects** — healing, armor break, scanner intel, cargo banking, echo/anchor mode picks — not passive stat sticks.
- **Separate storage** — never stored in the cargo grid; bought/crafted/found items route to run item slots with replace/discard/use-now flow when full.
- **Guard rails** — 1 combat item per turn, 0 AP default, Bloodwire once/combat, Mirror-Salt once/turn, Apex cargo blocked for Dead-Drop / Containment Foam, Relay Spike cannot target boss nodes.

**Roster (24):** 14 combat consumables (Standard Coagulant through Voidglass Decoy) + 10 field tools (Broker Flashcard through Anchor Needle). Bound Requisition ids (`chalk-line-ward`, `adrenaline-primer`, `scanner-override`, `smugglers-pockets`) are **out of scope**.

**Runtime model:** `RunItemRuntime` tracks turn/combat guards, scanner noise, pending field choices, relay/dead-drop/foam/ash-seal state, `stats` (debrief lines), and `messages` (trigger log).

**Hook domains:** combat (`runItemCombatEngine`), field/scanner/cargo/market (`runItemFieldEngine`, `runItemFieldChoiceEngine`), inventory/slots (`runItemInventoryEngine`), market/crafting bridge (`runItemMarketEngine`, `runItemCraftingBridge`), orchestration in `RunContext.tsx`.

**Player-facing surfaces:**

- **Hub loadout** — `RunItemLoadoutPanel` stages crafted items into descent slots.
- **Run chrome** — `RunGlobalChrome` RUN ITEMS chip + live counters (noise, dead-drop, foam, relay, …).
- **Trigger toasts** — `RunItemTriggerToast` on new `itemRuntime.messages`.
- **Field choice modals** — `RunItemFieldChoiceOverlay` for relay/echo/anchor modes.
- **Black Market** — rotating run item subset mixed with legacy cargo listings; run items use tap-to-buy (`RunItemMarketListing` → `purchaseBlackMarketCargo`); cargo listings remain drag-to-grid. Broker Flashcard reroll.
- **Fabrication Matrix** — ALL / COMBAT / FIELD filters for registry-driven recipes; rows show market price + hub staged count.
- **Debrief** — RUN ITEMS block: brought-at-start vs remaining loadout, risks, stat lines, trigger log.
- **Dev** — validate registry + acceptance sims, full audit, grant all, simulate debrief/market/recipe gaps.

**Key files:** `runItemRegistry.ts`, `runItemRunState.ts`, `runItemCombatEngine.ts`, `runItemFieldEngine.ts`, `runItemRunUiEngine.ts`, `runDebriefRunItemEngine.ts`, `RunItemLoadoutPanel.tsx`, `OperationDebriefScreen.tsx`.

**Run Items v2 — acceptance criteria (Phases A–F):**

1. ✅ 24-item roster (14 combat + 10 field), kebab-case ids + snake_case alias map.
2. ✅ Dedicated `runItems` slots (2+2) separate from cargo grid.
3. ✅ Combat consumables: 0 AP, 1 per turn, all 14 behaviors wired.
4. ✅ Field tools: context gating, echo/anchor/relay choice modals, scanner/cargo/market hooks.
5. ✅ Slot-full replace/discard/use-now/cancel purchase flow.
6. ✅ Hub crafting from registry + market rotating subset with depth-aware rare filtering.
7. ✅ Live HUD counters + trigger toasts + debrief parity.
8. ✅ `verifyRunItemEngine()` boot verify (registry + acceptance sims).
9. ✅ Duplication guards validated: per-turn combat, Bloodwire/combat, Mirror-Salt/turn, Grave-Dust crash-once, Apex cargo blocks, Relay boss block, full-slot auto-place.
10. ✅ Empty loadout remains no-op across debrief/HUD/status helpers.
11. ✅ Bound Requisitions untouched — not registered as Run Items.

**Polish pass (post Phase F):**

- ✅ Black Market run-item purchase UX — tap-to-buy routes to dedicated slots; drag-to-grid rejected for run items with clear message; stock decrements on purchase.
- ✅ `runItemsAtRunStart` snapshot on descent — debrief shows BROUGHT vs REMAINING loadout lines.
- ✅ Run chrome chip visible when live counters or pending slot offer active (even if slots empty).
- ✅ Fabrication Matrix run-item rows show market price + hub staged count.
- ✅ Legacy duplicate cargo market entries removed for items now sold exclusively as run items (`grave-dust-ampoule`, `grid-cracker-mag`, `eclipse-flare`, `dead-drop-token`, `spall-weave-vest`). Cargo-only `coagulation-stitch` remains distinct from run-item `standard-coagulant`.

### Run Integration + Progression Audit v1

Cohesion layer — no new gameplay systems. Makes the Contract Board → Veil Front → run → debrief → hub loop auditable, readable, and testable.

**Integration engines (`src/data/runIntegration/`):**

- **`runPacingConfig`** — config-driven nodes-per-district (10 / 12 / 15 presets for run-length testing).
- **`runBalanceTelemetryEngine`** — per-run balance stats (nodes, combats, resources, echoes, contract outcome).
- **`runLoopAuditEngine`** — full-loop checklist (pre-run, run start, during run, post-run, persistence).
- **`runLoopValidationEngine`** — aggregates world, resource, contract, echo, routing, keepsake, run-item, **weapon**, and **balance** validators + content matrix.
- **`runOutcomeDetailEngine`** — granular debrief outcome labels (extracted, emergency recall, safehouse, banked-then-died, runner lost).
- **`runAnchorDebriefEngine`** — anchor activity debrief block.
- **`runCraftingOpportunityEngine`** — craft-now / nearly-ready recipe surfacing on debrief (includes weapon unlock/upgrade lines via `runDebriefWeaponEngine`).
- **`runNextActionEngine`** — rule-based 1–2 next-step suggestions on debrief REWARDS.
- **`contentMatrixEngine`** — dev content counts report (sectors, ops, anchors, resources, recipes, relics).
- **`sponsorRepEngine`** — reputation rank + progress preview on Contract Board.

**Debrief extensions:** `OperationDebriefPayload` adds `runOutcomeDetail`, `anchorSummary`, `balanceTelemetry`, `craftingOpportunities`. `OperationDebriefScreen` shows anchor activity, crafting opportunities, next steps, and dev run telemetry on REWARDS.

**Dev tooling:** `DevTestHubPanel` — FULL LOOP AUDIT, VALIDATE ALL, CONTENT MATRIX, RUN TELEMETRY, **VALIDATE WEAPONS / UNLOCK ALL / RESET WEAPONS**, DEPTH 10/12/15 presets. `WorldStateContext.devGetValidationReport()` returns full integration validation report. Boot logs integration warnings in `__DEV__`.

**Run Integration v1 — acceptance criteria:**

1. ✅ Full-loop audit report covers pre-run through persistence separation.
2. ✅ Aggregated validation catches contracts, operations, resources, echoes, routing, keepsakes, run items.
3. ✅ Debrief shows granular outcome, anchor, crafting opportunities, next steps.
4. ✅ Config-driven district depth (10/12/15) without rebalance.
5. ✅ Run balance telemetry for local development.
6. ✅ Content matrix dev report.
7. ✅ Sponsor reputation rank preview on Contract Board.

### Weapon Families + Vertical Upgrade Tracks v1

Weapons define baseline combat style **before** boons/grafts mutate the run. Distinct lanes:

| Lane | Role |
|------|------|
| **Weapons** | How I fight (baseline rhythm, stats, class resource) |
| **Boons** | How this run's combat build evolves |
| **Grafts** | How equipped abilities mutate |
| **Trinkets / Expedition Relics** | How expedition/extraction strategy changes |

**Model:**

- **Weapon family** — horizontal playstyle option (e.g. Longsword vs Claymore vs Rift Edge).
- **Weapon tier** — vertical upgrade within a family (Tier I → II → III). Tier III adds a small once-per-combat identity passive.
- **Masterwork** — hooks only (`masterworkUnlocked`, `requiresAnomalousCore`); not implemented in v1.

**Registry:** 9 families × 3 tiers in `weaponRegistry.ts`. Starters unlocked by default:

| Class | Starter |
|-------|---------|
| Aegis | Runed Longsword |
| Hex Shot | Silver-Core Sidearm |
| Envoy | Null Conduit |

**Roster:**

| Class | Family | Role | Unlock (stash) |
|-------|--------|------|----------------|
| Aegis | Runed Longsword | Balanced starter | Default |
| Aegis | Claymore-Blade | Heavy fracture | 3× Legion Blood-Iron, 5× Ley-Slag |
| Aegis | Rift Edge | Fast crit / Reserve | 2× Ossified Ley-Knot, 8× Echo-Glass Shard |
| Hex Shot | Silver-Core Sidearm | Balanced starter | Default |
| Hex Shot | Pulse Rifle | Sustained fire / magazine | 3× Encrypted Grid-Drive, 10× Ley-Slag |
| Hex Shot | Nullbreach Carbine | Heavy armor-pierce | 1× Grid-Drive, 2× Combustion Cylinder, 5× Ley-Slag |
| Envoy | Null Conduit | Balanced starter | Default |
| Envoy | Sanguine Prism | Sacrifice / risk | 3× Sanguine Ampoule, 2× Ossified Ley-Knot |
| Envoy | Echo Lantern | Control / debuff | 12× Echo-Glass, 1× Grid-Drive, 1× Sanguine Ampoule |

**Persistence (`PlayerAccount`):** `weaponUnlocks[]`, `weaponTiers` (per family), `equippedWeaponByClass`. Unlocks and tier upgrades are permanent. One equipped weapon per class. Legacy blueprint fields deprecated; saves reset to starter progression (pre-launch).

**Run snapshot (`ActiveIncursionState`):** `activeWeaponFamilyId`, `activeWeaponTier`, `weaponRuntime` (once-per-combat passive counters). Snapshotted at descent — combat reads run state, not live account.

**Progression UI:** `WeaponLoadoutPanel` on Loadout tab — inspect locked/unlocked families, equip, upgrade tier when affordable, preview next tier. Not in Forge fabrication matrix.

**Combat hooks (v1, modest):** strike damage/stamina, fracture scaling, magazine size, ballistic/occult damage %, crit bonus, armor pierce, once-per-combat passives (first melee Reserve, first fracture stamina refund, first reload stamina, post-reload ballistic bonus, first occult Veil-Flux, etc.). Applied via `weaponCombatEngine.ts` in `TacticalCombatHub` — modifier-driven, not weapon-name checks in boon DB.

**Debrief:** `runDebriefWeaponEngine` + extended `runCraftingOpportunityEngine` — equipped weapon/tier, newly unlockable families, upgrade-available / nearly-ready lines.

**Validation + dev:** `weaponValidationEngine.ts` (registry, account, active run); boot + `VALIDATE ALL` integration report; Dev Test Hub — Validate Weapons, Unlock All, Reset, Grant Resources.

**Key files:** `types/weapon.ts`, `weaponRegistry.ts`, `weaponProgressionEngine.ts`, `weaponCombatEngine.ts`, `weaponRunState.ts`, `weaponValidationEngine.ts`, `runDebriefWeaponEngine.ts`, `WeaponLoadoutPanel.tsx`, `PlayerAccountContext.tsx`, `RunContext.tsx` (descent snapshot), `TacticalCombatHub.tsx`, `CombatScreen.tsx`.

**Weapon Families v1 — acceptance criteria:**

1. ✅ Weapon registry with 9 families, 3 tiers each, starter per class.
2. ✅ Family unlocks and tier upgrades via extracted stash resources (no Anomalous Core for normal tiers).
3. ✅ Equip one weapon per class on Loadout; wrong-class blocked.
4. ✅ Weapon snapshotted to run at descent; mid-run swap disabled.
5. ✅ Combat applies stat mods + tier-III once-per-combat passives.
6. ✅ Debrief surfaces unlock/upgrade opportunities.
7. ✅ Masterwork hooks present but locked.
8. ✅ Legacy 3-blueprint LOADOUT forge recipes removed.

**Not in v1:** Masterwork weapons, mid-run weapon swap, weapon XP, inventory katana as combat stat source (deprecated).

## Progression Spine (Phase 1)

Career-long progression distinct from in-run systems. Persisted on `PlayerAccount.progressionProfile` (`ProgressionProfile`). Main fantasy: **option expansion** (sectors, grades, recipes, contracts) rather than raw combat power inflation.

### Pillars

| Pillar | Role |
|--------|------|
| **Runner Clearance** | Global career track — gates mandate availability, breach grades, forge bands, pin slots |
| **Sector Access** | Which biomes can be breached — unlocked by extracting route intel, not XP thresholds |
| **Breach Grade** | Selectable run danger/reward intensity (I–III playable; IV/V catalog only) |
| **Pinned Goals** | 2 slots (3 with clearance flag) — Veil Front recommendations + debrief pin |
| **Debrief Theater** | Structured “what changed / what’s next” on REWARDS; always-exit preserved |

Class Rank and Cabal Reputation are **side rails**: XP/tiers and reward **hooks** only in Phase 1 (no full new weapons/boons/grafts from those tables yet).

### 1A — Data foundation

- `ProgressionProfile`, unlock catalog (`unlockRegistry.ts`), requirement evaluator, reward grant service, event log.
- Sector / class / cabal / runner sub-state; flags; pinned goals; granted unlocks.

### 1B — Runner Clearance

- XP from extracts (grade-scaled); small XP on failure.
- Notable gates: Clearance 2 → sector access mandates; 3 → Breach Grade II + pin slot flag; 4 → advanced forge visibility; 5 → Breach Grade III; 6 → late-sector mandate eligibility.
- Engine: `runnerClearanceEngine.ts`.

### 1C — Sector access mandates

Unlock order (player-facing names): **Null Zone** (start) → **Abyssal Sink** → **Ashen Wastes** → **Slag Works** → **Blackline Terminus**.

| Target | Route intel | Typical sources |
|--------|-------------|-----------------|
| Abyssal Sink | Overgrowth Coordinate | Null Zone Depth 1+ elite/boss |
| Ashen Wastes | False-Road Signal | Null / Abyssal Depth 2+ |
| Slag Works | Transit Cipher | Ashen / Null Depth 2+ |
| Blackline Terminus | Blackline Credentials | Slag / Ashen Depth 3 |

Mandate states: `LOCKED` → `AVAILABLE` → `ACTIVE` → `COMPLETED`. Route intel is `INTEL` / `ROUTE_INTEL`: lost on death if unextracted, cannot fence, discard requires strong confirmation. Locked sectors stay visible on Veil Front.

### 1D — Breach Grades

- Selectable on Veil Front; frozen onto the active incursion at deploy.
- Scales enemy stats, elite chance, rewards, clearance/class/cabal XP multipliers (rules + numbers, not sponge HP only).
- Playable: **I–III**. IV/V exist in catalog for later.
- Contracts may require a minimum grade (`minBreachGrade`).

### 1E — Pinned goals

- Catalog kinds: sector access, breach grade, runner clearance, sector mastery, class rank, cabal rep, recipe unlock.
- Pin/unpin on Veil Front; progress cards + pin-from-debrief on REWARDS; auto-clear completed on hub return.

### 1F — Class rank & Cabal reputation

- Class XP from runs; Cabal rep from successful sponsored contracts (tier capped by breach grade).
- Reward tables grant **hook flags / ids only** — content wiring is post–Phase 1.

### 1G — Recipe visibility

- **Known** — full costs, craftable. **Rumored** — purpose + source, costs `???`, sealed. **Unknown** — hidden.
- Stash discovery + clearance/flag gates for advanced forge bands. Engine: `recipeVisibilityEngine.ts`.

### 1H — Debrief progression theater

- REWARDS step sections: run result, cargo, pinned progress, sector access, clearance/grade, class, cabal, mastery, craftable, unlocks, next recommended goals (`PIN_GOAL`).
- Celebrate predicted unlocks; pin slots refresh live after pin.
- **Always-exit:** only incomplete cargo ROUTING may disable the footer — progression never traps the player.

### 1I — Failure recovery / anti-frustration

When route intel is found then lost on death:

1. Mandate stays **ACTIVE**; intel can spawn again.
2. After **2** losses → **BOOSTED** elite/boss spawn chance.
3. After **3** losses → **GUARANTEED** on next combat at eligible depth (includes non-elite so soft-lock is impossible).

Fence blocked; discard confirms with sector-access warning. Engine: `failureRecoveryEngine.ts` + mandate spawn rolls.

### 1J — Economy simulation & audits

Offline tools in DevTest **PHASE 1J** (`progressionEconomySimulationEngine.ts`):

- Simulate N abstracted runs (extract/fail, pity, XP, unlocks, sample loot) — does **not** mutate the save.
- Pacing scorecard vs v1 bands (e.g. Abyssal 2–4, Ashen 4–8, Slag 8–14, Blackline 14–24 runs).
- Recipe/resource dependency audit; soft-lock audit; per-run XP/rep preview.

Sim biases are documented in-tool (grade mix favors lower grades; limited intel rolls per run). Use as a tuning aid, not a combat oracle.

### Key files

`types/progression.ts`, `progressionProfileEngine.ts`, `unlockRegistry.ts`, `runnerClearanceEngine.ts`, `sectorAccessMandateEngine.ts`, `breachGradeEngine.ts`, `pinnedGoalEngine.ts`, `classRankEngine.ts`, `cabalRepEngine.ts`, `recipeVisibilityEngine.ts`, `debriefProgressionTheaterEngine.ts`, `failureRecoveryEngine.ts`, `progressionEconomySimulationEngine.ts`, Veil Front briefing/map, `OperationDebriefScreen.tsx`, DevTest PHASE 1C–1J.

### Acceptance snapshot

- Null Zone always breachable; other sectors unlock only via extracted route intel.
- Grades I–III selectable when clearance unlocks them; IV/V not required for core path.
- Losing route intel is tense but recovers via pity; player can always leave debrief.
- DevTest can answer “how many runs to unlock X?” and “any soft-lock / broken recipe?”

## Economy Spine (Phase 2A — Cargo stacks)

Phase 2 answers: **what do I extract, how much can I carry, where does it come from, how much progress per run?** Phase 2A establishes carry tension before drop tables / sinks.

### Rules

- **Cargo stack** = max units in one in-run grid footprint (`cargoStackCap`). This is where extraction tension lives.
- **Stash stack** = hub ownership guidance (`stashStackCap`, soft / effectively unlimited at 9999 for v1).
- **Stable** resources stack (caps 3–5 typical). **Unstable** and **contraband** never stack (cap 1). **Route intel** is protected progression cargo (cap 1, no fence, strong discard warning).
- One stack = one footprint. Quantity badges show `N/cap` (or `xN` when cap is 1 but qty > 1).
- Loot grants merge into incomplete stacks (grid first, then containment), then create new containment stacks.
- Drop onto a matching incomplete stack merges. Drop onto a blocked cell offers **Replace** (jettison occupant) / Cancel. Harvest continue with unpacked non-residue cargo offers **Leave Behind** / Keep Packing.

### Phase 2A per-resource cargo table (v1)

| Resource | Grid | Cargo stack |
|----------|------|-------------|
| Ley-Slag / Echo-Glass / Nullcrete / Cinder Wire / Resonant Filament | 1×1 | 5 |
| Sanguine / Mycelial / Combustion / Blood-Iron | 1×1 | 3 |
| Rail Capacitor | 1×2 | 1 |
| Grid-Drive | 1×1 | 2 |
| Containment Seal | 1×1 | 3 |
| Dog Tags | 1×1 | 5 |
| Smuggler's Ledger | 1×1 | 1 |
| Veil-Ash / Ley-Knot / Anchor Marrow / Breach Thread | 1×1 | 1 |
| Anomalous Core | 2×2 | 1 |
| Specimen Jar | 1×2 | 1 |
| Sealed Casket | 3×1 | 1 |
| Route intel (×4) | 1×1 / 1×2 | 1 |

### Key files

`cargoStackEngine.ts`, `cargoStackDebugEngine.ts`, `cargoGridEngine.ts` (merge/replace/count/consume), `resourceRegistry.ts` (`cargoStackCap` / `stashStackCap`), `CargoLootPickupOverlay.tsx`, `CargoGridBoard.tsx` badges + replace UX, DevTest **ECONOMY SPINE // PHASE 2A**.

### Acceptance snapshot

- Stable stacks in cargo; unstable/contraband do not.
- Grid size respected; UI shows quantity + stack cap.
- Route intel / rare-apex discard warnings; route intel not fenceable.
- Pickup merge / overflow / replace / leave-behind UX present.

## Economy Spine (Phase 2B — Registry + ownership)

Normalize every resource before drop-table balancing. Ownership states answer “did I actually get it?”

### Registry fields (required)

Each resource now carries Phase 2B identity metadata:

| Field | Role |
|-------|------|
| `primarySectors` | Farming identity targets (subset of `validSectorIds`) |
| `secondarySources` | Crossover / event / residue contexts |
| `depthRules` | `{ minDepth, maxDepth, preferredDepths }` for 2E+ drop engines |
| `hasCarriedEffect` / `carriedEffectId` | Links unstable roster to carried-effect table |
| `cargoStackCap` / `stashStackCap` | From 2A |
| craft / fence / contract / operation / bank flags | Economy eligibility |

Validation gate: category, description, sourceHint, rarity, grid, stack rule, primarySectors, secondarySources, depthRules, ≥2 intendedUses, and at least one economy/route-intel use. Orphans fail as errors. Source identity lives in `resourceSourceIdentity.ts`.

### 2B.1 — Cargo ownership conversion

| State | Meaning |
|-------|---------|
| **CARRIED** | Physical run cargo — lost on death if unbanked |
| **BANKED** | Mid-run safehouse snapshot — survives death |
| **EXTRACTED** | Hub stash after successful extract (carried + banked merge) |
| **LOST** | Carried cargo dropped on death |

Rules:

- Safe / successful dirty extract: carried + banked → stash.
- Death: banked → stash; carried → lost.
- **Apex cargo** (Anomalous Core, Sealed Containment Casket / `APEX_CARGO`) **cannot mid-run bank** — must extract or risk loss.
- Safehouse Inventory shows CARRIED / BANKED counts, MUST EXTRACT apex list, and ownership copy.

### Key files

`resourceSourceIdentity.ts`, `cargoOwnershipEngine.ts`, `cargoOwnershipDebugEngine.ts`, `resourceValidation.ts`, `resourceRegistry.ts` (`def()` merges identity + apex bank lock), Safehouse Inventory tab, DevTest **ECONOMY SPINE // PHASE 2B**.

### Acceptance snapshot

- Every roster resource has complete Phase 2B metadata + source identity.
- Validation rejects orphans / missing identity / apex-bankable apex cargo.
- Banking skips apex; player-facing ownership rules are visible in-hub.

## Economy Spine (Phase 2C — Final roster freeze)

Lock the v1 material set. Phase 2 makes **this** roster work — it does not add more resources.

### Frozen counts

| Bucket | Count | Notes |
|--------|------:|-------|
| Stable | 10 | Ley-Slag → Resonant Filament |
| Unstable | 5 | Core, Veil-Ash, Ley-Knot, Anchor Marrow, Breach Thread |
| Economy intel | 4 | Grid-Drive, Ledger, Dog Tags, Containment Seal |
| Contraband | 2 | Sealed Casket, Specimen Jar |
| **Economy total** | **21** | Drop / craft / fence / contract surface |
| Route intel | 4 | Progression Spine sector-access cargo (not economy materials) |
| **Full freeze** | **25** | Registry must match exactly |

Catalog: `economyRosterV1.ts` (`ECONOMY_V1_RESOURCE_IDS`, `ROUTE_INTEL_V1_IDS`, `PHASE_2C_FULL_ROSTER_IDS`). `ECONOMY_V1_ROSTER_FROZEN = true`.

### Validation

`validateResourceRegistry()` fails if the live registry has extras, missing freeze ids, wrong category buckets, economy ids tagged as route intel, or route intel not `INTEL` / `ROUTE_INTEL`.

### Rule

Do not expand past this set until an explicit later Phase 2 roster-expansion decision. Next economy work is sector/depth tables (2D/2E) on these ids.

### Key files

`economyRosterV1.ts`, `economyRosterDebugEngine.ts`, `resourceValidation.ts` (freeze gate), DevTest **ECONOMY SPINE // PHASE 2C**.

## Economy Spine (Phase 2D — Sector resource tables)

Turn the map into an economy decision: “I need Rail Capacitor → Slag Works,” not a flat loot table.

### Per-sector farming identity

| Sector | Role | PRIMARY | Rare / crossover / apex |
|--------|------|---------|-------------------------|
| Null Zone | Urban defense, scanner, concrete/warding | Nullcrete, Echo-Glass, Ley-Slag | Grid-Drive (rare), Containment Seal (crossover) |
| Abyssal Sink | Survival, healing, cleanse, attrition | Mycelial Ichor, Sanguine Ampoule, Echo-Glass | Ossified Ley-Knot (rare), Specimen Jar (crossover) |
| Ashen Wastes | Extraction, signal, flares, road salvage | Cinder Wire, Combustion Cylinder, Veil-Ash, Echo-Glass | Breach Thread (rare) |
| Slag Works | Industrial power, weapons, armor crack | Rail Capacitor, Blood-Iron, Combustion Cylinder, Ley-Slag | Anchor Marrow (rare) |
| Blackline Terminus | Containment, appraisal, sealed cargo | Containment Seal, Grid-Drive, Specimen Jar, Sealed Casket, Breach Thread | Anomalous Core (apex) |

Bands: `PRIMARY` / `SUPPORT` / `RARE` / `CROSSOVER` / `APEX` in `SECTOR_RESOURCE_TABLES`. Flex SUPPORT (Ledger, Dog Tags, Resonant Filament) may appear on multiple sectors without being farming pillars.

### Wiring

- Combat / expansion drop identity uses `sectorIdentityResourcePoolFromTables` + table rare/apex pools (`resourceDropIdentityEngine.ts`).
- Contract sector bias (`SECTOR_RESOURCE_IDS`) mirrors PRIMARY + key rare rows.
- Validation: every sector has role/whyRun/≥3 PRIMARY; PRIMARY ⊆ `primarySectors`; every economy id listed somewhere; non-economy ids forbidden.

Depth packets (Threshold / Breach / Deep) are **not** Phase 2D — that is Phase 2E.

### Key files

`sectorResourceTableEngine.ts`, `sectorResourceTableDebugEngine.ts`, `resourceDropIdentityEngine.ts`, `resourceValidation.ts`, `contractSponsorPreferences.ts`, DevTest **ECONOMY SPINE // PHASE 2D**.

### Acceptance snapshot

- Each sector has a clear farming fantasy and why-run list.
- Map reads as resource destinations, not interchangeable loot.
- Registry PRIMARY alignment holds; DevTest sector tables report PASSes.

## Economy Spine (Phase 2E — Depth resource rules)

Depth modifies the resource economy. Not every resource is available from the start.

| Depth | Band | Purpose | Drops |
|------:|------|---------|-------|
| 1 | Threshold | Teach the sector; readable rewards | Common + sector stable; low intel; no unstable / contraband / apex |
| 2 | Breach | Dangerous value; extract tension | More sector + rare; intel; unstable; Breach Thread rare; Anchor Marrow on Anchor; contraband high-risk only |
| 3 | Deep Veil | Pressure kinds, not “more Ley-Slag” | Rare more common; meaningful unstable; contraband possible; Breach Thread up; Anomalous Core high-risk / apex only |

### Wiring

- `depthResourceRulesEngine.ts` — `DEPTH_ECONOMY_POLICIES`, `isResourceEligibleAtDepth`, `filterResourcesForDepth`, roll pressure hints.
- Per-resource `depthRules` (from `resourceSourceIdentity`) still set min/max/preferred; Grid-Drive allows rare Threshold peek.
- Combat salvage (`depthAwareTierResourcePool`) + identity extras filter through eligibility.
- Validation: apex minDepth 3; unstable/contraband minDepth ≥ 2; D1 default pool clean; Null Zone Threshold example eligible.

Reward packets / yield targets are **not** Phase 2E — that is Phase 2F.

### Key files

`depthResourceRulesEngine.ts`, `depthResourceRulesDebugEngine.ts`, `resourceDropIdentityEngine.ts`, `combatRewardEngine.ts`, `resourceSourceIdentity.ts`, `resourceValidation.ts`, DevTest **ECONOMY SPINE // PHASE 2E**.

### Acceptance snapshot

- Threshold stays readable; Breach opens risk; Deep Veil changes cargo kinds.
- Apex / contraband cannot leak into normal Depth 1 salvage.
- DevTest depth rules report PASSes.

## Economy Spine (Phase 2F — Reward packets + yield model)

Do not hand-place individual resources everywhere. Nodes emit **typed reward packets**; depth (2E) and sector tables (2D) gate what each packet can roll.

### Packet types

`STABLE` · `SECTOR` / `SECTOR_STABLE` · `INTEL` · `RARE` · `UNSTABLE` · `CONTRABAND` · `CONTRACT` · `OPERATION` · `ECHO` · `ANCHOR` · `APEX`

Example: `{ packetType: 'SECTOR_STABLE', rolls: 2, rarityBias: 'COMMON', sectorBias: 'THE_SLAG_WORKS', allowUnstable: false, allowContraband: false, minDepth: 1 }`.

### Node recipes (summary)

| Node | Depth 1 | Depth 2 | Depth 3 |
|------|---------|---------|---------|
| Normal combat | 0–1 stable; tiny rare peek | 1 stable + sector chance; small rare | 1–2 stable + sector; rare chance |
| Elite | 1 stable + rare chance | stable + sector/rare; unstable peek | 2 rolls + unstable chance |
| Resource anomaly | 2–3 sector/stable | 3–4 + rare/unstable | 4–5 + rare/unstable/contraband |
| Anchor Signal | sector + Anchor Marrow chance | + operation peek | same, stronger marrow |
| Echo Signal | Echo-Glass / Filament / Dog Tags | + intel peek | stronger intel |
| Boss | guaranteed sector + rare/intel | + unstable | + contraband / apex chance |

### Breach Grade quality (not pile ×N)

Grades add **bonus packet chances** (sector / rare / intel / unstable / contraband). Do not multiply every resource by 2.

### Extracted yield targets

Tune around **extracted** cargo, not raw drops (cargo space, stacks, death, banking, unstable pressure cut what gets home). Bands: early D1, full D1 boss, D2 partial, D3 extract, full deep clear — see `EXTRACTED_YIELD_TARGETS`.

### Wiring

- `resourceRewardPacketEngine.ts` — assemble + roll packets
- `combatRewardEngine.rollCombatResourceDrops` — enemy loot + packets (+ light composition/occult)
- `proceduralResourceEngine` — `RESOURCE_ANOMALY` packets
- Run grant path injects Breach Grade, contract/operation targets

Unstable pressure / sinks are Phase 2G+.

### Key files

`resourceRewardPacket.ts`, `resourceRewardPacketEngine.ts`, `resourceRewardPacketDebugEngine.ts`, `combatRewardEngine.ts`, `proceduralResourceEngine.ts`, `resourceValidation.ts`, DevTest **ECONOMY SPINE // PHASE 2F**.

### Acceptance snapshot

- Combat / harvest / boss use packets, not ad-hoc pools alone.
- Higher grades add better packet kinds/chances, not flat pile multipliers.
- Yield targets documented; DevTest packet report PASSes.

## Economy Spine (Phase 2G — Resource source hints)

If the player needs Rail Capacitor and the game never says where to get it, the economy is frustrating. Source hints appear in four places:

1. **Recipe missing-resource lines** (Forge fabrication rows)
2. **Resource ledger / home stash** subtitles
3. **Veil Front** sector farming preview (+ pinned-goal material directives)
4. **Debrief** SOURCE INTEL block

### Hint tiers

| Tier | When | Example |
|------|------|---------|
| Exact | Primary sector unlocked | “Commonly found in Slag Works… Best source: …” |
| Partial | Sector locked but known (mandate/intel) | “Industrial power component. Likely source: locked sector (Slag Works).” |
| Unknown | No sector knowledge | “Unknown source. Recover more sector intel…” |
| Contract-directed | Pinned RECIPE_UNLOCK missing mats | “Pinned Goal… Missing… Recommended breach: Slag Works // Grade II+” |

Built from `primarySectors`, sector tables (2D), `secondarySources`, and pinned goals (Phase 1E).

### Key files

`resourceSourceHintEngine.ts`, `resourceSourceHintDebugEngine.ts`, `CraftingMenuPanel.tsx`, `SafehouseStashPanel.tsx`, `SectorBriefingPanel.tsx`, `MapStatusSummary.tsx`, `OperationDebriefScreen.tsx`, DevTest **ECONOMY SPINE // PHASE 2G**.

### Acceptance snapshot

- Rail Capacitor → Exact Slag Works when Slag unlocked.
- Locked-but-known sectors yield Partial, not silence.
- DevTest source hints report PASSes.

## Economy Spine (Phase 2H — Economy report + debug simulation)

Dev-facing economy tooling so tuning is not vibes-based.

### Debug tools

Grant ALL / STABLE / UNSTABLE / INTEL · Clear stash · Unlock all sectors · Set Breach Grade I–III · Simulate sector/depth/grade drops · Simulate 100 resource nodes/sector · Simulate 100 economy runs · Validate registry suite · Print source table · Bottleneck report · Full economy report

### Report surfaces

Totals by category / rarity / sector / min-depth · recipes/contracts/ops per resource · no sink / no source · overused / underused · sim averages (extracted, abandoned, lost, value/slot) · bottleneck WARNINGs (e.g. high recipe use vs low extraction)

### Key files

`economySpineSimulationEngine.ts`, `economySpineDebugEngine.ts`, `resourceEconomyReportEngine.ts`, PlayerAccount debug grants, DevTest **ECONOMY SPINE // PHASE 2H**.

### Acceptance snapshot

- Full report + bottleneck + sims runnable from DevTest.
- Grant/clear/unlock tools mutate hub stash / progression.
- Tuning can cite average extraction rates, not gut feel.

## Economy Spine (Phase 2I — Resource discovery state)

Source hints (2G) tell you where to farm. Discovery state makes ledger identity feel earned.

### State per resource

`discovered` · `firstExtractedAtSector` · `bestKnownSource` · `knownUses`

### Presentation

| State | Title | Detail |
|-------|-------|--------|
| Before | UNKNOWN INDUSTRIAL COMPONENT (category fog) | Likely source / used-in band |
| After | RAIL CAPACITOR | Best source + known uses + first extract sector |

### Wiring

- Seeded from stash on save migrate / default account
- Marked when post-run routing banks new resources (and debug grants)
- Forge ledger + Safehouse stash use discovery cards
- Debrief SOURCE INTEL includes `DISCOVERED:` lines

### Key files

`resourceDiscovery.ts`, `resourceDiscoveryEngine.ts`, `resourceDiscoveryDebugEngine.ts`, PlayerAccount.`resourceDiscovery`, DevTest **ECONOMY SPINE // PHASE 2I**.

### Acceptance snapshot

- Fogged title → true name after first bank.
- Ledger shows best source + uses once discovered.
- DevTest discovery report PASSes.

## Economy Spine (Phase 2J — Contract / market / appraisal integration)

Light integration pass — no market rebuild. Makes sure the economy spine talks to contracts, operations, fence, and sealed appraisal without impossible targets.

### Guarantees

- Procedural contract overrides (jar/casket/core/intel/unstable) are **spawn-filtered** to the selected sector (or slot fails / retries).
- Contract picks require `canBeContractTarget`; board validation errors if not.
- Sector contract bias prefers **PRIMARY+RARE** farming tables (2D), with legacy `SECTOR_RESOURCE_IDS` checked for drift.
- Operations already filter `canBeOperationTarget` + spawn; integration report audits flags.
- Contraband / sealed stay **sell / deliver / appraise** — never craft inputs.
- Appraisal jar + casket pipeline remains the sealed sink (fees + band sell tables).

### Value lanes (fence)

| Category | Fence mult | Intent |
|----------|------------|--------|
| STABLE | ×0.85 | Craft sink preferred |
| INTEL | ×1.15 | Fence + contract |
| UNSTABLE | ×1.0 | Moderate sell; carry risk |
| CONTRABAND | ×1.30 | High fence / appraisal / deliver |

Applied in hub fence + post-run `SELL_FENCE` via `resolveFenceUnitValue`.

### Key files

`economyValueLaneEngine.ts`, `economyIntegrationEngine.ts`, `contractProceduralEngine.ts`, `hubSafehouseEngine.ts`, `postRunCargoRoutingEngine.ts`, DevTest **ECONOMY SPINE // PHASE 2J**.

### Acceptance snapshot

- Integration report PASSes (no impossible contract/op targets; no contraband craft).
- Fence matrix shows lane-adjusted unit values.
- Black Market fence rows show category + lane payout (`formatFenceLaneLabel`).

## Economy Spine (Phase 2K — Live economy telemetry)

Offline sims (2H) answer “what should a run yield?” Live telemetry answers “what actually happened?”

### Per-run (`ActiveIncursionState.economyRunTelemetry`)

Generated · left behind · cargo swaps · jettisons · occupancy samples · nodes with unstable/contraband · unstable carry duration · newly craftable recipes

Ledger still owns: collected / banked / extracted / lost / consumed.

### Career (`PlayerAccount.careerEconomyTelemetry`)

Craft spend · fence units/credits · contracts completed · newly craftable · runs sampled · last-run summary

### Hooks

Loot delta → generated · harvest leave-behind · cargo replace/jettison · node clear occupancy/unstable · hub craft · hub + debrief fence · debrief finalize into career

### Key files

`economyRunTelemetry.ts`, `economyRunTelemetryEngine.ts`, `postRunCargoRoutingRunState.applyCargoCollectedLedgerDelta`, RunContext cargo/node hooks, DevTest **ECONOMY SPINE // PHASE 2K**.

### Acceptance snapshot

- Live telemetry report shows run + career event counters.
- Leave-behind / swaps / craft / fence increment tracked fields.
- 2H sim still available beside live report (no second sim stack).

## Economy Spine (Phase 2L — Save migration)

Old saves must load without wiping craft/weapons or inventing bad economy state.

### On account hydrate (`mergeStoredAccount`)

- Remap legacy / snake_case stash keys via `LEGACY_RESOURCE_ID_ALIASES`
- Drop unknown stash / sealed resource refs (fail closed)
- Missing roster resources soft-init to 0
- Seed discovery + career telemetry defaults when absent
- Crafted augments / weapon unlocks preserved (never wiped by migrate)

### On world hydrate (`mergePersistedState`)

- Remap contract target resource ids
- Drop contracts with unknown / non-contract-target resources
- Clear selected SPONSOR contract if it was removed
- Regenerate board only if empty after sanitize

### Key files

`economySaveMigrationEngine.ts`, `PlayerAccountContext.mergeStoredAccount`, `WorldStateContext.mergePersistedState`, DevTest **ECONOMY SPINE // PHASE 2L**.

### Acceptance snapshot

- Fixture PASSes: `ley_slag` remaps; orphan stash key dropped; bad contract removed.
- Dry-run on live account shows remaps/drops without craft/weapon loss.
- No AsyncStorage key rebuild — migrate in-place on load.

## Economy Spine (Phase 2M — Tuning pass)

Close Phase 2 by answering the design questions and enforcing hard balance rails — not vibes.

### Tuning questions

1. Basic survival craft after one run?
2. Target a missing resource without guessing?
3. Cargo stacking helpful without erasing tension?
4. Unstable cargo forces real decisions?
5. Depth 2 economically worth the risk?
6. Depth 3 dangerous but rewarding?
7. Every sector has a reason to run?
8. Null Zone still relevant at higher Breach Grades?

### Hard balance rules

- Do not make every recipe need Ley-Slag / every tech recipe need Grid-Drive / every power recipe need Ley-Knot
- Do not gate Depth 2 reachability on Breach Thread
- Do not make Blackline mandatory for all advanced craft
- Do not let cargo tools erase extraction risk
- Keep basic healing cheap; commons must have sinks
- No sealed/contraband craft inputs; do not overuse Anomalous Core

### Applied 2M knobs

- D1 NORMAL_COMBAT gains a SECTOR packet + higher STABLE fire (Threshold teaches farming identity)
- Weapon / run-item / forge sinks diversified off Ley-Slag toward nullcrete / cinder / combustion / mycelial / rail
- Ashen Breach Thread + Null Zone Containment Seal promoted to PRIMARY
- Depth 2/3 extracted yield bands nudged up (intel / unstable)

### Key files

`economyTuningEngine.ts`, `economyBalanceConfig.ECONOMY_TUNING_THRESHOLDS`, `resourceRewardPacketEngine`, `weaponRegistry` / `runItemRegistry` / `craftingRegistry`, `sectorResourceTableEngine`, DevTest **ECONOMY SPINE // PHASE 2M**.

### Acceptance snapshot

- Tuning report has zero FAIL checks.
- Ley-Slag recipe share under hard cap; Standard Coagulant stays ≤1 Ley-Slag.
- Sector tuning brief shows every sector PRIMARY identity + D2 rates.

## Economy Spine (Polish pass — Phase 2 closeout)

Ship cleanup after 2A–2M. No new economy systems.

### Verify / acceptance

`economySpineAuditEngine.ts` aggregates roster / ownership / sector / depth / packets / hints / discovery / integration / migration / tuning. DevTest **ECONOMY SPINE // POLISH** — `[ VERIFY ALL 2A–2M ]` + `[ ACCEPTANCE ]`. Boot `__DEV__` warn on verify errors.

### Player surfaces

| Surface | Polish |
|---------|--------|
| Black Market fence | Lane label = category ×mult · intent (craft sink / fence+contract / risk carry / appraise) |
| Forge fabrication costs | Undiscovered mats use fogged discovery titles |
| Debrief SOURCE INTEL | `DISCOVERED:` only for first-find extracts (not every already-known bank) |
| Cargo REPLACE overlay | Stack quantity badge when replacing |

### Cleanup

- Removed duplicate consumable recipes from `CRAFTING_REGISTRY` (run-item bridge is sole source — stops double-counting in tuning/bottlenecks)
- Bottleneck “Blackline-only” check uses any sector-table band + identity primaries (not PRIMARY band alone)

### Soft WARNs retained

Grid-Drive still clusters in tech-tagged sinks; Ley-Knot in power-tagged sinks — intentional mid/late gates, not FAIL.

### Acceptance snapshot

- Verify ALL → 0 errors.
- Acceptance report PASSes with tuning 0 FAIL + migration fixture PASS.

## Run And Progression Systems

### Run State

Run state tracks:

- Current depth/node.
- Soul Anchor HP and max HP.
- Stamina and max stamina.
- Active class and class loadout.
- **`activeWeaponFamilyId` / `activeWeaponTier` / `weaponRuntime`** — weapon locked at descent (family, tier, once-per-combat counters).
- Active cargo and containment.
- **`runBankedSnapshot`** — physical cargo secured at in-run safehouse (survives death).
- **`runResourceLedger`** — collected, banked, extracted, lost, consumed resource counts.
- **`keepsakeRuntime`** — equipped expedition relic state (null when none equipped).
- Legacy mid-run combat trinkets and run modifiers.
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
- **Weapon family unlocks and tier upgrades** (`weaponUnlocks`, `weaponTiers`, `equippedWeaponByClass`).
- Hub-crafted consumables.
- Pre-run cargo draft.
- Class ability unlocks and loadouts.
- Unidentified/decryption stash.
- **`progressionProfile`** — Runner Clearance, sector unlocks/mandates/mastery, breach grades, pinned goals, class rank XP, cabal rep tiers, recipe discovery flags, progression event log (see Progression Spine).

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

#### Resource Registry (v1 + Expansion Phase A)

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
| Nullcrete Shard | STABLE | CRAFTING_MATERIAL | 5 | 1×1 | Nullcrete | ✓ | ✓ |
| Mycelial Ichor | STABLE | CRAFTING_MATERIAL | 3 | 1×1 | Mycelial Ichor | ✓ | ✓ |
| Cinder Wire | STABLE | CRAFTING_MATERIAL | 5 | 1×1 | Cinder Wire | ✓ | ✓ |
| Rail Capacitor | STABLE | CRAFTING_MATERIAL | 1 | 1×2 | Rail Capacitor | ✓ | ✓ |
| Containment Seal | INTEL | SCANNER_INTEL | 3 | 1×1 | Containment Seal | ✓ | ✓ |
| Resonant Filament | STABLE | CRAFTING_MATERIAL | 5 | 1×1 | Resonant Filament | ✓ | ✓ |
| Anchor Marrow | UNSTABLE | OCCULT_CARGO | 1 | 1×1 | Anchor Marrow | ✓ | ✓ |
| Breach Thread | UNSTABLE | OCCULT_CARGO | 1 | 1×1 | Breach Thread | ✓ | ✓ |
| Blacksite Specimen Jar | CONTRABAND | UNIDENTIFIED_CONTAINER | 1 | 1×2 | Specimen Jar | — | ✓ |

### Resource Expansion + Recipe Refactor v1 (Phase A)

Phase A expands the registry from **12 → 21** resources with category, rarity, source hints, intended uses (≥2), sector validity, and eligibility flags. Recipe cost refactors, drop tables, contracts, and Specimen Jar appraisal tables land in later phases.

**Sector identity mats:** Nullcrete (Null Zone), Mycelial Ichor (Abyssal Sink), Cinder Wire (Ashen Waste), Rail Capacitor (Slag Works), Containment Seal (Blackline).

**System mats:** Resonant Filament (Echo/Choir), Anchor Marrow + Breach Thread (unstable carried: Anchor/High-Risk; HV salvage + scanner murk), Blacksite Specimen Jar (appraisable sealed sibling to Casket — open table Phase D).

**Metadata:** Every resource now has `rarity`, `sourceHint`, and `intendedUses`. Stash uses `Partial<ResourceQuantity>` so missing keys stay at 0.

**Not in Phase A:** recipe cost rewrites, sector drop table rewires, contract pool expansion, Specimen Jar open/reward table.

### Resource Expansion + Recipe Refactor v1 (Phase B)

Phase B rewires crafting costs so new sector/system mats matter immediately — without changing starter simplicity.

**Run items (`runItemRegistry.ts`):** Spall-Weave (Nullcrete), Trauma Patch (Mycelial), Grid-Cracker (Rail Capacitor), Eclipse Flare (Cinder Wire), Dead-Drop / Null-Lens (Containment Seal), Ash-Seal (Breach Thread + Seal), Foam (Nullcrete), Splitter (Rail Capacitor), Echo Tuning Fork (Resonant Filament), Anchor Needle (Anchor Marrow).

**Starters kept simple:** Standard Coagulant `2× Ley-Slag`, Sonar-Ping `3× Echo-Glass`, Kinetic Hollow-Points `3× Ley-Slag`.

**Weapons:** Claymore / Pulse / Nullbreach / Rift Edge / Sanguine Prism / Echo Lantern unlocks lightly use Rail Capacitor, Containment Seal, Resonant Filament, Mycelial Ichor, and Breach Thread — no Anomalous Core on normal unlocks.

**Debrief:** Crafting opportunity list prefers run-item recipes when forge CONSUMABLE duplicates the same output.

**Skipped (need effect hooks / Phase C–D):** Dirty Extract Beacon, Breach Compass, Anchor Spike, Void-Surge Catalyst craft table.

**Not in Phase B:** drop/source tables, contracts/sponsors, Specimen Jar appraisal.

### Resource Expansion + Recipe Refactor v1 (Phase C)

Phase C gives new mats **drop and contract identity** — sector bias, depth gates, enemy salvage, echo filament, and sponsor targets — without opening Specimen Jar appraisal (Phase D).

**Combat identity (`resourceDropIdentityEngine` + `combatRewardEngine`):** Sector primary mats bias common salvage. Echo fights can yield Resonant Filament. Anchor / Anchor Patrol (Depth 2+ or elite) can yield Anchor Marrow. Depth 2+ distortion / high-risk can yield Breach Thread. Blackline can bump Containment Seal. Depth 3 Blackline/Abyssal high-risk can yield Blacksite Specimen Jar (sparse, never guaranteed Core).

**Composition extras:** Sector tech bias pools use Rail / Seal / Cinder / Nullcrete / Mycelial; Echo Contaminated always leans Filament; High-Risk Cargo Guard on Blackline/Abyssal can stamp Specimen Jar at RARE.

**Enemy salvage:** Gargoyles → Nullcrete; Sapper/Splinter → Cinder Wire; Golem/Churn → Rail Capacitor; Miasma/Rootbound → Mycelial Ichor; Resonance Casters → Resonant Filament.

**Hostile Echo:** All reward profiles bonus-roll Resonant Filament alongside Echo-Glass.

**Contracts:** Stable + sponsor pools include expansion mats; unstable cargo can ask for Anchor Marrow / Breach Thread; Recover Contraband can target Casket or Specimen Jar. `RECOMMENDED_SECTORS_BY_RESOURCE` maps every expansion mat.

**Sector focus copy:** Catalog `resourceFocus` strings updated to real mat names (Nullcrete, Mycelial, Cinder, Rail, Seal/Breach).

**Not in Phase C:** Specimen Jar open/appraisal table, economy content report / debug grant sim polish (Phase D).

### Resource Expansion + Recipe Refactor v1 (Phase D)

Phase D closes the expansion pass: **Specimen Jar appraisal/open**, **economy reporting**, **debug grant/sim**, and **debrief discovery polish**.

**Specimen Jar (`sealedSpecimenJarOpenEngine`):** Shares the sealed-cargo pipeline with the Containment Casket via generalized `SealedContainerResourceId` stacks. Soft fees (30 / 50 CR). Open table: Mycelial / Sanguine / Veil-Ash / Ley-Knot / Containment Seal / rare Breach Thread (+ dud). Hub Black Market + post-run routing Appraise / Open / Sell Sealed work for jars.

**Economy report (`resourceEconomyReportEngine`):** Dev + CONTENT MATRIX report — total roster, category/rarity/sector counts, recipes-per-resource, expansion roster footprint, no-recipe / no-drop / no-economy orphans, bottleneck hints.

**Debug (DevTest):** Grant Specimen Jar, grant expansion mats, sim jar open rolls, force jar Breach tier, Resource Economy Report; sealed validation covers both containers.

**Debrief polish:** Crafting opportunities emit `DISCOVERED:` hints for expansion mats (display names + source hints), prefer expansion materials in extracted highlights, and sealed debrief lines name casket vs jar.

**Validation:** Dual sealed configs, dual open tables, routing reward ID checks for jar contents.

**Acceptance unlocked (resource expansion):** 16 (jar appraisable), 20–22 (validation / debug / economy report) on top of Phases A–C.

**Not in Phase D:** Full unboxing animation system; Void-Surge / Breach Compass / Anchor Spike effect-craft tables (still skipped pending hooks).

### Full Run Balance + Tuning Framework v1 (Phase A)

Phase A creates a **central balance config registry** so tuning no longer requires hunting scattered magic numbers. No new gameplay systems.

**Registry (`src/data/balance/`):** Run / Combat / Reward / Economy / Contract / Operation / Scanner / Weapon / Trinket configs + `balanceTargets.ts` (early/late outcome bands, combat turn-length targets — **not enforced**).

**Wired knobs:**
- Combat depth HP/dmg + elite/alpha multipliers → `combatBalanceConfig` (consumed by `enemyCombatConfig`)
- Kill credit ranges + depth/composition multipliers → `rewardBalanceConfig` (`combatCredits`, `encounterCompositionRewardEngine`)
- Sealed casket/jar fees & appraised sell bands → `economyBalanceConfig`
- Contract credit/rep tables + sponsor modifiers → `contractBalanceConfig` (`contractTemplates`)
- Operation contribution values + caps → `operationBalanceConfig` (`worldStateHelpers` re-exports)
- Depth-stage scanner/echo/op-target chances → `scannerBalanceConfig`
- Node-pressure bands + depth-index helpers scale with configurable `nodesPerDepth` (10/12/15)

**Dev:** `[ BALANCE CONFIG ]` in DevTest; summary also appended to CONTENT MATRIX.

**Not in Phase A:** Expanded run telemetry / last-10 dashboard (Phase B), generation sims / crafting affordability (Phase C), balance validation warnings (Phase D).

### Full Run Balance + Tuning Framework v1 (Phase B)

Phase B expands **per-run telemetry** and adds a **career last-10 dashboard** so pacing and loadout trends are visible without new gameplay UI.

**Per-run counters (`balanceRunStats` on `ActiveIncursionState`):** Combat samples (turns / damage taken / healing / damage dealt / victory, tagged STANDARD|ELITE|BOSS), sanctuary & market visit counts, death cause + district.

**Combat instrumentation:** `TacticalCombatHub` accumulates encounter samples and returns them via `onCombatComplete`; `CombatScreen` records into `balanceRunStats`. Death path stamps cause/district before debrief build.

**Expanded `RunBalanceTelemetry`:** Class / weapon / relic / sector / contract / op / biome; cargo fence value extracted / banked / lost; avg combat turns (overall + by kind); damage/heal totals; death cause; sanctuary/market visits.

**Career ring buffer (`careerBalanceHistory` on `PlayerAccount`):** Last 10 completed runs; pushed on Operation Debrief mount; persisted with account.

**Dashboard (`formatBalanceDashboard`):** Extract/death rates, D2/D3 reach, boss/contract rates, cargo-value averages, most-used class/weapon/relic, last-run snapshot vs early target bands.

**Surface:** DevTest `[ BALANCE DASHBOARD ]` + `[ RUN TELEMETRY ]`; debrief DEV sections for telemetry + dashboard.

**Not in Phase B:** Generation/reward/contract/op/crafting sims (Phase C), balance validation warnings (Phase D).

### Full Run Balance + Tuning Framework v1 (Phase C)

Phase C adds **offline balance simulations** that wrap existing generators — no combat auto-resolve, no new gameplay.

**Engines (`src/data/balance/`):**
- `balanceSimulationEngine.ts` — run-tree generation (1 + N), reward rolls by depth/kind, contract boards, operation runs-to-complete estimates, approximate run resource income, sealed open tier histograms, encounter/composition distribution wraps
- `balanceCraftingAffordabilityEngine.ts` — recipe classification vs income model: COMMON_PREP / STANDARD_TOOL / RARE_TOOL / APEX_FUTURE; bottleneck resource callouts

**DevTest:** `[ SIM BALANCE BUNDLE ]` plus `[ SIM TREES 100 ]`, `[ SIM REWARDS ]`, `[ SIM CONTRACTS ]`, `[ SIM OPS ]`, `[ SIM RUN LOOT ]`, `[ SIM CRAFT AFFORD ]`, `[ SIM SEALED EV ]`, `[ SIM ENCOUNTER DIST ]`.

**Intent:** Catch obvious tuning problems (tree mix skew, one-shot ops, impossible recipes, empty reward tables) without playing full runs.

**Not in Phase C:** Balance validation warning engine + ACCEPTANCE checklist polish (Phase D).

### Full Run Balance + Tuning Framework v1 (Phase D)

Phase D closes the balance framework with **validation warnings** and DevTest/loop integration. Warnings guide tuning — they do **not** hard-gate gameplay.

**Engine (`balanceValidationEngine.ts`):**
- Combat depth HP/dmg multipliers vs intent bands; elite mult sanity
- Reward tables (elite/boss credit ordering, depth credit ladder, HIGH_VALUE > BASELINE)
- Composition Phase D reuse (`HIGH_RISK_BASELINE`, missing reward resources)
- Craft→fence sell exploits (consumable `baseValue` vs resource sell craft cost)
- Contract recommended-sector spawnability + template weight/sponsor checks
- Operation contribution missing/absurd; focused/ordinary runs-to-complete vs 3–6 target; relic cap consistency
- Weapon tier / cumulative `strikeDamagePct` soft caps
- Trinket Marked Shelf discount vs soft caps
- Tree sanctuary/extraction presence (small sim sample)
- Post-run routing/death-bank pipeline validators
- Career last-N vs early outcome bands when sample ≥ 5

**Surface:** DevTest `[ VALIDATE BALANCE ]`; folded into `formatFullIntegrationValidationReport` / VALIDATE ALL (cross-check).

**Acceptance unlocked (balance framework v1):**
1–8 Config registry + knobs (Phase A)
9–10 Telemetry + last-10 dashboard (Phase B)
11–13 Sims + crafting affordability (Phase C)
14–15 Validation warnings + high-risk/reward gaps (Phase D)
16–18 Reuse extraction/death/routing validators
19–20 Config comments + design doc + DevTest workflow

**Not in Phase D:** Autofix / forced rebalance; online multiplayer; new gameplay systems.

**Smuggler's Ledger:** INTEL / ECONOMY_INTEL / FENCE_VALUE — not a crafting ingredient. High fence payout (250 credits).

**Tarnished Dog Tags:** stackable INTEL / FENCE_VALUE — not a crafting ingredient.

**Sealed Containment Casket:** CONTRABAND / UNIDENTIFIED_CONTAINER / APPRAISABLE — not craftable while sealed; hub + post-run **Appraise / Open / Sell Sealed** (see Appraisal + Sealed Cargo v1).

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

Weapon family unlocks and tier upgrades are **not** Forge recipes — they are handled on Loadout → Weapon Chassis via `weaponProgressionEngine` (stash deduction on unlock/upgrade).

### Weapon Families (v1)

See **Weapon Families + Vertical Upgrade Tracks v1** above for the full roster, tier passives, persistence, and combat hooks.

**Tier III identity passives (examples):**

| Weapon | Tier III passive |
|--------|------------------|
| Runed Longsword | First melee hit each combat +5 Abyssal Reserve |
| Claymore-Blade | First Fracture each combat +15 Stamina |
| Rift Edge | Melee crits +5 Reserve |
| Silver-Core Sidearm | First reload each combat +10 Stamina |
| Pulse Rifle | After reload, next Ballistic attack +10% damage |
| Nullbreach Carbine | First hit vs armored enemy strips 1 extra armor |
| Null Conduit | First Occult ability each combat +5 Veil-Flux |
| Sanguine Prism | Once per combat, HP sacrifice grants +10 Veil-Flux |
| Echo Lantern | First debuff applied each combat +1 temporary ward |

**Deprecated (removed):** Legacy 3-blueprint system (`aegis_claymore`, `riftshot_pulse_rifle`, `envoy_hex`) and LOADOUT forge schematics (Pulse Rifle Frame, Claymore Strike, Containment Rig).

### Trinkets (Legacy Combat)

Mid-run combat trinkets (distinct from Expedition Relics):

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
- Kinetic armor layers (Phase 1: stack + % mitigation).
- Occult ward layers (Phase 1: stack + % mitigation).
- Fracture gauge / Fractured exploit state.
- Enemy intent telegraphs.
- Enemy turn queues and motion stages.
- Cargo consumable deployment.
- **Equipped weapon** — family + tier from run snapshot; stat mods and once-per-combat weapon passives via `weaponCombatEngine`.

### Defensive Layers

**Combat Refactor Phase 1** inverted the armor/ward ↔ Fracture relationship:

| Layer | Behavior |
|-------|----------|
| **Kinetic Armor (KA)** | Low stacks (0–3). While stacks > 0, reduces **kinetic** damage by ~22–28%. Not full immunity. |
| **Occult Wards (OW)** | Low stacks (0–3). While stacks > 0, reduces **occult** damage by ~22–28%. |
| **ARMOR_BREAK / WARD_BREAK** | Strip stacks. First full strip applies **Fracture**. |
| **ARMOR_PIERCE / WARD_PIERCE** | Ignore mitigation for the hit (may not strip). |
| **Fracture** | Exploit state: +20% damage taken, 0 enemy AP for the break window. Gauge fill still Fractures; **does not strip** KA/OW (defenses are the puzzle; Fracture is the payoff). |

Legacy flat absorb (`layers × 3`) is retired. Authored high layer counts are **normalized** at spawn into 0–3 stacks. Depth 1 early nodes (≤3) cap at 1 layered enemy and never both KA+OW on one unit. Depth 1 HP/dmg also soft-scaled (`depth1HpSoftMult` / `depth1DamageSoftMult`).

**Class starters:** Aegis `STRIKE` has `ARMOR_BREAK`; Hex `SILVER_CORE_SIDEARM` has `ARMOR_BREAK`, `WRAITH_PIERCER_ROUND` has `WARD_BREAK`; Envoy `VEIL_SPLINTER` has `WARD_BREAK`. Items: Grid-Cracker Mag / Eclipse Flare still strip and now trigger Fracture on break.

**Telemetry:** `BalanceCombatEncounterSample` records class/depth/enemy count + defense flags. Dev Test: `[ COMBAT BALANCE REPORT ]`, `[ CLASS DEFENSE COUNTERS ]`. Constants: `src/data/balance/combatDefenseBalanceConfig.ts`.

Also still in play:

- Evade posture / Fortify posture
- Void Ward / parry (Aegis)
- **Riposte Ready** (Aegis Phase 3) — Perfect Parry / Fracture / armor break arms next Strike cash-out
- Player shields / temporary mitigation
- Veil Barrier charges / Warden intercepts
- **Hex Shot ammo profiles** (Phase 3) — Breacher / Null / Flash / Hollow identities on existing shots; chamber bonus after tactical reload
- **Envoy catalysts** (Phase 3) — NULL/ECHO/BLOOD/ASH primed by spells; lightweight sequence payoffs on Veil Rot loop

### Class Combat Identity (Phase 3)

| Class | Loop | Signature payoff |
|-------|------|------------------|
| Aegis | Read intent → Parry/Guard → Fracture → Riposte | Perfect Parry arms Riposte; Strike +30% vs Fractured |
| Hex Shot | Load answer → break/interrupt → reload tempo | Chamber +15% after reload; profile tooltips |
| Envoy | Prime catalyst → sequence → collapse wards | NULL→ECHO Silencing Echo; Catalytic/Cataclysm |

Dev Test: `[ CLASS IDENTITY REPORT ]`, `[ CLASS COMBAT REPORT ]`.

**Combat Refactor Phase 4** adds an `EncounterObjective` layer beside legacy `CombatObjective` (`ERADICATE` / `SURVIVE_TURNS`).

| Template | Win mode | Notes |
|----------|----------|-------|
| **KILL_CALLER** | Kill marked Caller | Pressure replacement — board clear optional |
| **INTERRUPT_RITUAL** | Cancel CHANNEL telegraph | Hooks Phase 2 counterplay |
| **SURVIVE_TURNS** | Endure N enemy cycles | Generic hold |
| **HOLD_EXTRACTION_WINDOW** | Endure N cycles | Dirty Extraction / Emergency Recall |
| **CLEAR_ECHO** | Clear squad | Echo overlay framing + telemetry |
| **BREAK_ANCHOR_LINK** | Clear squad | Anchor assault framing + telemetry |
| **PROTECT_CARGO** (soft) | Value / telemetry | Stamped when unstable cargo present |
| **STABILIZE_RESOURCE / PREVENT_DETONATION** (soft) | Value / telemetry | Light timeline previews |

Dirty Extraction (`prepareDefendRiftEncounter`) stamps `HOLD_EXTRACTION_WINDOW` + legacy `SURVIVE_TURNS` (`DEFEND_RIFT_SURVIVAL_TURNS`), optional soft PROTECT_CARGO, and light timeline chips. Objectives **replace** pressure (incoming mitigation + alternate win) rather than stacking early Depth 1 eradicate fights.

Engines: `encounterObjectiveCatalog.ts`, `encounterObjectiveEngine.ts`, `combatTimelineEngine.ts`. Telemetry on `BalanceCombatEncounterSample.objective`. Dev Test: `[ OBJECTIVE REPORT ]`, `[ OBJECTIVE VALIDATION ]`, `[ OBJECTIVE TEMPLATES ]`, `[ DEFEND RIFT PREVIEW ]`.

### Combat Director + Juice (Phase 5)

Phase 5 stabilizes Phases 1–4 without adding major mechanics:

| System | Role |
|--------|------|
| **Combat Director** | Scores encounter pressure, caps mechanic density / hard-counter stacks, soft-caps unfair early Depth 1 fights, matches reward to risk |
| **Pressure score** | LOW–CRITICAL from HP/dmg/KA/OW/intents/objectives/cargo/echo/anchor |
| **Safety** | Strip dual KA+OW early, soft HP/dmg/stacks, lengthen tight Dirty Extraction timers, add incoming mitigation |
| **Juice hooks** | `CombatJuiceFeedbackEvent` metadata (hit-stop / shake / VFX-SFX cue ids) — no assets |
| **Danger pulse** | Start-of-player-turn HIGH/CRITICAL threat banner (Lock-On, Ritual, Extraction window, Anchor pulse) |

Wired at `prepareStandardCombatEncounter` / `prepareDefendRiftEncounter`. Metadata on `EnvironmentalModifiers.combatDirector` (lazy-safe for old saves). Telemetry: `sample.director` + `sample.juice`. Dev Test: `[ COMBAT DIRECTOR REPORT ]`, `[ ENCOUNTER PRESSURE REPORT ]`, `[ COMBAT FEEDBACK REPORT ]`, `[ DIRECTOR VALIDATION ]`, `[ DIRECTOR MOCK SCORE ]`, `[ FORCE JUICE FEEDBACK ]`.

**Combat Refactor Phase 2** layers Intent 2.0 metadata on the existing `EnemyIntent` string enum (does not replace it).

| Phase 2 type | Existing intents (examples) | Notes |
|---|---|---|
| **LOCK_ON** | `TARGET_LOCK`, `LASER_SIGHT` | Telegraph ≥1 turn; counters: Blind, Interrupt, Parry, Decoy, Kill |
| **CHANNEL** | `CHARGE`, `ARTILLERY_CHARGE`, `PAVEMENT_CRUSHER_CHARGE`, `SINKING_INTO_GRID` | Wind-up; counters: Interrupt, Silence, Ward Break, Kill |
| **HEAVY_ATTACK** | `WORLD_ENDER`, `PAVEMENT_CRUSHER`, `ARTILLERY_FIRE`, `OVERDRIVE_DISCHARGE` | Often follows a channel; Parry where catalog allows |
| **GUARD** | `FORTIFY`, `BINDING_WARD`, `VEIL_BARRIER` | Protects self/ally; counters: Guard Break, Armor Break, Fracture |
| **DETONATE** | `PREMATURE_IGNITION` | Must be telegraphed |
| **MARK / DEBUFF / BUFF** | `HEX_MARK`, `FIELD_REPAIR`, etc. | Support pressure |

Catalog: `src/data/enemyIntentCatalog.ts`. Counterplay: `resolveIntentCounterplay` in `enemyIntentCounterplayEngine.ts`. HIGH/CRITICAL telegraphs grant a player turn; counters can cancel telegraphs and apply Fracture. Depth gates in `combatIntentBalanceConfig.ts`. Dev Test: `[ ENEMY INTENT REPORT ]`, `[ INTENT VALIDATION ]`.

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

### Narrative tension mechanics (naming)

Do not confuse these systems:

| Name | What it is |
|------|------------|
| **Dead-Man’s Switch** | Hex Shot **combat graft** on Phase-Shift Reload (`hexShotGrafts` / `hexShotReducer`). Not a narrative minigame. |
| **Mechanic_ScavengeBar** | Old **narrative** loot/scavenge tension (InstabilityProtocol UI). Deprecated for new normal generation; still forceable in DevTest and supported for legacy. |
| **Mechanic_ShadowlineAscent** | Player-facing **Shadowline Ascent** — the in-game **stealth** minigame. A turn-based **3-lane × 9-step** vertical detection shaft: climb the **Runner Trace** from bottom-centre to the top **Exit Glyph**. Each turn pick **Ascend / Shift L / Shift R / Wait** (or arm the one-use **Dampener**); every action advances detection one beat, then it resolves on your new cell. Three detection types — **Cross-Scan** (horizontal scanline row), **Lane Watch** (watched column), **Sigil Pulse** (armed cell detonates next beat) — with current danger bright + next danger previewed (no hidden hits). **Shadow Pockets** (5) hide the Trace; the **Dampener** (1 charge) shrouds a single action. 3 **Exposure** = fail (recoverable from earlier mistakes). Fixed standard tuning; solver-validated boards (solvable at 0 Exposure, ideal 9–14 actions, cover meaningful, pure-ascend never a clean win). Stealth / patrol / surveillance / militarized fiction. Universal — no class/Cabal advantages. |
| **Mechanic_ConcealSlider** | **DEPRECATED in-game** — DevTest force + legacy nodes only (in-game stealth fiction now routes to **Shadowline Ascent**; legacy `Mechanic_ConcealSlider` nodes are remapped at runtime). Old **Scanner Sweep**: keep a signal cursor inside a moving blind zone on a 1D lane while hostile sweep pulses narrow/accelerate/shift the window. |
| **Mechanic_RiteOfConcordance** | Player-facing **Rite of Concordance** — the in-game **ritual-cleanse** minigame. A corrupted ritual circle with three unstable threads (**Blood / Ash / Void**), each carrying a corruption trace (red/purple glyph waveform). Select a thread and tune three controls — **Phase** (chant timing), **Frequency** (ritual cadence), **Intensity** (offering pressure) — until the cyan **counter-chant** waveform overlays the trace to **Concordance ≥ 85%**, then seal it (**CLEANSE**). Light pressure via **Dissonance Bursts**: every ~6–9s an unlocked thread flickers red and must be raised above threshold within **3s** (fail = −15 Stability); fussing with the wrong thread during a burst = −5 Stability. Cleanse all three before **Stability** (100) drains. Fixed standard difficulty (randomization = target waveform shapes, starting offset, which thread destabilizes, burst rhythm — never depth/class scaling). Occult diagnostic aesthetic (black glass, smoky red/purple corruption, cyan/white/violet cleansing, threads burn white-blue when cleansed). Ritual / sigil / occult fiction. Universal — no class/Cabal advantages. |
| **Mechanic_SigilTrace** | **DEPRECATED in-game** — DevTest force + legacy nodes only (in-game ritual/occult fiction now routes to **Rite of Concordance**; legacy `Mechanic_SigilTrace` nodes are remapped at runtime). Old **Ritual Echo**: Simon-style sequence with forbidden beats (shown in playback, skipped on input). |
| **Mechanic_LeyCircuitBreach** | Player-facing **Ley Circuit Breach** — the in-game **hacking** minigame. A 6×6 conduit-routing puzzle: rotate straight/elbow/T/cross conduits (plus **Inverter Glyphs** and non-conductive **Blockers**) to connect the **Source Sigil** (left edge) to the **Exit Seal** (right edge) so the signal arrives **connected AND in the required Grid/Veil polarity**. Inverters flip polarity in transit (odd count → different polarity, even/zero → same). Pressure = **Trace meter** (75s, +15% per short circuit, 3 short circuits or full trace = fail). Tron-meets-occult telemetry aesthetic. Universal — no class/Cabal advantages. |
| **Mechanic_SigilTumbler** | Player-facing **Sigil Tumbler** — the in-game **lockpick** minigame. An occult-tech ward: drag a **wardpick** needle around a circular resonance ring to find a hidden **Resonance Window** (40°), **hold tension** (drains **Stability**: 1/s inside, 4/s near, 12/s outside), then **set four glyph tumblers** by tapping each as its glyph crosses the sync line on a randomized four-beat rhythm. Bad set −20 Stability; 4 faults or 0 Stability = fail; all four set = success. Fixed standard difficulty (randomization = window angle, beat order, pulse phases). Tron-circuit-lock + occult-seal aesthetic. Universal — no class/Cabal advantages. |
| **Mechanic_CipherRite** | **DEPRECATED in-game** — DevTest force + legacy nodes only (in-game hacking fiction now routes to **Ley Circuit Breach**; legacy `Mechanic_CipherRite` nodes are remapped at runtime). Narrative hacking / occult decryption deduction puzzle (VEIL-OS memory-dump terminal UI). |
| **Mechanic_SignalAlignment** | **DEPRECATED in-game** — DevTest force + legacy nodes only (in-game lock/rift fiction now routes to **Sigil Tumbler**; legacy nodes remapped at runtime). Old **Veil Lock**: slot limited rotatable glyph keys into concentric rings to route signal to the core. |

#### v1 narrative minigame pool

1. **Ley Circuit Breach** (`Mechanic_LeyCircuitBreach`) — hacking / encrypted systems (6×6 polarity routing)
   Tags: encrypted, terminal, locked cache, intel vault, black-site, grid security, scanner lock, hack
   Loop: rotate conduits (straight/elbow/T/cross + inverter glyphs, blockers can't rotate) to route the signal Source Sigil → Exit Seal; the signal must arrive connected AND in the required Grid/Veil polarity (inverters flip polarity). Trace meter pressure; 3 short circuits or full trace = fail. Solution-first generation guarantees a solvable, not-pre-solved board needing ~8–16 rotations.
   *Deprecated:* **Cipher Rite** (`Mechanic_CipherRite`) — the old hacking minigame, now DevTest/legacy only (remapped in-game to Ley Circuit Breach).
2. **Shadowline Ascent** (`Mechanic_ShadowlineAscent`) — stealth / hostile scanner avoidance (turn-based 3-lane shaft)
   Tags: stealth, patrol, surveillance, watched cache, security sweep, Echo gaze, militarized
   Loop: climb the Runner Trace up a 3-lane × 9-step detection shaft to the top Exit Glyph. Each turn = one action (Ascend / Shift L·R / Wait / arm Dampener); detection advances a beat then resolves on your cell. Dodge Cross-Scans (row scanline), Lane Watches (column), and Sigil Pulses (armed cell detonates next beat); hide in Shadow Pockets (5), spend the one Dampener when trapped. 3 Exposure = fail (one mistake is recoverable). Fixed standard tuning; solver-validated boards (0-Exposure solvable, ideal 9–14 actions, cover meaningful, pure-ascend never a clean win).
   *Deprecated:* **Scanner Sweep** (`Mechanic_ConcealSlider`) — the old 1D blind-zone stealth minigame, now DevTest/legacy only (remapped in-game to Shadowline Ascent).
   Loop: track the moving blind zone on a 1D lane → stay inside to build Signal Mask → hold DAMP to steady vs sweep pulses (which narrow/accelerate/shift the window)  
3. **Rite of Concordance** (`Mechanic_RiteOfConcordance`) — ritual cleanse / occult counter-ritual (three-thread waveform alignment)  
   Tags: sigil, ritual, occult pattern, echo pattern, glyph lock, blood-rite  
   Loop: for each of three ritual threads (Blood / Ash / Void), tune Phase / Frequency / Intensity so the cyan counter-chant waveform overlays the red/purple corruption trace to Concordance ≥ 85%, then seal it; survive periodic Dissonance Bursts (raise the flickering thread above threshold within 3s or lose 15 Stability) and cleanse all three before Stability (100) drains. Fixed standard difficulty; randomization = target shapes, starting offset, destabilizing thread, burst rhythm. Solution-reachable generation (targets are perfect concordance; threads always start below threshold).  
   *Deprecated:* **Ritual Echo** (`Mechanic_SigilTrace`) — the old Simon-style forbidden-beats sequence, now DevTest/legacy only (remapped in-game to Rite of Concordance).  
4. **Sigil Tumbler** (`Mechanic_SigilTumbler`) — occult-tech lockpick / rift stabilization / warded seal  
   Tags: rift, leyline, stabilize, extraction vector, scanner repair, signal calibration, fracture seal, lock  
   Loop: drag the wardpick to find the hidden 40° resonance window → hold tension (Stability drains by zone: 1/4/12 per sec inside/near/outside) → set 4 glyph tumblers by tapping each on its sync-line beat (randomized four-beat rhythm); bad set −20 Stability, 4 faults or 0 Stability = fail. Fixed standard difficulty; randomization = angle, beat order, pulse phases.  
   *Deprecated:* **Veil Lock** (`Mechanic_SignalAlignment`) — the old glyph-key ring routing lock, now DevTest/legacy only (remapped in-game to Sigil Tumbler).

Deprecated:
5. **Scavenge Bar / Instability Protocol** (`Mechanic_ScavengeBar`) — legacy / DevTest only; never assigned by normal procedural generation.

**Plain loot rule:** abandoned stash, dead runner, loose credits, and simple resource pickups usually get **no** tension mechanic unless fiction adds a blocker (encrypted / watched / ritual-sealed / phase-shifted).

**Difficulty:** shared `tensionDifficultyFromDepth` stamps LOW/MEDIUM/HIGH/APEX onto `proceduralMeta` at assembly time. Universal — no class/Cabal bias.

**Telemetry (dev):** `narrative_minigame_started` / `narrative_minigame_completed` / `narrative_minigame_unknown_id` via `narrativeMinigameTelemetry.ts`.

Combat class minigames (Active Reload, Zero Protocol, etc.) are a **separate** platform and must not be mixed with narrative tension. Dead-Man’s Switch is a Hex Shot combat graft, not Cipher Rite.

Routing (`tensionMechanicRouting.ts`): stealth/patrol/militarized → Shadowline Ascent; tech/terminal/hack → Ley Circuit Breach; rift/ley/stabilize/lock → Sigil Tumbler; ritual/sigil/occult → Rite of Concordance; unmatched / plain stash → **no mechanic**. Unknown non-empty mechanic IDs fail loudly in `TensionMechanicHost` (no silent auto-success). All consequences route through `resolveNarrativeChoice` — minigames do not mutate run state directly.

## Known Partial Implementations / Design Debt

- **Progression Spine Phase 1 (complete — 1A–1J):** Runner Clearance, sector access mandates + route intel, Breach Grades I–III (IV/V catalog), pinned goals, class/cabal **reward hooks only**, recipe Known/Rumored/Unknown, debrief progression theater with always-exit, failure-recovery pity (boost@2 / guarantee@3), economy sim + pacing/recipe/soft-lock audits. Open follow-ups: wire class/cabal hooks to real content; Grade IV/V playable; deeper sector mastery reward trees; keep sim/oracle calibrated as XP curves change.
- **Economy Spine Phase 2A (complete):** `cargoStackCap` / `stashStackCap` registry fields; in-run cargo instance `quantity` with merge into incomplete stacks; unstable/contraband/route-intel forced to stack 1; quantity badges; discard rare/route-intel warnings; pickup replace + harvest leave-behind overlays; DevTest stack rules + merge smoke.
- **Economy Spine Phase 2B (complete):** Registry normalization (`primarySectors` / `secondarySources` / `depthRules` / carried-effect flags via `resourceSourceIdentity`); orphan validation gate; 2B.1 ownership states (carried/banked/extracted/lost); apex mid-run bank block; Safehouse ownership copy; DevTest registry + banking smoke.
- **Economy Spine Phase 2C (complete):** Frozen v1 roster — 21 economy + 4 route intel (`economyRosterV1.ts`); exact-match validation; DevTest roster freeze report.
- **Economy Spine Phase 2D (complete):** Per-sector farming tables (`sectorResourceTableEngine.ts`); drop identity + contract bias wired; PRIMARY ↔ `primarySectors` validation; DevTest sector tables report.
- **Economy Spine Phase 2E (complete):** Threshold / Breach / Deep Veil depth policies (`depthResourceRulesEngine.ts`); combat + identity drop gates; registry depthRules alignment; DevTest depth rules report.
- **Economy Spine Phase 2F (complete):** Typed reward packets + node recipes (`resourceRewardPacketEngine.ts`); Breach Grade quality bonuses (not pile ×N); extracted yield targets; combat/harvest/boss wired; DevTest packet report.
- **Economy Spine Phase 2G (complete):** Resource source hints — Exact / Partial / Unknown / contract-directed (`resourceSourceHintEngine.ts`); wired to Forge ledger/recipes, stash, Veil Front farming preview, debrief SOURCE INTEL; DevTest hints report.
- **Economy Spine Phase 2H (complete):** Economy report + debug simulation (`economySpineDebugEngine` / `economySpineSimulationEngine`); grant/clear/unlock tools; sector-depth sims; 100-node + 100-run sims; bottleneck WARNINGs; DevTest Phase 2H panel.
- **Economy Spine Phase 2I (complete):** Resource discovery state / light codex (`resourceDiscoveryEngine`); fogged → true name; best source + known uses; stash seed + routing marks; ledger/debrief/DevTest.
- **Economy Spine Phase 2J (complete):** Contract/op/market/appraisal integration — spawn-safe contract overrides, value lanes, fence matrix, sector-bias sync, integration report.
- **Economy Spine Phase 2K (complete):** Live economy event telemetry (`economyRunTelemetryEngine`) — generated/left-behind/swaps/occupancy/unstable carry + career craft/fence; DevTest Phase 2K.
- **Economy Spine Phase 2L (complete):** Save migration (`economySaveMigrationEngine`) — legacy stash/contract id remap, unknown refs fail closed, craft/weapons preserved; wired on account + world hydrate; DevTest Phase 2L.
- **Economy Spine Phase 2M (complete):** Tuning pass (`economyTuningEngine`) — design questions + hard balance rails; D1 sector packets; Ley-Slag sink diversification; Ashen/Null PRIMARY promotions; D2/D3 yield nudges; DevTest Phase 2M.
- **Economy Spine polish (complete):** `economySpineAuditEngine` verify/acceptance; fence lane labels; forge discovery fog; debrief first-find DISCOVERED; REPLACE stack qty; forge consumable dedupe; Blackline bottleneck false-positive fix. Phase 2 closed.
- **Contract loop v1 (complete):** Resource model, physical banking, contract board, Veil Front integration, run event tracking, contract resolver, unified run debrief (extract + death via `OperationDebriefScreen`), procedural operation generation, operation lifecycle (ACTIVE / COMPLETED / expiration / AFTERMATH rotation), mid-run operation target contribution with debrief transmission line, sponsor perks on deploy/contract summary, operation intel log on Veil Front briefing, expanded operation contribution on extract, **debrief progress headline** (`+N progress this run`), **reward preview** on Veil Front cards/briefing/deploy modal, and **world state validation + dev debug tooling** (Phases A–F).
- **Unstable cargo carried effects v1 (complete):** Three unstable resources with deduped carried modifiers, lazy procedural type/context rolls, cargo pressure UI, debrief Cargo Pressure block, volatile resonance tagging, occupancy resonance multiplier, emergency recall Veil-Ash warning log.
- **Echo encounters v1 (complete — Phases 1–6):** Echo scanner overlays at layer unlock, per-depth/run caps, weighted encounter kinds, fallen-runner narrative, assist/cargo/extraction immediate resolution, hostile combat routing, class-based hostile templates with depth scaling, hostile echo reward rolls, debrief Echo section, dev forcing tools, echo pipeline validation (reward-resource existence + Echo Recovery contribution rules), `echoRunState` tracking, Veil Front echo intel surfaces, reward-stack extraction tracking, Smuggler's Ledger fallen-runner drop, extraction echo emergency-recall bleed bonus. Acceptance criteria (20) verified in the Echo Encounters v1 section below.
- **Expedition relics v2 (complete — Phases A–F):** 20-relic pre-run loadout with deployment choices, in-run branch modals, scanner/cargo/economy/contract/safehouse/echo hooks, live HUD counters, trigger toasts, debrief parity, registry + acceptance + combat-stat audit on boot. Internal code uses `Keepsake*` naming; player-facing copy uses **Expedition Relic**.
- **Run Integration + Progression Audit v1 (complete):** Full-loop audit, aggregated validation, debrief outcome detail, anchor/crafting/next-steps, pacing presets, balance telemetry, content matrix, sponsor rep preview.
- **Full Run Balance + Tuning Framework v1 (Phase A):** Central `src/data/balance/` registry for combat/reward/economy/contract/operation/scanner knobs + target comments; DevTest BALANCE CONFIG dump.
- **Weapon Families + Vertical Upgrade Tracks v1 (complete):** 9 weapon families × 3 tiers, Loadout Weapon Chassis unlock/equip/upgrade, run snapshot, combat stat hooks + tier-III passives, debrief opportunities, validation + dev tools. Legacy blueprint forge recipes removed.
- **Run Items v2 (complete — Phases A–F + polish):** 24-item combat consumable + field tool roster in dedicated 2+2 slots, combat/field engines, hub loadout + fabrication filters, black market tap-to-buy + cargo drag split, live HUD + toasts + brought/remaining debrief, registry + acceptance + boot audit. Bound Requisitions remain separate.
- **Post-run cargo routing v1 (complete — Phases 1–10):** Full post-extract cargo routing pipeline with Veil Front + hub intel surfaces, live debrief preview/validation, partial stackable routing, casket open-at-hub v1, deferred contract delivery, death cargo messaging, runtime + intel + fixture + sim validation, catalog audit engine, cleanup/ship pass, `cargoRoutingRunState` + `careerCargoRouting` tracking, debrief summary wiring, hub contract board + safehouse + extraction review + scanner + loadout + cargo pressure surfaces, hub log on routing confirm, dev audit/validate/inspect tooling, compact debrief parity. Acceptance criteria (63) in Post-Run Cargo Routing v1 section.
- **Run World Brief + Procedural Director + Sector Aftermath v1 (complete):** Unified deploy brief with crisis theme/resource stress/threat profile; director validation, pressure scoring, manifestation checks, safety caps, explainability; 10-rule sector aftermath with stackKey merge, intensity, sector-local ticking, debrief preview + persistence, brief bias application, idempotency guard, validation + dev sim tools. See Run World Brief section above.
- **Combat Refactor Phase 1 (complete):** Kinetic Armor / Occult Wards as % mitigation stacks; break→Fracture payoff; Fracture no longer strips defenses; Depth 1 soft HP/dmg + stack caps; class starter break tags; combat balance report + class counter validation; legacy layer normalization at spawn.
- **Combat Refactor Phase 2 (complete):** Enemy Intent 2.0 catalog layered on existing `EnemyIntent` enum; LOCK_ON / CHANNEL / GUARD / HEAVY_ATTACK metadata; `resolveIntentCounterplay`; Fracture payoff on HIGH counters; class counter tags (Parry / Interrupt / Ward Break); intent UI severity + turns remaining; intent telemetry + Enemy Intent Balance Report; depth telegraph validation.
- **Combat Refactor Phase 3 (complete):** Class identity loops polished — Aegis Riposte Ready after Perfect Parry; Hex Shot ammo profiles + chamber bonus on reload; Envoy lightweight catalysts (NULL/ECHO/BLOOD/ASH) on Veil Rot spells; class loop telemetry; Class Identity / Class Combat Dev Test reports.
- **Combat Refactor Phase 4 (complete):** EncounterObjective layer + v1 templates (Caller / Ritual / Survive / Hold Extraction / Echo / Anchor + soft Protect Cargo); Dirty Extraction wired to SURVIVE/HOLD; light combat timeline previews; objective telemetry + DevTest reports.
- **Combat Refactor Phase 5 (complete):** Combat Director (pressure / density / fairness / safety / reward-risk); juice feedback hooks + hit-stop defaults; start-of-turn danger pulse; director + pressure + feedback reports; DevTest sims; prep-time soft caps without new combat mechanics.
- **Narrative tension naming + routing cleanup (Phase 1 — Cipher Rite prep):** ScavengeBar deprecated from normal generation; ConcealSlider / SigilTrace / no-mechanic remapping; unknown tension IDs no longer silent-succeed; Dead-Man’s Switch combat graft unchanged.
- **Narrative Cipher Rite (Phase 2 — complete):** `Mechanic_CipherRite` deduction hacking minigame (`cipherRiteEngine` + `CipherRite`); tech/terminal/locked-cache routing; DevTest force; wrong guesses corrupt UI only; no combat / Hex Shot changes.
- **Narrative Scanner Sweep + Ritual Echo (Phase 3 — complete):** `Mechanic_ConcealSlider` → Scanner Sweep radar stealth; `Mechanic_SigilTrace` → Ritual Echo with forbidden beats; IDs preserved; DevTest labels updated; no combat changes.
- **Narrative Signal Alignment (Phase 4 — complete):** `Mechanic_SignalAlignment` spatial ring puzzle; rift/ley/stabilize routing; DevTest force; v1 narrative minigame pool complete (Cipher / Sweep / Echo / Alignment); ScavengeBar remains deprecated.
- **Narrative minigame Phase 5 (complete):** routing audit + plain-loot no-mechanic rule; shared depth difficulty; DevTest thematic scenarios for all 5 force options; outcome copy polish; lightweight minigame telemetry; unknown-ID safety retained; docs final v1 map.
- **Narrative minigame Phase 6 (complete):** Scanner Sweep depth — shadow pockets, damp-required mask capture, stationary lock anti-camping; Signal Alignment depth — glyph gates, severed blockers, decoys, ALIGN-only validation (no live green bands); DevTest copy updated; Cipher Rite / Ritual Echo / combat untouched.
- **Narrative minigame Phase 6 polish (complete):** All narrative tension minigames now pop in a centered modal over a darkened stage (`TensionMechanicModal`), mirroring the in-combat cargo/inventory overlay pattern (fixes Veil Lock controls being clipped/unreachable; its body is now scrollable). Scanner Sweep gained a traveling **detection beam** that spikes Detection when it crosses an exposed cursor (skilled tracking stays clean; sloppy play gets caught) for a stronger "avoid detection" feel. Cipher Rite reskinned into a **VEIL-OS memory-dump terminal** (hex-addressed junk with cipher fragments embedded as `[TOKEN]` glyph keys + inert `[dud]` clusters and a breach log) — Fallout-hacking-inspired likeness/resonance scoring, not a copy. Engine logic, IDs, routing, and telemetry unchanged.
- **Narrative minigame Phase 6 rework (complete):** Scanner Sweep replaced with a **1D blind-zone tracking** minigame (keep cursor inside moving mask window; sweep pulses narrow/accelerate/shift it; DAMP steadies with reduced mask+detection gain) — removed the free radar pip / shadow pockets / stationary lock. Signal Alignment reworked into **Veil Lock** (player-facing title) — a limited rotatable **glyph-key** insertion puzzle (pipe-routing + Starfield-style lockpicking): keys consumed once, rings complete outer→inner, decoys at MEDIUM+, RESET RING budget, solution-first generation guarantees solvability. IDs (`Mechanic_ConcealSlider`, `Mechanic_SignalAlignment`), routing, and telemetry preserved; Cipher Rite / Ritual Echo / combat untouched.
- **Ley Circuit Breach (in-game hacking replacement — complete):** New narrative hacking minigame `Mechanic_LeyCircuitBreach` (`leyCircuitBreachEngine` + `LeyCircuitBreach`) — a 6×6 conduit-routing puzzle where the signal must reach the Exit Seal connected AND in the required Grid/Veil polarity (Inverter Glyphs flip polarity; Blockers can't conduct/rotate). Tuning: 75s Trace timer, 3s grace, signal advances 1 tile / 0.65s, +15% Trace per short circuit, 3 short circuits or full Trace = fail. Solution-first seeded generation (validated 300/300 solvable, none pre-solved, all needing 8–16 rotations). Tron-meets-occult styling (Grid = cyan, Veil = purple/red). Success routes the existing narrative boon/credit reward pool (`LEY_POOL`); failure uses the node's existing narrative penalty — no separate hacking economy or combat changes. **Cipher Rite (`Mechanic_CipherRite`) deprecated in-game**: removed from active generation, remapped to Ley Circuit Breach at runtime, but retained for DevTest force (`[ CIPHER RITE (DEPRECATED) ]`) and legacy nodes. IDs/routing/telemetry for other mechanics unchanged; no combat systems touched.
- **Sigil Tumbler (in-game lockpick replacement — complete):** New occult-tech lockpick minigame `Mechanic_SigilTumbler` (`sigilTumblerEngine` + `SigilTumbler`) replacing Veil Lock in-game. Drag a wardpick to a hidden 40° **Resonance Window**, **hold tension** (Stability drains 1/4/12 per sec inside/near/outside), and **set four glyph tumblers** on a randomized four-beat rhythm by tapping each as its glyph crosses the sync line (~0.3s window). Fixed standard tuning: 4 tumblers, Stability 100, bad set −20, 4 faults or 0 Stability = fail, all four set = success; no depth/class scaling — randomization is angle + beat order + pulse phases only. Tron-circuit-lock + occult-seal styling (cyan outer ring, violet sigils, white-hot wardpick, red glitch on faults, iris-open success). Success/failure route the existing narrative reward/penalty path (no separate lock economy); simulated 200/200 winnable by skilled play with the window always starting off-resonance. **Veil Lock (`Mechanic_SignalAlignment`) deprecated in-game**: removed from active generation, remapped to Sigil Tumbler at runtime, retained for DevTest force (`[ VEIL LOCK (DEPRECATED) ]`) and legacy nodes. No combat systems touched.
- **Shadowline Ascent (in-game stealth replacement — complete):** New turn-based stealth minigame `Mechanic_ShadowlineAscent` (`shadowlineAscentEngine` + `ShadowlineAscent`) replacing Scanner Sweep in-game. Climb the **Runner Trace** up a **3-lane × 9-step** vertical detection shaft to the top **Exit Glyph**. Each turn = one action (Ascend / Shift L·R / Wait / arm the one-use **Dampener**); every action advances detection one beat, then resolves on the new cell. Three detection types: **Cross-Scan** (row scanline), **Lane Watch** (watched column), **Sigil Pulse** (armed cell detonates next beat) — current danger bright, next danger previewed (no hidden hits). **Shadow Pockets** (5) hide the Trace; the Dampener shrouds a single action. **3 Exposure = fail** (one mistake is recoverable). Fixed standard tuning (Exposure 3, Pockets 5, 3 detection sources, 1 Dampener; no depth/class scaling — randomization = exit lane, cover placement, scan/watch timing, sigil placement, safe route). Solver-validated seeded generation (simulated 400/400 solvable at 0 Exposure, all ideal routes 9–14 actions, Dampener helpful 399/400, no hand-fallbacks; pure "ascend every turn" is never a clean win). Occult security-feed styling (black glass shaft, cyan/violet neon lanes, void-smear pockets, red-orange scanlines, red-black failure lock, white-purple Runner with smoky afterimage). Success/failure route the existing narrative reward/penalty path (reuses `CONCEAL_POOL`, no separate stealth economy). **Scanner Sweep (`Mechanic_ConcealSlider`) deprecated in-game**: removed from active generation, remapped to Shadowline Ascent at runtime, retained for DevTest force (`[ SCANNER SWEEP (DEPRECATED) ]`) and legacy nodes. No combat systems touched.
- **Rite of Concordance (in-game ritual-cleanse replacement — complete):** New ritual minigame `Mechanic_RiteOfConcordance` (`riteOfConcordanceEngine` + `RiteOfConcordance`) replacing Ritual Echo in-game. A corrupted ritual circle with three unstable threads (**Blood / Ash / Void**); for each, tune **Phase** (chant timing), **Frequency** (ritual cadence), and **Intensity** (offering pressure) so the cyan **counter-chant** waveform overlays the red/purple **corruption trace** to **Concordance ≥ 85%**, then seal it. Light pressure via **Dissonance Bursts**: every ~6–9s an unlocked thread flickers red and must be raised above threshold within **3s** (fail = −15 Stability); working the wrong thread during a burst = −5 Stability. Cleanse all three before **Stability** (100) drains. Fixed standard tuning (threshold 85%, no depth/class scaling — randomization = target waveform shapes, starting offset, destabilizing thread, burst rhythm). Solution-reachable seeded generation (simulated 500/500 with every thread starting below threshold, avg start ~69%, and all targets perfectly reachable; greedy tuning wins 400/400 in ≤9 steps/thread). Occult diagnostic styling — black glass bands, smoky red/purple corruption glyphs, cyan/white/violet cleansing chant, threads burn white-blue when cleansed, red-black RITE CONTAMINATED lock on failure. Ritual language throughout (Rite, Thread, Concordance, Dissonance, Purity, offering pressure); success/failure route the existing narrative reward/penalty path (reuses `SIGIL_POOL`, no separate ritual economy). **Ritual Echo (`Mechanic_SigilTrace`) deprecated in-game**: removed from active generation, remapped to Rite of Concordance at runtime, retained for DevTest force (`[ RITUAL ECHO (DEPRECATED) ]`) and legacy nodes. No combat systems touched.
- **Safehouse banking:** Physical in-run banking via `runBankedSnapshot` — banked cargo survives death and routes to hub stash. Unbanked cargo is lost on death (`runResourceLedger.lostOnDeath`). Extraction merges banked + carried cargo before deposit.
- Target Fragment has a catalogued combat effect but is marked `unimplemented`.
- Kinetic Hollow Points / Veil-Vial is described as next attack +15 damage but is marked `unimplemented`.
- Gravity Grapple exists as a cargo tool tag but does not have a wired combat/scanner handler in the inspected files.
- Hub legacy `equipment.trinketId` socket remains a separate placeholder from expedition relic equip flow.
- Some item descriptions and implementation values drift:
  - Standard Coagulant craft description says 25 HP, while Coagulation Stitch catalog uses 10% HP.
- SafehouseHubPanel still exists in code but is no longer in the hub navigation.
- Some enemy/boss behaviors are phase-driven or hook-driven and should be documented more deeply per boss/encounter if balancing continues.
- Base enemy roster stats and scaled encounter stats are separate; tuning should check both `enemyRoster.ts` and `enemyDefinitions.ts`.

## Design Implications

- The game already has enough systemic surface to support a strong tactical roguelite loop: prep, risk routing, cargo management, tactical combat, resource extraction, and sponsor contracts.
- **Progression Spine** makes Veil Front a long-term machine: where to breach, at what grade, what intel to extract, what to pin next — without forcing Null Zone power creep.
- Resource taxonomy now separates category from role (crafting intel vs economy intel vs fence value); route intel is a protected INTEL subtype.
- Enemy identity is strong, but intent documentation should become a player-facing codex or internal balancing table.
- Cargo is doing several jobs at once: loot value, tactical consumables, scanner tools, extraction tension, resonance risk, and **sector unlock cargo**. This should remain central to run identity.
- Loadout is the home for class, **weapon chassis** (family + tier), ability deck, **expedition relic** equip, Run Items, and cargo prep.
- Black Market split: Forge for augments/consumables; Vendor for contraband. Weapon progression lives on Loadout, not Forge. Recipe visibility stages forge overload.

