-- Silver: cleansed player abuse reports with DQ expectations
CREATE OR REFRESH MATERIALIZED VIEW silver_player_reports (
  CONSTRAINT pk_report             EXPECT (report_id IS NOT NULL AND reporter_player_id IS NOT NULL AND reported_player_id IS NOT NULL)  ON VIOLATION DROP ROW,
  CONSTRAINT valid_category        EXPECT (report_category IN ('HARASSMENT', 'HATE_SPEECH', 'THREAT', 'SCAM', 'CHEATING', 'GRIEFING', 'OTHER'))
)
COMMENT 'Cleansed player abuse reports. Null keys dropped; invalid categories warned.'
AS SELECT
  report_id,
  CAST(reporter_player_id AS STRING)  AS reporter_player_id,
  CAST(reported_player_id AS STRING)  AS reported_player_id,
  game_id,
  CAST(report_date AS DATE)           AS report_date,
  report_category,
  evidence_message_id,
  match_session_id
FROM bronze_safety_player_reports;
