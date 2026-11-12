-- Gold dimension: one row per live-ops event
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_live_ops_event (
  event_id     STRING COMMENT 'Live-ops event identifier.',
  game_id      STRING COMMENT 'Title this event belongs to.',
  event_name   STRING COMMENT 'Display name of the event.',
  event_type   STRING COMMENT 'Category: battle_pass, double_xp, flash_sale.',
  start_date   DATE   COMMENT 'Event start date (inclusive).',
  end_date     DATE   COMMENT 'Event end date (inclusive).',
  discount_pct DOUBLE COMMENT 'Store discount percentage 0-100.'
)
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
