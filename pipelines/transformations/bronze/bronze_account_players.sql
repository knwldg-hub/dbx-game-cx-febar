-- Bronze: raw player account data from account system CSV
CREATE OR REFRESH STREAMING TABLE bronze_account_players
COMMENT 'Raw player account records ingested from account/players CSV files via Auto Loader.'
AS SELECT
  *,
  _metadata.file_path AS _source_file,
  current_timestamp() AS _ingested_at
FROM STREAM(read_files(
  '/Volumes/mg_aws_serverless_workspace_catalog/game_cx_players/raw/account/players/',
  format => 'csv',
  header => 'true',
  inferColumnTypes => 'true'
));
