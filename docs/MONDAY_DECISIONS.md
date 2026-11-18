# Monday Decisions — Emberline Studios Game CX

Generated: 2026-11-18. Items that need your input before work can continue.

---

## 1. ABAC masking policy (3c part 2) — READY TO CREATE

**What's done:** `mask_pii` column mask function exists and tested. Group `game_cx_pii_viewers` created by you (confirmed 2026-11-18). Pipeline runs as `mayur.gupta@databricks.com`, who is in the group — silver/gold will materialise real values.

**Decision needed:** Confirm you want `mask_pii_policy` created now. This applies the column mask to `email` and `phone_number` on `silver_players` and `gold_dim_player`. Non-members (everyone outside `game_cx_pii_viewers`) will see `***REDACTED***` for those two columns.

**Blocker for:** Nothing downstream — the mart and ML scores do not expose raw email/phone.

---

## 2. Data quality monitors (3d) — DEFERRED, limit still in place

**Situation:** Workspace is at the 1,000-monitor limit. Script `governance/create_quality_profiles.py` is committed and ready to run.

**Decision needed:** Ask a workspace admin to free monitor capacity (delete unused monitors), then run the script. Or accept that monitors remain deferred until after the demo.

**Impact:** No effect on correctness or the demo — this is observability only.

---

## 3. Sub-domains in Discover — BLOCKED by account tag limit

**Situation:** Each sub-domain requires a new account-level governed tag (slash pattern). The account tag quota is exhausted. Custom sections on domain pages are in place as a substitute.

**Decision needed:** Ask an account admin to either raise the governed-tag quota or delete unused tags to free capacity.

**Impact:** Low — the custom sections on Player-Trust-Safety and Player-Experience pages cover the same grouping visually.

---

## 4. Second metric view for session-grain KPIs — NOT STARTED

**Situation:** `mv_player_trust_safety` covers `gold_fact_event` (purchases, chargebacks, reports). DAU, MAU, retention, stickiness, and live-ops event uplift need a separate metric view on `gold_fact_session`.

**Decision needed:** Agree to build `mv_player_engagement` (working name) on `gold_fact_session`. Proposed dimensions: `session_date`, `game_title`, `genre`, `player_region`, `age_band`, `is_high_value_player`. Proposed measures: `dau`, `mau`, `dau_mau_ratio`, `d7_retention`, `d30_retention`, `avg_session_duration_min`, `avg_matchmaking_quality`. Can be done before Phase 6 (Genie agents) where these KPIs matter.

---

## 5. Toxicity beyond the 10K cap — OPTIONAL

**Situation:** 10,000 messages were classified (7K reported + 3K random). There are 29,472 distinct reported messages in total. The LLM achieved F1 0.994 on the sample.

**Decision needed:** Whether to extend the toxicity run to cover all 29,472 reported messages (additional ~20K calls to `system.ai.meta-llama-3-3-70b-instruct`). The sample is likely sufficient for the demo. Worth doing only if toxicity scoring at the player level needs higher coverage.

---

## 6. Phase 5 — Lakebase (cost decision)

**Situation:** Lakebase creates a running Postgres instance (`game-cx-players-lakebase`). There is an ongoing cost for as long as the instance is live. Nothing past Phase 4 has been started.

**Decision needed:** Approval to start Phase 5. Recommend doing this close to the demo date so the instance does not run idle for long.

---

## 7. Production mode for the pipeline

**Situation:** Pipeline `game-cx-players-pipeline` is in development mode (your decision from 2026-11-12). PLAN defers production mode to Phase 7 when the DAB bundle is set up.

**Decision needed:** No action now — revisit at Phase 7 (`databricks.yml` bundle).

---

## 8. ai_query through custom Unity Gateway services — product limitation

**Situation:** `ai_query` on the custom `game-cx-players-llm` gateway service fails with "ai_query through UC Model Services is not enabled". The [docs confirm](https://docs.databricks.com/aws/en/large-language-models/ai-query/) this is a current product limitation — custom Unity Gateway services are not yet supported by `ai_query`. The workspace setting "AI Query for Custom Models" does not change this.

**Current workaround:** Phase 4c used `system.ai.meta-llama-3-3-70b-instruct` directly. The gateway service is still used by the Genie agents and the app.

**Decision needed:** None unless you want to escalate to your Databricks account team to request early access.
