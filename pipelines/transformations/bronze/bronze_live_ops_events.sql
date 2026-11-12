-- Bronze: raw live-ops event calendar from game service JSON
CREATE OR REFRESH STREAMING TABLE bronze_live_ops_events
COMMENT 'Raw live-ops event calendar ingested from game_svc/live_ops_events JSON files via Auto Loader.'
AS SELECT
  *,
  _metadata.file_path AS _source_file,
  current_timestamp() AS _ingested_at
FROM STREAM(read_files(
  '/Volumes/mg_aws_serverless_workspace_catalog/game_cx_players/raw/game_svc/live_ops_events/',
  format => 'json'
));
