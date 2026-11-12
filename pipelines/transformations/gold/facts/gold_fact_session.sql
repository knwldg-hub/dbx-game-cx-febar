-- Gold fact: one row per game session, enriched with date_key and live_ops_event_id
CREATE OR REFRESH MATERIALIZED VIEW gold_fact_session
COMMENT 'Session fact table. One row per game session with date_key and the live-ops event active for that game at session time (NULL if none), as recorded by telemetry.'
CLUSTER BY (game_id, session_date)
AS SELECT
  session_id,
  player_id,
  game_id,
  device_id,
  CAST(DATE_FORMAT(session_date, 'yyyyMMdd') AS INT) AS date_key,
  session_date,
  duration_min,
  matches,
  kills,
  deaths,
  accuracy_pct,
  headshot_pct,
  ping_ms,
  matchmaking_quality,
  ip_country,
  live_ops_event_id
FROM silver_sessions;
