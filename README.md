# Emberline Studios: Player Trust & Safety on Databricks

**One governed Player 360 that stops payment fraud, catches toxic players and cheaters, and puts every decision in one console,
with each moderator action flowing back into the data. Estimated value: about $10.5M a year for a $600M-bookings publisher
($5.3M if only half is realized).**

Emberline Studios (fictional) runs 6 live-service titles. Three teams each see part of the player:

| Leak | Owner | Measured in the data | What the build does |
|---|---|---|---|
| Payment fraud (stolen cards, fraud rings) | Head of Payments Risk | Chargeback rate 1.12%; losses + fees = 2.96% of gross; shooters earn 46% of revenue but cause 81% of chargeback loss | Fraud model: top 1% review catches 75.6% of chargeback $; 155 rings shown as one story with bulk actions |
| Toxicity | Trust & Safety operations | 9.7% of players are victims; victims churn 75.9% vs 55.6% | LLM toxicity labels (F1 0.994 vs keyword 0.191); warn queue with reasons |
| No Player 360 | VP Player Experience & Trust | Sessions, payments, chat, reports, moderation in separate systems | One mart, one served profile, one console, 2 Genie agents |

Deck: [docs/DECK.md](docs/DECK.md). Role-play script: [docs/ROLEPLAY_SCRIPT.md](docs/ROLEPLAY_SCRIPT.md). How AI was used: [docs/AI_BUILD_LOG.md](docs/AI_BUILD_LOG.md).
Verification: [evidence/e2e_verification.md](evidence/e2e_verification.md).

## The journey (one connected flow)

```
Synthetic source files (3,659 daily files, 2025-01-01 .. 2026-12-31, as_of_date 2026-12-31)
  -> UC volume raw/                                                           Unity Catalog
  -> Lakeflow SDP pipeline: 9 bronze -> 9 silver -> 6 dims + 2 facts + mart   Lakeflow (expectations drop 21,606 bad sessions)
  -> Unity Catalog: comments, tags, PII column masks, 2 metric views, domains Govern
  -> ML: fraud model + churn model (MLflow, UC registry); GenAI toxicity (ai_query); cheat rule   Intelligence
  -> gold_mart_player_360 (50K players, recommended_action)
  -> Lakebase: lb_serve_player_risk_profile (synced, 3.9 ms lookup)           Operational serving
  -> 2 Genie agents on the metric views + mart                                Natural language
  -> Databricks App game-cx-players-console                                   Business surface
  -> moderator action -> Lakebase lb_moderation_actions (12 ms write)
  -> daily job: sync actions to Delta -> pipeline -> Lakebase sync            Closed loop (verified end-to-end)
```

Proof the layers are connected: one `warn` on player P000090 written in the app's table appeared in bronze, the fact table,
the mart, the metric view and the served Lakebase profile after one 2.7-minute job run ([evidence](evidence/e2e_verification.md#1-closed-loop-round-trip)).

## What is in the workspace

| Layer | Asset |
|---|---|
| Schema | `mg_aws_serverless_workspace_catalog.game_cx_players` (volumes `raw`, `ground_truth`) |
| Pipeline | `game-cx-players-pipeline` (8cc02b90-7598-4b0a-917a-0c7f64b78b6a), 27 datasets, serverless |
| Gold | `gold_dim_player/game/device/date/geography/live_ops_event`, `gold_fact_session` (7.08M), `gold_fact_event` (PURCHASE / REPORT / ACTION), `gold_mart_player_360` |
| Semantic layer | `mv_player_trust_safety` (event grain), `mv_player_engagement` (session grain: MAU, DAU, stickiness, matchmaking, live-ops reach) |
| ML | `fraud_txn_classifier@champion`, `churn_player_classifier@champion`, `ml_toxicity_message_labels`; feature tables `ml_feat_*` |
| Lakebase | Project `game-cx-players-lakebase`: `lb_serve_player_risk_profile` (synced), `lb_moderation_actions` (write-back) |
| Genie | `Emberline - Fraud & Trust Safety` (01f1e3a90ede1597be6672ea8668991e), `Emberline - Player Experience & LiveOps` (01f1e3acd3fc1b039e9c20dbf124669b); 10/10 benchmarks each |
| BI | Dashboard `Emberline Player Trust & Safety`; alerts `game-cx-players-fraud-ring-alert`, `game-cx-players-toxicity-spike-alert` |
| App | `game-cx-players-console`: Executive Overview, Risk Queue, Player 360, Fraud Rings, Ask Trust & Safety, Ask Player Experience |
| Job | `game-cx-players-daily-refresh`, 06:00 PT: sync actions -> pipeline -> Lakebase sync |

## Repo layout

```
databricks.yml, resources/      Root bundle game-cx-players: pipeline, daily job, 2 alerts, dashboard (dev + prod targets)
pipelines/transformations/      Pipeline SQL: bronze/, silver/, gold/{dims,facts,mart}
notebooks/                      01 generate data, 02 fraud model, 03 churn model, 04 toxicity, 05 Lakebase, 06 closed-loop sync (outputs committed)
governance/                     mask_pii.sql, metric view definitions, domain tags, quality-profile script
dashboards/                     Dashboard JSON
app/game-cx-players-console/    AppKit (React + TypeScript) app with its own bundle
evidence/                       Reconciliation, ML evaluation, end-to-end verification
docs/                           PLAN, DECK, ROLEPLAY_SCRIPT, AI_BUILD_LOG, MONDAY_DECISIONS
skills/gaming-cx/               Genie Code skill with the data model and business vocabulary
```

## Deploy

1. Run `notebooks/01_generate_raw_data` once (writes the raw and ground-truth files).
2. `databricks bundle deploy --target dev` at the repo root (pipeline, job, alerts, dashboard). Run the pipeline.
3. Run notebooks 02-05 (models, toxicity labels, Lakebase project and synced table).
4. Run `governance/mv_player_trust_safety.py` and `governance/mv_player_engagement.py`.
5. Grant the app service principal `SELECT` on `mv_player_trust_safety`, `mv_player_engagement`, `gold_dim_player` and `USE SCHEMA`,
   and Postgres `SELECT` on `lb_serve_player_risk_profile` and read/write on `lb_moderation_actions`. **Grant before deploying:**
   the app build type-checks every query against the warehouse, and a missing grant fails the deployment.
6. In `app/game-cx-players-console`: `databricks bundle sync --target dev --full`, then `databricks apps deploy`.

Target assumptions: Unity Catalog, serverless compute and SQL warehouse, Lakebase autoscaling, Genie, Databricks Apps.
The `dev` target pins the demo workspace host; `prod` uses production mode.

## Decisions and trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| Synthetic data with built-in signal | Fraud, chat and telemetry must share the same players; ground truth lets every model be measured | Fraud loss rate is higher than a typical studio; value model shows the half-rate case |
| Simulated as-of date 2026-12-31 | Two full years for clean comparisons | Every relative date uses `as_of_date`, never `current_date()` (enforced in Genie instructions and benchmarks) |
| 2 gold facts, not 6 | Gold models the business (gameplay vs account events); chargebacks merge onto purchases | Bronze/silver stay source-shaped |
| Lakebase for the app, warehouse for KPIs | Lakebase: 3.9 ms lookups and transactional write-back; warehouse: aggregates through the metric views | Two data paths; the daily job keeps them in step |
| Daily snapshot sync of actions | Small table, idempotent, Delta history keeps every version | Actions reach analytics next morning, not instantly (the app itself updates instantly) |
| LLM toxicity on 10K sampled messages | F1 0.994 vs 0.191 for keywords, bounded cost | Not every message is labelled; production would score reported messages as they arrive |
| `ai_query` on a system model instead of the AI Gateway service | `ai_query` cannot call custom gateway services in this workspace | Gateway guardrails not applied to the batch run |
| Transparent cheat rule, not a model | Moderators can explain every flag; precision 1.000 | Recall 0.936; players with no shooter sessions cannot be flagged |
| Column masks in the pipeline, not a schema ABAC policy | Masks on materialized views must be declared in the column spec | A new PII column needs a pipeline edit |
| Two Genie agents, not one | Fewer tables per agent, sharper answers | Two tabs in the app |
| App in its own bundle | Separate deploy cadence and build | Two `bundle deploy` commands |

Not done (and why): Slack delivery, AI Gateway budget, UC sub-domains (admin rights or account limits); Lakehouse quality monitors
(workspace at its 1,000-monitor limit). See `docs/PLAN.md` deferred items.
