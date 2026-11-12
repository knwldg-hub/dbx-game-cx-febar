-- Gold fact: one row per game session, enriched with date_key and live_ops_event_id
CREATE OR REFRESH MATERIALIZED VIEW gold_fact_session (
  session_id          STRING    COMMENT 'Session grain key.',
  player_id           STRING    COMMENT 'Dimension: player.',
  game_id             STRING    COMMENT 'Dimension: game.',
  device_id           STRING    COMMENT 'Dimension: device.',
  date_key            INT       COMMENT 'Dimension: date in YYYYMMDD format.',
  session_date        DATE      COMMENT 'Calendar date of the session.',
  duration_min        DOUBLE    COMMENT 'Session duration in minutes.',
  matches             INT       COMMENT 'Matches played.',
  kills               INT       COMMENT 'Total kills (NULL for non-shooter titles).',
  deaths              INT       COMMENT 'Total deaths (NULL for non-shooter titles).',
  accuracy_pct        DOUBLE    COMMENT 'Shot accuracy 0-100 (NULL for non-shooter titles).',
  headshot_pct        DOUBLE    COMMENT 'Headshot rate 0-100 (NULL for non-shooter titles).',
  ping_ms             INT       COMMENT 'Network latency in ms.',
  matchmaking_quality DOUBLE    COMMENT 'Matchmaking quality score 0-1.',
  ip_country          STRING    COMMENT 'Country from IP at session time.',
  live_ops_event_id   STRING    COMMENT 'Active live-ops event at session time, if any.'
)
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
