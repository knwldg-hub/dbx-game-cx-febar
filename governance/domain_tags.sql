-- Phase 3f: assign assets to Discover domains by applying the domain's governed tag.
-- Domains (created in Discover 2026-11-13; owner Mayur Gupta): Player-Trust-Safety, Player-Experience.
-- Sub-domains not created: the account's governed-tag limit is exhausted (each sub-domain needs its own tag).
-- Tag tables individually; tagging the schema would pull all 27 tables (incl. bronze) into a domain.
-- Later phases add: ml_* tables, lb_* tables, app, alerts, Genie agents.

-- Player-Trust-Safety
ALTER TABLE mg_aws_serverless_workspace_catalog.game_cx_players.gold_fact_event       SET TAGS ('Player-Trust-Safety');
ALTER TABLE mg_aws_serverless_workspace_catalog.game_cx_players.silver_player_reports SET TAGS ('Player-Trust-Safety');

-- Player-Experience
ALTER TABLE mg_aws_serverless_workspace_catalog.game_cx_players.gold_fact_session       SET TAGS ('Player-Experience');
ALTER TABLE mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_player         SET TAGS ('Player-Experience');
ALTER TABLE mg_aws_serverless_workspace_catalog.game_cx_players.gold_mart_player_360    SET TAGS ('Player-Experience');
ALTER TABLE mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_live_ops_event SET TAGS ('Player-Experience');
ALTER TABLE mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_game           SET TAGS ('Player-Experience');

-- Both domains: shared dims + metric view (fraud and revenue measures)
ALTER TABLE mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_date      SET TAGS ('Player-Trust-Safety', 'Player-Experience');
ALTER TABLE mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_geography SET TAGS ('Player-Trust-Safety', 'Player-Experience');
ALTER TABLE mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_device    SET TAGS ('Player-Trust-Safety', 'Player-Experience');
ALTER VIEW  mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety SET TAGS ('Player-Trust-Safety', 'Player-Experience');
