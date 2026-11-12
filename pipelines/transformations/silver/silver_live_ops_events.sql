-- Silver: cleansed live-ops event calendar
CREATE OR REFRESH MATERIALIZED VIEW silver_live_ops_events (
  CONSTRAINT pk_event_id     EXPECT (event_id IS NOT NULL)          ON VIOLATION DROP ROW,
  CONSTRAINT valid_dates     EXPECT (start_date <= end_date)
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
