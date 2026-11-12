-- Silver: cleansed live-ops event calendar
CREATE OR REFRESH MATERIALIZED VIEW silver_live_ops_events (
  event_id    STRING COMMENT 'Live-ops event identifier.',
  game_id     STRING COMMENT 'Title this event belongs to.',
  event_name  STRING COMMENT 'Display name of the event.',
  event_type  STRING COMMENT 'Category: battle_pass, double_xp, flash_sale.',
  start_date  DATE   COMMENT 'Event start date (inclusive).',
  end_date    DATE   COMMENT 'Event end date (inclusive).',
  discount_pct DOUBLE COMMENT 'Store discount percentage 0-100.',
  CONSTRAINT pk_event_id EXPECT (event_id IS NOT NULL)   ON VIOLATION DROP ROW,
  CONSTRAINT valid_dates EXPECT (start_date <= end_date)
)
COMMENT 'Cleansed live-ops event calendar. Null event_id rows dropped; inverted date ranges warned.'
AS SELECT
  event_id,
  game_id,
  event_name,
  event_type,
  CAST(start_date AS DATE) AS start_date,
  CAST(end_date AS DATE)   AS end_date,
  CAST(discount_pct AS DOUBLE) AS discount_pct
FROM bronze_live_ops_events;
