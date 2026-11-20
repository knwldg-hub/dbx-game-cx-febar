-- Gold mart: Player 360 — ML scores wired in Phase 4
-- as_of_date = 2026-12-31 (simulated reference date)
-- ML sources (external to pipeline, read by full name):
--   churn  : mg_aws_serverless_workspace_catalog.game_cx_players.ml_churn_player_scores
--   fraud  : mg_aws_serverless_workspace_catalog.game_cx_players.ml_fraud_txn_scores  (max per player)
--   toxicity: mg_aws_serverless_workspace_catalog.game_cx_players.ml_toxicity_message_labels (10K sample)
-- Closed loop: bronze_app_moderation_actions (console actions synced from Lakebase by notebook 06).
-- Cheating: rule-based, shooter titles only (G01 Iron Vanguard, G02 Starfall Legends). A player is a suspected
--   cheater with >= 3 shooter sessions and at least 2 of 3 signals: avg headshot >= 40%, avg accuracy >= 45%,
--   kills per match >= 9 (population medians 18%, 25%, 5.0). Measured vs ground truth: precision 1.00, recall 0.96.
CREATE OR REFRESH MATERIALIZED VIEW gold_mart_player_360 (
  player_id               STRING  COMMENT 'Player identifier. Grain: one row per player.',
  lifetime_spend_usd      DOUBLE  COMMENT 'Total USD spend across all transactions.',
  last_active_date        DATE    COMMENT 'Most recent session date.',
  sessions_30d            BIGINT  COMMENT 'Session count in the last 30 days.',
  engagement_trend        DOUBLE  COMMENT 'Session growth ratio vs prior 30 days. >0 growing, <0 declining.',
  is_high_value_player    BOOLEAN COMMENT 'True if lifetime_spend_usd > 50 AND last_active within 14 days of 2026-12-31.',
  is_at_risk              BOOLEAN COMMENT 'True if churn_player_classifier@champion flags churn_risk = 1.',
  churn_risk_score        DOUBLE  COMMENT 'Churn probability 0-1 from churn_player_classifier@champion.',
  fraud_risk_score        DOUBLE  COMMENT 'Max transaction fraud score 0-1 from fraud_txn_classifier@champion.',
  toxicity_score          DOUBLE  COMMENT 'Share of sampled sent messages classified as toxic (0-1). Based on 10K-message LLM sample.',
  reports_received        BIGINT  COMMENT 'Abuse reports filed against this player.',
  toxic_messages_received INT     COMMENT 'Count of LLM-classified toxic messages received in the 10K sample.',
  recommended_action      STRING  COMMENT 'Moderation action, highest-priority signal wins: suspend / review_fraud / warn_toxicity / review_cheating / retain / monitor.',
  account_status          STRING  COMMENT 'Account status from the account system: active or closed.',
  acquisition_channel     STRING  COMMENT 'Marketing channel the player was acquired through.',
  shooter_sessions        BIGINT  COMMENT 'Sessions in shooter titles (G01, G02); basis for the cheat signals.',
  avg_accuracy_pct        DOUBLE  COMMENT 'Average shot accuracy % in shooter titles (NULL if no shooter sessions).',
  avg_headshot_pct        DOUBLE  COMMENT 'Average headshot % in shooter titles (NULL if no shooter sessions).',
  kills_per_match         DOUBLE  COMMENT 'Kills per match in shooter titles (NULL if no shooter sessions).',
  is_suspected_cheater    BOOLEAN COMMENT 'Rule-based cheat flag: >= 3 shooter sessions and 2 of 3 signals (headshot >= 40%, accuracy >= 45%, kills/match >= 9).',
  actions_taken           BIGINT  COMMENT 'Moderator actions recorded on this player in the console (closed loop).',
  latest_action_type      STRING  COMMENT 'Most recent moderator action on this player (NULL if none).',
  latest_action_ts        TIMESTAMP COMMENT 'Real wall-clock time of the most recent moderator action (NULL if none).'
)
COMMENT 'Player 360 mart. One row per player with engagement, spend, and ML scores (churn_player_classifier, fraud_txn_classifier, LLM toxicity).'
CLUSTER BY (player_id)
AS
WITH spend AS (
  SELECT
    player_id,
    SUM(amount_usd) AS lifetime_spend_usd
  FROM silver_transactions
  GROUP BY ALL
),
sessions AS (
  SELECT
    player_id,
    MAX(session_date)                                                          AS last_active_date,
    COUNT(CASE WHEN session_date >= DATE '2026-12-01' THEN 1 END)              AS sessions_30d,
    COUNT(CASE WHEN session_date >= DATE '2026-11-01'
               AND  session_date <  DATE '2026-12-01' THEN 1 END)              AS sessions_prev_30d
  FROM silver_sessions
  GROUP BY ALL
),
reports_received AS (
  SELECT
    reported_player_id AS player_id,
    COUNT(*)           AS reports_received
  FROM silver_player_reports
  GROUP BY ALL
),
-- Churn scores: one row per player from external ML table
churn AS (
  SELECT player_id,
         churn_risk_score,
         CAST(churn_risk AS BOOLEAN) AS is_at_risk
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.ml_churn_player_scores
),
-- Fraud scores: max transaction-level score per player
fraud AS (
  SELECT player_id,
         CAST(MAX(fraud_score) AS DOUBLE) AS fraud_risk_score
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.ml_fraud_txn_scores
  GROUP BY ALL
),
-- Toxicity sent: share of a player's sampled messages that were toxic
tox_sent AS (
  SELECT sender_player_id                                             AS player_id,
         CAST(SUM(CAST(is_toxic AS INT)) AS DOUBLE) / COUNT(*)       AS toxicity_score,
         COUNT(*)                                                     AS tox_sample_sent
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.ml_toxicity_message_labels
  GROUP BY ALL
),
-- Cheat signals: shooter titles only
cheat AS (
  SELECT
    player_id,
    COUNT(*)                                                     AS shooter_sessions,
    CAST(AVG(accuracy_pct) AS DOUBLE)                            AS avg_accuracy_pct,
    CAST(AVG(headshot_pct) AS DOUBLE)                            AS avg_headshot_pct,
    CAST(SUM(kills) / NULLIF(SUM(matches), 0) AS DOUBLE)         AS kills_per_match
  FROM silver_sessions
  WHERE game_id IN ('G01', 'G02')
  GROUP BY ALL
),
-- Moderator actions written back from the console (closed loop)
actions AS (
  SELECT
    player_id,
    COUNT(*)                                                     AS actions_taken,
    MAX_BY(action_type, created_at)                              AS latest_action_type,
    MAX(created_at)                                              AS latest_action_ts
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.bronze_app_moderation_actions
  GROUP BY ALL
),
-- Toxicity received: count of toxic messages received (via silver_chat_messages join)
tox_recv AS (
  SELECT cm.recipient_player_id                       AS player_id,
         CAST(SUM(CAST(tl.is_toxic AS INT)) AS INT)   AS toxic_messages_received
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.ml_toxicity_message_labels tl
  JOIN silver_chat_messages cm ON tl.message_id = cm.message_id
  GROUP BY ALL
)
SELECT
  p.player_id,
  COALESCE(sp.lifetime_spend_usd, 0.0)                AS lifetime_spend_usd,
  s.last_active_date,
  COALESCE(s.sessions_30d, 0)                         AS sessions_30d,
  CAST(CASE
    WHEN COALESCE(s.sessions_prev_30d, 0) > 0
      THEN ROUND((s.sessions_30d - s.sessions_prev_30d) * 1.0 / s.sessions_prev_30d, 3)
    WHEN COALESCE(s.sessions_30d, 0) > 0 THEN 1.0
    ELSE 0.0
  END AS DOUBLE)                                      AS engagement_trend,
  CASE
    WHEN COALESCE(sp.lifetime_spend_usd, 0) > 50
     AND s.last_active_date >= DATE '2026-12-17'
    THEN TRUE ELSE FALSE
  END                                                 AS is_high_value_player,
  -- Churn
  COALESCE(ch.is_at_risk, FALSE)                      AS is_at_risk,
  ch.churn_risk_score,
  -- Fraud
  fr.fraud_risk_score,
  -- Toxicity
  ts.toxicity_score,
  COALESCE(r.reports_received, 0)                     AS reports_received,
  tr.toxic_messages_received,
  -- Recommended action: highest-priority signal wins
  CASE
    WHEN fr.fraud_risk_score >= 0.651 AND ts.toxicity_score >= 0.3
      THEN 'suspend'
    WHEN fr.fraud_risk_score >= 0.651
      THEN 'review_fraud'
    WHEN ts.toxicity_score >= 0.5
      THEN 'warn_toxicity'
    WHEN COALESCE(ct.shooter_sessions, 0) >= 3
     AND (CASE WHEN ct.avg_headshot_pct >= 40 THEN 1 ELSE 0 END
        + CASE WHEN ct.avg_accuracy_pct >= 45 THEN 1 ELSE 0 END
        + CASE WHEN ct.kills_per_match >= 9 THEN 1 ELSE 0 END) >= 2
      THEN 'review_cheating'
    WHEN COALESCE(ch.is_at_risk, FALSE)
     AND COALESCE(sp.lifetime_spend_usd, 0) > 50
     AND s.last_active_date >= DATE '2026-12-17'
      THEN 'retain'
    WHEN COALESCE(ch.is_at_risk, FALSE)
      THEN 'monitor'
    ELSE NULL
  END                                                 AS recommended_action,
  p.account_status,
  p.acquisition_channel,
  COALESCE(ct.shooter_sessions, 0)                    AS shooter_sessions,
  ct.avg_accuracy_pct,
  ct.avg_headshot_pct,
  ct.kills_per_match,
  COALESCE(ct.shooter_sessions, 0) >= 3
    AND (CASE WHEN ct.avg_headshot_pct >= 40 THEN 1 ELSE 0 END
       + CASE WHEN ct.avg_accuracy_pct >= 45 THEN 1 ELSE 0 END
       + CASE WHEN ct.kills_per_match >= 9 THEN 1 ELSE 0 END) >= 2 AS is_suspected_cheater,
  COALESCE(ac.actions_taken, 0)                       AS actions_taken,
  ac.latest_action_type,
  ac.latest_action_ts
FROM silver_players p
LEFT JOIN spend      sp ON p.player_id = sp.player_id
LEFT JOIN sessions   s  ON p.player_id = s.player_id
LEFT JOIN reports_received r  ON p.player_id = r.player_id
LEFT JOIN churn      ch ON p.player_id = ch.player_id
LEFT JOIN fraud      fr ON p.player_id = fr.player_id
LEFT JOIN tox_sent   ts ON p.player_id = ts.player_id
LEFT JOIN tox_recv   tr ON p.player_id = tr.player_id
LEFT JOIN cheat      ct ON p.player_id = ct.player_id
LEFT JOIN actions    ac ON p.player_id = ac.player_id;
