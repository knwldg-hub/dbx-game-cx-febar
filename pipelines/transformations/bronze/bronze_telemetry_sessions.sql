-- Bronze: raw game session telemetry from daily JSON files
CREATE OR REFRESH STREAMING TABLE bronze_telemetry_sessions
COMMENT 'Raw session telemetry ingested from telemetry/sessions daily JSON files via Auto Loader.'
AS SELECT
  *,
  _metadata.file_path AS _source_file,
  current_timestamp() AS _ingested_at
FROM STREAM(read_files(
  '/Volumes/mg_aws_serverless_workspace_catalog/game_cx_players/raw/telemetry/sessions/',
  format => 'json'
));
