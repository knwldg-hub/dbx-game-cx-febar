-- Silver: cleansed session telemetry with DQ expectations
CREATE OR REFRESH MATERIALIZED VIEW silver_sessions (
  CONSTRAINT pk_session_id         EXPECT (session_id IS NOT NULL)                                  ON VIOLATION DROP ROW,
  CONSTRAINT fk_player_game        EXPECT (player_id IS NOT NULL AND game_id IS NOT NULL)           ON VIOLATION DROP ROW,
  CONSTRAINT positive_duration     EXPECT (duration_min >= 0)                                       ON VIOLATION DROP ROW,
  CONSTRAINT valid_accuracy        EXPECT (accuracy_pct BETWEEN 0 AND 100)                          ,
  CONSTRAINT valid_session_date    EXPECT (session_date BETWEEN '2025-01-01' AND '2026-12-31')
)
COMMENT 'Cleansed session telemetry. Negative durations dropped; out-of-range accuracy warned.'
AS SELECT
  session_id,
  CAST(player_id AS STRING)    AS player_id,
  game_id,
  device_id,
  CAST(session_date AS DATE)   AS session_date,
  CAST(session_start_ts AS TIMESTAMP) AS session_start_ts,
  CAST(session_end_ts AS TIMESTAMP)   AS session_end_ts,
  CAST(duration_min AS DOUBLE) AS duration_min,
  CAST(matches AS INT)         AS matches,
  CAST(kills AS INT)           AS kills,
  CAST(deaths AS INT)          AS deaths,
  CAST(accuracy_pct AS DOUBLE) AS accuracy_pct,
  CAST(headshot_pct AS DOUBLE) AS headshot_pct,
  CAST(ping_ms AS INT)         AS ping_ms,
  CAST(matchmaking_quality AS DOUBLE) AS matchmaking_quality,
  ip_country,
  live_ops_event_id
FROM bronze_telemetry_sessions;
