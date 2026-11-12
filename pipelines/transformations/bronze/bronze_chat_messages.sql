-- Bronze: raw chat messages from daily JSON files
CREATE OR REFRESH STREAMING TABLE bronze_chat_messages
COMMENT 'Raw in-game chat messages ingested from chat/chat_messages daily JSON files via Auto Loader.'
AS SELECT
  *,
  _metadata.file_path AS _source_file,
  current_timestamp() AS _ingested_at
FROM STREAM(read_files(
  '/Volumes/mg_aws_serverless_workspace_catalog/game_cx_players/raw/chat/chat_messages/',
  format => 'json'
));
