-- Silver: cleansed chat messages with DQ expectations
CREATE OR REFRESH MATERIALIZED VIEW silver_chat_messages (
  message_id           STRING    COMMENT 'Message identifier.',
  sender_player_id     STRING    COMMENT 'Player who sent the message. PII: account identity.',
  recipient_player_id  STRING    COMMENT 'Player who received the message (direct messages only). PII: account identity.',
  game_id              STRING    COMMENT 'Game context for the message.',
  session_id           STRING    COMMENT 'Session during which the message was sent.',
  channel              STRING    COMMENT 'Chat channel: team, all, whisper.',
  language             STRING    COMMENT 'BCP-47 language code detected for this message.',
  sent_ts              TIMESTAMP COMMENT 'Message send timestamp.',
  sent_date            DATE      COMMENT 'Message send date.',
  message_text         STRING    COMMENT 'Raw message content. Used for toxicity scoring (Phase 4). PII: free text.',
  CONSTRAINT pk_message     EXPECT (message_id IS NOT NULL AND sender_player_id IS NOT NULL) ON VIOLATION DROP ROW,
  CONSTRAINT non_empty_text EXPECT (LENGTH(TRIM(message_text)) > 0)                         ON VIOLATION DROP ROW
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
