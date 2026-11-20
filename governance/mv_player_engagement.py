"""Phase 9: Unity Catalog metric view mv_player_engagement (session grain).

Grain: one row per session in gold_fact_session (7,077,744 rows, 2025-01-01..2026-12-31).
Joins (all many-to-one, keys verified unique): gold_dim_date (date_key), gold_dim_game (game_id),
gold_dim_device (device_id), gold_dim_player (player_id), gold_mart_player_360 (player_id),
gold_dim_live_ops_event (live_ops_event_id -> event_id, NULL when no event was running).

DAU note: avg_dau = player-days / days in the slice, i.e. the average daily active players over whatever
period is selected. stickiness_dau_mau = avg_dau / active_players; it is DAU/MAU when grouped by month.
as_of_date is 2026-12-31; never use current_date().
"""

MV_NAME = "mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_engagement"
C = "mg_aws_serverless_workspace_catalog.game_cx_players"

MV_YAML = f"""
version: 1.1
comment: >-
  Player engagement, live-ops and fair-play KPIs for Emberline Studios at session grain (gold_fact_session).
  Use for DAU, MAU, stickiness, session counts and minutes, matchmaking quality, live-ops reach and suspected
  cheating. as_of_date is 2026-12-31; never use current_date().
source: {C}.gold_fact_session
joins:
  - name: dates
    source: {C}.gold_dim_date
    on: source.date_key = dates.date_key
  - name: games
    source: {C}.gold_dim_game
    on: source.game_id = games.game_id
  - name: devices
    source: {C}.gold_dim_device
    on: source.device_id = devices.device_id
  - name: players
    source: {C}.gold_dim_player
    on: source.player_id = players.player_id
  - name: p360
    source: {C}.gold_mart_player_360
    on: source.player_id = p360.player_id
  - name: liveops
    source: {C}.gold_dim_live_ops_event
    on: source.live_ops_event_id = liveops.event_id
dimensions:
  - name: session_date
    expr: source.session_date
  - name: session_month
    expr: DATE_TRUNC('MONTH', source.session_date)
    format:
      type: date
      date_format: locale_short_month
    synonyms:
      - month
  - name: session_year
    expr: dates.year
  - name: is_last_30_days
    expr: source.session_date > DATE_SUB(DATE '2026-12-31', 30)
    comment: True for sessions in the 30 days ending at as_of_date 2026-12-31 (the current MAU window).
  - name: game_title
    expr: games.title
    synonyms:
      - game
      - title
  - name: genre
    expr: games.genre
  - name: platform
    expr: devices.platform
  - name: device_type
    expr: devices.device_type
  - name: player_region
    expr: players.region
    synonyms:
      - region
  - name: age_band
    expr: players.age_band
  - name: acquisition_channel
    expr: players.acquisition_channel
  - name: account_status
    expr: p360.account_status
    comment: active or closed.
  - name: is_high_value_player
    expr: p360.is_high_value_player
    comment: Lifetime spend over 50 USD and active within 14 days of as_of_date (2026-12-31).
  - name: is_at_risk
    expr: p360.is_at_risk
    comment: churn_player_classifier@champion flags the player as likely to churn (churn_risk = 1).
  - name: is_suspected_cheater
    expr: p360.is_suspected_cheater
    comment: Rule-based cheat flag from shooter titles (2 of 3 signals over at least 3 sessions).
  - name: is_live_ops_session
    expr: source.live_ops_event_id IS NOT NULL
    comment: True when the session happened while a live-ops event (time-limited campaign) was running.
  - name: live_ops_event_name
    expr: liveops.event_name
  - name: live_ops_event_type
    expr: liveops.event_type
  - name: is_poor_matchmaking
    expr: source.matchmaking_quality < 0.5
    comment: Matchmaking quality score below 0.5 (0-1 scale).
measures:
  - name: session_count
    expr: COUNT(1)
    synonyms:
      - sessions
  - name: active_players
    expr: COUNT(DISTINCT source.player_id)
    comment: Distinct players with a session in the slice. Grouped by month this is MAU.
    synonyms:
      - MAU
      - unique players
  - name: avg_dau
    expr: try_divide(COUNT(DISTINCT source.player_id, source.session_date), COUNT(DISTINCT source.session_date))
    comment: Average daily active players over the selected period (player-days divided by days).
    synonyms:
      - DAU
      - daily active users
  - name: stickiness_dau_mau
    expr: try_divide(MEASURE(avg_dau), MEASURE(active_players))
    comment: Average DAU divided by distinct active players; equals DAU/MAU when grouped by month.
    format:
      type: percentage
      decimal_places:
        type: exact
        places: 1
  - name: total_minutes
    expr: SUM(source.duration_min)
  - name: avg_session_minutes
    expr: AVG(source.duration_min)
    synonyms:
      - average session duration
  - name: sessions_per_player
    expr: try_divide(MEASURE(session_count), MEASURE(active_players))
  - name: avg_matchmaking_quality
    expr: AVG(source.matchmaking_quality)
  - name: poor_matchmaking_rate
    expr: try_divide(COUNT(1) FILTER (WHERE source.matchmaking_quality < 0.5), COUNT(1))
    format:
      type: percentage
      decimal_places:
        type: exact
        places: 1
  - name: avg_ping_ms
    expr: AVG(source.ping_ms)
  - name: live_ops_sessions
    expr: COUNT(1) FILTER (WHERE source.live_ops_event_id IS NOT NULL)
  - name: live_ops_reach_players
    expr: COUNT(DISTINCT source.player_id) FILTER (WHERE source.live_ops_event_id IS NOT NULL)
  - name: suspected_cheaters
    expr: COUNT(DISTINCT source.player_id) FILTER (WHERE p360.is_suspected_cheater)
    comment: Distinct suspected cheaters with a session in the slice.
  - name: cheater_session_share
    expr: try_divide(COUNT(1) FILTER (WHERE p360.is_suspected_cheater), COUNT(1))
    comment: Share of sessions played by suspected cheaters (how many lobbies they can affect).
    format:
      type: percentage
      decimal_places:
        type: exact
        places: 2
  - name: avg_headshot_pct
    expr: AVG(source.headshot_pct)
  - name: avg_accuracy_pct
    expr: AVG(source.accuracy_pct)
"""

# ALTER VIEW keeps grants; CREATE only on first deploy.
if spark.catalog.tableExists(MV_NAME):
    spark.sql(f"ALTER VIEW {MV_NAME} AS $$\n{MV_YAML}\n$$")
    print(f"altered {MV_NAME}")
else:
    spark.sql(f"CREATE VIEW {MV_NAME} WITH METRICS LANGUAGE YAML AS $$\n{MV_YAML}\n$$")
    print(f"created {MV_NAME}")
