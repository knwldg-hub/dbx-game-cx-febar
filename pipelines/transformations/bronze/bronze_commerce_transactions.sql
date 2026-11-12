-- Bronze: raw purchase transactions from daily JSON files
CREATE OR REFRESH STREAMING TABLE bronze_commerce_transactions
COMMENT 'Raw transaction records ingested from commerce/transactions daily JSON files via Auto Loader.'
AS SELECT
  *,
  _metadata.file_path AS _source_file,
  current_timestamp() AS _ingested_at
FROM STREAM(read_files(
  '/Volumes/mg_aws_serverless_workspace_catalog/game_cx_players/raw/commerce/transactions/',
  format => 'json'
));
