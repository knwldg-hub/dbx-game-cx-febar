-- Bronze: raw device registry from telemetry system CSV
CREATE OR REFRESH STREAMING TABLE bronze_telemetry_devices
COMMENT 'Raw device records ingested from telemetry/devices CSV files via Auto Loader.'
AS SELECT
  *,
  _metadata.file_path AS _source_file,
  current_timestamp() AS _ingested_at
FROM STREAM(read_files(
  '/Volumes/mg_aws_serverless_workspace_catalog/game_cx_players/raw/telemetry/devices/',
  format => 'csv',
  header => 'true',
  inferColumnTypes => 'true'
));
