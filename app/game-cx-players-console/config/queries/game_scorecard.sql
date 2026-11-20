-- Game health scorecard: one row per title combining money, risk and experience KPIs.
-- Not filtered by game (the page highlights the selected title instead).
-- @param region STRING
-- @param start_date DATE
WITH money AS (
  SELECT
    game_title,
    MEASURE(gross_revenue_usd)   AS gross_revenue_usd,
    MEASURE(chargeback_loss_usd) AS chargeback_loss_usd,
    MEASURE(report_count)        AS report_count
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety
  WHERE game_title IS NOT NULL
    AND (:region = '' OR player_region = :region)
    AND event_date >= :start_date
  GROUP BY ALL
),
closed_window AS (
  SELECT
    game_title,
    MEASURE(chargeback_rate) AS chargeback_rate_closed
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety
  WHERE game_title IS NOT NULL
    AND (:region = '' OR player_region = :region)
    AND event_date >= :start_date
    AND is_chargeback_window_closed = TRUE
  GROUP BY ALL
),
engagement AS (
  SELECT
    game_title,
    genre,
    MEASURE(active_players)        AS active_players,
    MEASURE(stickiness_dau_mau)    AS stickiness,
    MEASURE(avg_session_minutes)   AS avg_session_minutes,
    MEASURE(poor_matchmaking_rate) AS poor_matchmaking_rate,
    MEASURE(suspected_cheaters)    AS suspected_cheaters
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_engagement
  WHERE game_title IS NOT NULL
    AND (:region = '' OR player_region = :region)
    AND session_date >= :start_date
  GROUP BY ALL
)
SELECT
  e.game_title,
  e.genre,
  CAST(m.gross_revenue_usd AS DOUBLE)       AS gross_revenue_usd,
  CAST(m.chargeback_loss_usd AS DOUBLE)     AS chargeback_loss_usd,
  CAST(c.chargeback_rate_closed AS DOUBLE)  AS chargeback_rate_closed,
  CAST(m.report_count AS BIGINT)            AS report_count,
  CAST(e.active_players AS BIGINT)          AS active_players,
  CAST(e.stickiness AS DOUBLE)              AS stickiness,
  CAST(e.avg_session_minutes AS DOUBLE)     AS avg_session_minutes,
  CAST(e.poor_matchmaking_rate AS DOUBLE)   AS poor_matchmaking_rate,
  CAST(e.suspected_cheaters AS BIGINT)      AS suspected_cheaters
FROM engagement e
LEFT JOIN money m ON e.game_title = m.game_title
LEFT JOIN closed_window c ON e.game_title = c.game_title
ORDER BY gross_revenue_usd DESC
