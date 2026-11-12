-- Silver: cleansed chat messages with DQ expectations
CREATE OR REFRESH MATERIALIZED VIEW silver_chat_messages (
  CONSTRAINT pk_message            EXPECT (message_id IS NOT NULL AND sender_player_id IS NOT NULL)   ON VIOLATION DROP ROW,
  CONSTRAINT non_empty_text        EXPECT (LENGTH(TRIM(message_text)) > 0)                            ON VIOLATION DROP ROW
)
COMMENT 'Cleansed in-game chat messages. Null keys and empty messages dropped.'
AS SELECT
  message_id,
  CAST(sender_player_id AS STRING)    AS sender_player_id,
  CAST(recipient_player_id AS STRING) AS recipient_player_id,
  game_id,
  session_id,
  channel,
  language,
  CAST(sent_ts AS TIMESTAMP)          AS sent_ts,
  CAST(sent_date AS DATE)             AS sent_date,
  message_text
FROM bronze_chat_messages;
