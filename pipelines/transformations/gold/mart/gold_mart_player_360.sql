-- Gold mart: Player 360 view — placeholder; ML scores populated in Phase 4
-- as_of_date = 2026-12-31 (simulated reference date)
CREATE OR REFRESH MATERIALIZED VIEW gold_mart_player_360 (
  player_id               STRING  COMMENT 'Player identifier. Grain: one row per player.',
  lifetime_spend_usd      DOUBLE  COMMENT 'Total USD spend across all transactions.',
  last_active_date        DATE    COMMENT 'Most recent session date.',
  sessions_30d            BIGINT  COMMENT 'Session count in the last 30 days.',
  engagement_trend        DOUBLE  COMMENT 'Session growth ratio vs prior 30 days. >0 growing, <0 declining.',
  is_high_value_player    BOOLEAN COMMENT 'True if lifetime_spend_usd > 50 AND last_active within 14 days of 2026-12-31.',
  is_at_risk              BOOLEAN COMMENT 'True if churn model classifies this player as at-risk. NULL until Phase 4.',
  churn_risk_score        DOUBLE  COMMENT 'Churn probability 0-1 from ML model. NULL until Phase 4.',
  fraud_risk_score        DOUBLE  COMMENT 'Fraud probability 0-1 from ML model. NULL until Phase 4.',
  toxicity_score          DOUBLE  COMMENT 'Toxicity score 0-1 from LLM evaluation. NULL until Phase 4.',
  reports_received        BIGINT  COMMENT 'Abuse reports filed against this player.',
  toxic_messages_received INT     COMMENT 'Count of toxic messages received. NULL until Phase 4.',
  recommended_action      STRING  COMMENT 'Suggested moderation action from trust & safety rules. NULL until Phase 4.'
)
COMMENT 'Player 360 mart. One row per player with engagement, spend, and placeholder ML scores (churn, fraud, toxicity populated in Phase 4).'
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
)
SELECT
  p.player_id,
  COALESCE(sp.lifetime_spend_usd, 0.0)         AS lifetime_spend_usd,
  s.last_active_date,
  COALESCE(s.sessions_30d, 0)                  AS sessions_30d,
  CAST(CASE
    WHEN COALESCE(s.sessions_prev_30d, 0) > 0
      THEN ROUND((s.sessions_30d - s.sessions_prev_30d) * 1.0 / s.sessions_prev_30d, 3)
    WHEN COALESCE(s.sessions_30d, 0) > 0 THEN 1.0
    ELSE 0.0
  END AS DOUBLE)                               AS engagement_trend,
  CASE
    WHEN COALESCE(sp.lifetime_spend_usd, 0) > 50
     AND s.last_active_date >= DATE '2026-12-17'
    THEN TRUE ELSE FALSE
  END                                          AS is_high_value_player,
  -- ML placeholders (Phase 4)
  CAST(NULL AS BOOLEAN)                        AS is_at_risk,
  CAST(NULL AS DOUBLE)                         AS churn_risk_score,
  CAST(NULL AS DOUBLE)                         AS fraud_risk_score,
  CAST(NULL AS DOUBLE)                         AS toxicity_score,
  COALESCE(r.reports_received, 0)              AS reports_received,
  CAST(NULL AS INT)                            AS toxic_messages_received,
  CAST(NULL AS STRING)                         AS recommended_action
FROM silver_players p
LEFT JOIN spend sp   ON p.player_id = sp.player_id
LEFT JOIN sessions s ON p.player_id = s.player_id
LEFT JOIN reports_received r ON p.player_id = r.player_id;
