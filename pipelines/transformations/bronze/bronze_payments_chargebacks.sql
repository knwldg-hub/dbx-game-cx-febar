-- Bronze: raw chargeback records from daily CSV files (late-arriving, 15-75 day lag)
CREATE OR REFRESH STREAMING TABLE bronze_payments_chargebacks
COMMENT 'Raw chargeback records ingested from payments/chargebacks daily CSV files via Auto Loader. Files arrive with a 15-75 day lag after the original transaction.'
AS SELECT
  *,
  _metadata.file_path AS _source_file,
  current_timestamp() AS _ingested_at
FROM STREAM(read_files(
  '/Volumes/mg_aws_serverless_workspace_catalog/game_cx_players/raw/payments/chargebacks/',
  format => 'csv',
  header => 'true',
  inferColumnTypes => 'true'
));
