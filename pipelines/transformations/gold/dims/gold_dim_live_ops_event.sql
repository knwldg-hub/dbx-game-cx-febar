-- Gold dimension: one row per live-ops event
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_live_ops_event
COMMENT 'Live-ops event dimension. One row per time-limited in-game campaign or promotion.'
AS SELECT
  event_id,
  game_id,
  event_name,
  event_type,
  start_date,
  end_date,
  discount_pct
FROM silver_live_ops_events;
