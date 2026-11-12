# Pipeline reconciliation: game-cx-players-pipeline

Pipeline ID: `8cc02b90-7598-4b0a-917a-0c7f64b78b6a`
Schema: `mg_aws_serverless_workspace_catalog.game_cx_players`
Full update: `1fab7ef4-8864-4482-87ac-d067264fe704` (2026-11-12). Fix updates: `8f2df940-5f3e-4a85-ab32-4863c8e6198e` (geography), `9a2fd337-d395-4d8f-9531-f14179d5ce81` (expectation fixes).

## 1. Row counts by layer

| Entity | Raw (Phase 1) | Bronze | Silver | Gold |
|---|---|---|---|---|
| Players | 50,000 | 50,000 | 50,000 | gold_dim_player 50,000; gold_mart_player_360 50,000 |
| Games | 6 | 6 | 6 | gold_dim_game 6 |
| Live-ops events | 144 | 144 | 144 | gold_dim_live_ops_event 144 |
| Devices | 71,931 | 71,931 | 71,931 | gold_dim_device 71,931 |
| Sessions | 7,099,350 | 7,099,350 | 7,077,744 | gold_fact_session 7,077,744 |
| Transactions | 948,078 | 948,078 | 948,078 | gold_fact_event PURCHASE 948,078 |
| Chargebacks (visible by as_of_date) | 9,442 | 9,442 | 9,442 | gold_fact_event has_chargeback 9,442 |
| Chat messages | 2,028,079 | 2,028,079 | 2,028,079 | (scored in Phase 4) |
| Player reports | 57,509 | 57,509 | 57,509 | gold_fact_event REPORT 57,509 |
| Dates | n/a | n/a | n/a | gold_dim_date 730 |
| Countries | n/a | n/a | n/a | gold_dim_geography 18 (Americas 5, EMEA 8, APAC 5) |

## 2. Cross-layer checks (PLAN.md section 12)

| Check | Result |
|---|---|
| silver_sessions = bronze_telemetry_sessions - DROP violations | 7,099,350 - 21,606 = 7,077,744 PASS |
| gold_fact_event PURCHASE = silver_transactions | 948,078 = 948,078 PASS |
| gold_fact_event has_chargeback = silver_chargebacks (merge completeness) | 9,442 = 9,442 PASS |
| gold_fact_event REPORT = silver_player_reports | 57,509 = 57,509 PASS |
| gold_fact_event total = PURCHASE + REPORT | 1,005,587 PASS |
| Every player mapped to a region (no 'Other') | 50,000 = 23,483 Americas + 17,574 EMEA + 8,943 APAC PASS |

## 3. Expectation results vs injected defects

Failed counts come from the pipeline event log (`event_log()` flow_progress data_quality). Each one was also checked with an independent count on the bronze table.

| Dataset | Expectation | Action | Failed | Failed % | Injected defect | Independent bronze count |
|---|---|---|---|---|---|---|
| silver_sessions | positive_duration | DROP | 21,606 | 0.30% | duration_min = -5 (~0.3%) | 21,606 |
| silver_sessions | valid_accuracy | WARN | 6,597 | 0.09% of all, ~0.2% of shooter sessions | accuracy_pct = 105 (~0.2% of shooter sessions) | 6,597 |
| silver_transactions | valid_payment_method | WARN | 3,851 | 0.41% | payment_method = 'cryptocurrency' (~0.4%) | n/a |
| silver_player_reports | valid_category | WARN | 168 | 0.29% | report_category = 'EXPLOITING' (~0.3%) | n/a |
| silver_players | valid_email | WARN | 276 | 0.55% | null email (~0.5%) | 276 |

All other expectations (primary keys, non-null keys, positive amounts, date ranges, non-empty chat text) had 0 failures.

## 4. Issues found and fixed during Phase 2

1. **Column mismatches.** The first dry run failed because the SQL assumed column names that are not in the raw files (`item_name`, `channel_id`, `description`). Fixed by matching the actual raw schemas.
2. **Geography mapping.** ES, IT, NL, AR, PH (5,995 players) were mapped to region 'Other' and currency USD. Fixed in gold_dim_geography and gold_dim_player.
3. **valid_accuracy flagged 53.7% of sessions.** Non-shooter titles have NULL accuracy, and a NULL expectation result counts as a failure. Fixed to `accuracy_pct IS NULL OR accuracy_pct BETWEEN 0 AND 100`.
4. **valid_email flagged 0 rows.** The rule allowed NULL emails, which hid the injected defect. Fixed to `email IS NOT NULL AND email RLIKE ...`.
