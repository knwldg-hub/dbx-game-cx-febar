-- Executive Overview headline KPIs (one row), from both governed metric views.
-- Filters: game ('' = all), region ('' = all), start_date (period start; period ends at as_of_date 2026-12-31).
-- Metric views: always MEASURE(), never SUM() on measures.
-- prev_* columns cover the same number of days immediately before start_date (NULL/0 for All time).
-- @param game STRING
-- @param region STRING
-- @param start_date DATE
WITH money AS (
  SELECT
    MEASURE(gross_revenue_usd)       AS gross_revenue_usd,
    MEASURE(net_revenue_usd)         AS net_revenue_usd,
    MEASURE(chargeback_loss_usd)     AS chargeback_loss_usd,
    MEASURE(chargeback_rate)         AS chargeback_rate,
    MEASURE(paying_players)          AS paying_players,
    MEASURE(arppu_usd)               AS arppu_usd,
    MEASURE(report_count)            AS report_count,
    MEASURE(high_value_player_count) AS high_value_player_count
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety
  WHERE (:game = '' OR game_title = :game)
    AND (:region = '' OR player_region = :region)
    AND event_date >= :start_date
),
closed_window AS (
  -- Final chargeback rate: only purchases old enough (>= 75 days) to have been charged back.
  SELECT MEASURE(chargeback_rate) AS chargeback_rate_closed
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety
  WHERE (:game = '' OR game_title = :game)
    AND (:region = '' OR player_region = :region)
    AND event_date >= :start_date
    AND is_chargeback_window_closed = TRUE
),
engagement AS (
  SELECT
    MEASURE(active_players)          AS active_players,
    MEASURE(avg_dau)                 AS avg_dau,
    MEASURE(avg_session_minutes)     AS avg_session_minutes,
    MEASURE(poor_matchmaking_rate)   AS poor_matchmaking_rate,
    MEASURE(cheater_session_share)   AS cheater_session_share,
    MEASURE(suspected_cheaters)      AS suspected_cheaters,
    MEASURE(live_ops_reach_players)  AS live_ops_reach_players
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_engagement
  WHERE (:game = '' OR game_title = :game)
    AND (:region = '' OR player_region = :region)
    AND session_date >= :start_date
),
prior AS (
  SELECT
    MEASURE(gross_revenue_usd) AS prev_gross_revenue_usd,
    MEASURE(report_count)      AS prev_report_count
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety
  WHERE (:game = '' OR game_title = :game)
    AND (:region = '' OR player_region = :region)
    AND event_date >= DATE_SUB(:start_date, DATEDIFF(DATE '2026-12-31', :start_date) + 1)
    AND event_date < :start_date
),
prior_engagement AS (
  SELECT MEASURE(active_players) AS prev_active_players
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_engagement
  WHERE (:game = '' OR game_title = :game)
    AND (:region = '' OR player_region = :region)
    AND session_date >= DATE_SUB(:start_date, DATEDIFF(DATE '2026-12-31', :start_date) + 1)
    AND session_date < :start_date
),
current_30d AS (
  -- Current health, independent of the period filter: MAU / DAU / stickiness over the 30 days ending 2026-12-31.
  -- (Stickiness over a multi-month period is not meaningful: its denominator counts every player in the period.)
  SELECT
    MEASURE(active_players)     AS mau_30d,
    MEASURE(avg_dau)            AS dau_30d,
    MEASURE(stickiness_dau_mau) AS stickiness_30d
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_engagement
  WHERE (:game = '' OR game_title = :game)
    AND (:region = '' OR player_region = :region)
    AND is_last_30_days = TRUE
)
SELECT
  CAST(m.gross_revenue_usd AS DOUBLE)       AS gross_revenue_usd,
  CAST(m.net_revenue_usd AS DOUBLE)         AS net_revenue_usd,
  CAST(m.chargeback_loss_usd AS DOUBLE)     AS chargeback_loss_usd,
  CAST(m.chargeback_rate AS DOUBLE)         AS chargeback_rate,
  CAST(c.chargeback_rate_closed AS DOUBLE)  AS chargeback_rate_closed,
  CAST(m.paying_players AS BIGINT)          AS paying_players,
  CAST(m.arppu_usd AS DOUBLE)               AS arppu_usd,
  CAST(m.report_count AS BIGINT)            AS report_count,
  CAST(m.high_value_player_count AS BIGINT) AS high_value_player_count,
  CAST(e.active_players AS BIGINT)          AS active_players,
  CAST(e.avg_dau AS DOUBLE)                 AS avg_dau,
  CAST(t.mau_30d AS BIGINT)                 AS mau_30d,
  CAST(t.dau_30d AS DOUBLE)                 AS dau_30d,
  CAST(t.stickiness_30d AS DOUBLE)          AS stickiness_30d,
  CAST(e.avg_session_minutes AS DOUBLE)     AS avg_session_minutes,
  CAST(e.poor_matchmaking_rate AS DOUBLE)   AS poor_matchmaking_rate,
  CAST(e.cheater_session_share AS DOUBLE)   AS cheater_session_share,
  CAST(e.suspected_cheaters AS BIGINT)      AS suspected_cheaters,
  CAST(e.live_ops_reach_players AS BIGINT)  AS live_ops_reach_players,
  CAST(p.prev_gross_revenue_usd AS DOUBLE)  AS prev_gross_revenue_usd,
  CAST(p.prev_report_count AS BIGINT)       AS prev_report_count,
  CAST(pe.prev_active_players AS BIGINT)    AS prev_active_players
FROM money m
CROSS JOIN closed_window c
CROSS JOIN engagement e
CROSS JOIN current_30d t
CROSS JOIN prior p
CROSS JOIN prior_engagement pe
