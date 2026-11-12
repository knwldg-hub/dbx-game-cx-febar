-- Bronze: raw game catalog from game service JSON
CREATE OR REFRESH STREAMING TABLE bronze_games
COMMENT 'Raw game catalog records ingested from game_svc/games JSON files via Auto Loader.'
AS SELECT
  *,
  _metadata.file_path AS _source_file,
  current_timestamp() AS _ingested_at
FROM STREAM(read_files(
  '/Volumes/mg_aws_serverless_workspace_catalog/game_cx_players/raw/game_svc/games/',
  format => 'json'
));
