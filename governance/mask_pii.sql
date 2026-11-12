-- Phase 3c (part 1): PII column mask function
-- Used by ABAC policy mask_pii_policy (part 2, created once account group game_cx_pii_viewers exists).
-- Members of game_cx_pii_viewers see the real value; everyone else sees ***REDACTED***. NULL stays NULL.
-- Until the group exists, is_account_group_member() returns FALSE, so every caller sees ***REDACTED***.
CREATE OR REPLACE FUNCTION mg_aws_serverless_workspace_catalog.game_cx_players.mask_pii(val STRING)
RETURNS STRING
COMMENT 'PII column mask for ABAC policy mask_pii_policy. Returns the real value for members of account group game_cx_pii_viewers, ***REDACTED*** for everyone else. NULL stays NULL.'
RETURN CASE
  WHEN val IS NULL THEN NULL
  WHEN is_account_group_member('game_cx_pii_viewers') THEN val
  ELSE '***REDACTED***'
END;
