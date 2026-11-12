-- Silver: cleansed player abuse reports with DQ expectations
CREATE OR REFRESH MATERIALIZED VIEW silver_player_reports (
  report_id           STRING COMMENT 'Report identifier.',
  reporter_player_id  STRING COMMENT 'Player who filed the report. PII: account identity.',
  reported_player_id  STRING COMMENT 'Player who was reported. PII: account identity.',
  game_id             STRING COMMENT 'Game context for the incident.',
  report_date         DATE   COMMENT 'Date the report was filed.',
  report_category     STRING COMMENT 'Report type: HARASSMENT, HATE_SPEECH, THREAT, SCAM, CHEATING, GRIEFING, OTHER.',
  evidence_message_id STRING COMMENT 'Message ID cited as evidence, if applicable.',
  match_session_id    STRING COMMENT 'Session ID in which the incident occurred, if applicable.',
  CONSTRAINT pk_report      EXPECT (report_id IS NOT NULL AND reporter_player_id IS NOT NULL AND reported_player_id IS NOT NULL) ON VIOLATION DROP ROW,
  CONSTRAINT valid_category EXPECT (report_category IN ('HARASSMENT', 'HATE_SPEECH', 'THREAT', 'SCAM', 'CHEATING', 'GRIEFING', 'OTHER'))
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
