# Phase 11: End-to-end verification

Run on 2026-11-20 against `mg_aws_serverless_workspace_catalog.game_cx_players` (simulated `as_of_date` 2026-12-31).
Every number below was measured in this run, not copied from earlier phases.

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Closed loop: a new moderator decision reaches every layer in one job run | PASS |
| 2 | Row-count and revenue reconciliation bronze -> silver -> gold -> metric views | PASS |
| 3 | Daily job `game-cx-players-daily-refresh` (bundle-managed) | PASS, 3 runs SUCCESS |
| 4 | Lakebase latency (serving read, write-back) | PASS, 3.9 ms read, 12.1 ms write |
| 5 | PII masking (`mask_pii` on 4 columns) | PASS for member; non-member verified in Phase 3c |
| 6 | Cheat detection vs ground truth | PASS, precision 1.000 |
| 7 | Genie agents (benchmarks after Phase 9 changes) | PASS, 10/10 each |
| 8 | SQL alerts, dashboard, app | PASS |
| 9 | Secret scan on everything committed | PASS, 0 blockers |

## 1. Closed loop round trip

One `warn` decision was written to Lakebase for player `P000090` (open `warn_toxicity`, highest toxicity score, no prior action),
exactly as the console app does (parameterized `INSERT` into `game_cx_players.lb_moderation_actions`). Notes: `E2E verification 2026-11-20`.
Then the daily job was run once (run `824182865617397`, 2.7 min: sync 0.8, pipeline 1.4, Lakebase sync 0.5).

| Layer | Before | After |
|---|---|---|
| Lakebase `lb_moderation_actions` | 16 rows | 17 rows (action_id 23) |
| Delta `bronze_app_moderation_actions` | 16 | 17 (action_id 23, P000090, warn) |
| `gold_fact_event` ACTION / total | 16 / 1,005,603 | 17 / 1,005,604 |
| `gold_mart_player_360` P000090 | actions_taken 0, no latest action | actions_taken 1, latest_action_type `warn`, ts 2026-11-20 23:55:07 UTC |
| `mv_player_trust_safety` action_count / warnings_issued | 16 / 6 | 17 / 7 |
| Lakebase served `lb_serve_player_risk_profile` P000090 | actions_taken 0 | actions_taken 1, `warn` |

The recommendation stays `warn_toxicity`: the mart records that a moderator acted, and the app counts the player as handled
(open `warn_toxicity` 1,649 -> 1,648). The test row is kept as part of the demo history.

## 2. Reconciliation (measured after the closed-loop run)

| Entity | Bronze | Silver | Gold | Result |
|---|---|---|---|---|
| Players | 50,000 | 50,000 | gold_dim_player 50,000; mart 50,000 | PASS |
| Sessions | 7,099,350 | 7,077,744 | gold_fact_session 7,077,744 | PASS (21,606 negative-duration rows dropped by expectation) |
| Transactions | 948,078 | 948,078 | gold_fact_event PURCHASE 948,078 | PASS |
| Revenue (USD) | | 20,141,969.22 | 20,141,969.22 | PASS, identical to the cent |
| Chargebacks | 9,442 | 9,442 | | PASS |
| Player reports | 57,509 | | gold_fact_event REPORT 57,509 | PASS |
| Moderator actions | 17 | | gold_fact_event ACTION 17 | PASS |

Metric view cross-checks: `mv_player_engagement` session_count = 7,077,744 (= gold_fact_session); active_players all-time = 48,362
(= 50,000 players - 1,638 who never played).

## 3. Daily job

Job `game-cx-players-daily-refresh` (id 446833087163558), managed by root bundle `game-cx-players` (target dev), schedule 06:00 America/Los_Angeles.

| Run | Trigger | Result | Duration |
|---|---|---|---|
| 280736187692784 | First run (job created via API) | SUCCESS | 2.9 min |
| 747116967515937 | After `bundle deploy` (pipeline reads code from the bundle copy) | SUCCESS | 2.8 min |
| 824182865617397 | Closed-loop test above | SUCCESS | 2.7 min |

The bundle-managed pipeline update `2fca00aa-60a8-4b2c-9c45-f45adba26139` processed all 27 datasets from the glob library.

## 4. Lakebase latency

| Operation | Phase 5 | Phase 11 |
|---|---|---|
| Point read, `lb_serve_player_risk_profile` by player_id | 2.8 ms avg | 3.9 ms |
| Write-back, `INSERT ... RETURNING` + commit | 27.6 ms | 12.1 ms |

Single measurements from a serverless notebook in the same region; the console app's experience is the same order of magnitude.

## 5. PII masking

`mask_pii` is attached to `gold_dim_player.email`, `silver_players.email`, `silver_players.phone_number`, `silver_chat_messages.message_text`
(`information_schema.column_masks`). Account group `game_cx_pii_viewers` exists.

* Member (`mayur.gupta@databricks.com`, `is_account_group_member` = true): 49,724 real emails visible, 0 `***REDACTED***`.
* Non-member: verified in Phase 3c, before the group existed, every caller saw `***REDACTED***`. A repeat test needs a second user who is not in the group.

## 6. Cheat detection vs ground truth

Rule in `gold_mart_player_360` (`is_suspected_cheater`: >= 3 shooter sessions and 2 of 3 signals, headshot >= 40%, accuracy >= 45%,
kills per match >= 9), compared with `ground_truth/gt_players.is_cheater`:

| Cheaters | Caught |
|---|---|
| >= 20 shooter sessions: 277 | 277 |
| < 20 shooter sessions: 75 | 60 |
| No shooter sessions: 8 | 0 (no accuracy/headshot data, undetectable by design) |
| **Total 360** | **337** |

Precision 1.000 (0 false positives). Recall 0.936 overall, 0.957 among the 352 cheaters who played a shooter.

## 7. Genie agents

Benchmarks re-run after the Phase 9 data changes (new mart columns, ACTION events, engagement metric view):

| Agent | Space ID | Result | Run |
|---|---|---|---|
| Emberline - Fraud & Trust Safety | 01f1e3a90ede1597be6672ea8668991e | 10/10 | 01f1e4fbe9bc1813b9667904eb93d326 |
| Emberline - Player Experience & LiveOps | 01f1e3acd3fc1b039e9c20dbf124669b | 10/10 | 01f1e4fbe91a1f12a01e5aeb56f55824 |

## 8. Alerts, dashboard, app

* `game-cx-players-fraud-ring-alert` (2579395162054361): ACTIVE, last evaluated 2026-11-20 23:45 UTC, state TRIGGERED (630 high-risk players, threshold > 0).
* `game-cx-players-toxicity-spike-alert` (2579395162054362): ACTIVE, last evaluated 2026-11-20 23:30 UTC, state TRIGGERED.
* Dashboard `Emberline Player Trust & Safety` (01f1e3b78dc913c99aacf649b44c7888): published, now bundle-managed (same ID).
* App `game-cx-players-console`: RUNNING, deployment 01f1e5145e631e4e9c798c140f6ff43e; build typegen passed for all 10 queries and
  the TypeScript compile passed; no runtime errors in the app log. Browser walk-through of each page is done by the presenter before the demo.

## 9. Secret scan

`pre-commit-code-review` scanner on the exact commit set: 0 blockers. Extra searches for Databricks tokens, AWS keys, private keys,
Slack webhooks and hardcoded passwords: no matches. `app/game-cx-players-console/.env` (config only, no secrets) is git-ignored.

## Not verified / out of scope

* Non-member masking with a second user (see 5).
* Slack alert delivery, AI Gateway budget, UC sub-domains, Lakehouse quality monitors: skipped or deferred, see `docs/PLAN.md`.
