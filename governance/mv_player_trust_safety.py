"""Phase 3e: Unity Catalog metric view mv_player_trust_safety.

Run with spark.sql (a %sql cell failed to parse the $$ YAML body).

Grain: one row per account-level event in gold_fact_event (PURCHASE + REPORT).
All 4 joins are many-to-one (keys verified unique: dim_date 730, dim_game 6, dim_player 50,000, mart 50,000).

Included now: purchases, gross/net revenue, paying players, ARPPU, chargeback count/rate/disputed/fees/loss,
reports, reported players, high-value player count.
Deferred (need later phases): avg_fraud_score, fraud_txns_blocked, false_positive_rate (Phase 4 fraud);
toxic_msgs_per_1k, pct_reports_auto_triaged, repeat_offender_rate, toxicity_driven_churn_rate (Phase 4 toxicity/churn);
revenue_at_risk_usd (Phase 4 churn); avg_time_to_action_hours (Phase 8 actions);
dau, mau, dau_mau_ratio, d7/d30_retention, event uplift (session grain, not in gold_fact_event).

Verified 2026-11-12: all 9 base measures match independent counts from silver tables / mart
(948,078 purchases; 9,442 chargebacks; 57,509 reports; 14,271 payers; 20,190 reported players; 6,362 high-value).
"""

MV_NAME = "mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety"

MV_YAML = r"""
version: 1.1
comment: >-
  Trust & Safety and Player 360 KPIs for Emberline Studios, defined once for dashboards, Genie and the app.
  Grain: one row per account-level event in gold_fact_event (PURCHASE and REPORT; ACTION rows arrive in Phase 8).
  Dates come from gold_dim_date. as_of_date is 2026-12-31; never use current_date().
source: mg_aws_serverless_workspace_catalog.game_cx_players.gold_fact_event
joins:
  - name: dates
    source: mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_date
    on: source.date_key = dates.date_key
  - name: games
    source: mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_game
    on: source.game_id = games.game_id
  - name: players
    source: mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_player
    on: source.player_id = players.player_id
  - name: p360
    source: mg_aws_serverless_workspace_catalog.game_cx_players.gold_mart_player_360
    on: source.player_id = p360.player_id
dimensions:
  - name: event_date
    expr: dates.`date`
    comment: Purchase date for PURCHASE events, report date for REPORT events.
  - name: event_month
    expr: DATE_TRUNC('MONTH', dates.`date`)
    format:
      type: date
      date_format: locale_short_month
  - name: event_year
    expr: dates.year
  - name: is_holiday_season
    expr: dates.is_holiday_season
  - name: is_chargeback_window_closed
    expr: dates.`date` <= DATE_SUB(DATE '2026-12-31', 75)
    comment: >-
      True for purchases at least 75 days before as_of_date (2026-12-31). Chargebacks arrive 15-75 days after
      purchase, so chargeback rates for later purchases are still incomplete. Filter to true for final rates.
  - name: event_type
    expr: source.event_type
    comment: PURCHASE or REPORT (ACTION added in Phase 8).
  - name: game_title
    expr: games.title
    synonyms:
      - game
      - title
  - name: genre
    expr: games.genre
  - name: player_region
    expr: players.region
    comment: Americas, EMEA or APAC, from the player's registration country.
    synonyms:
      - region
  - name: age_band
    expr: players.age_band
  - name: acquisition_channel
    expr: players.acquisition_channel
  - name: payment_method
    expr: source.payment_method
  - name: chargeback_reason
    expr: source.chargeback_reason
  - name: report_category
    expr: source.report_category
  - name: is_high_value_player
    expr: p360.is_high_value_player
    comment: Lifetime spend over 50 USD and active within 14 days of as_of_date (2026-12-31).
measures:
  - name: purchase_count
    expr: COUNT(1) FILTER (WHERE source.event_type = 'PURCHASE')
    synonyms:
      - transactions
  - name: gross_revenue_usd
    expr: SUM(source.amount_usd) FILTER (WHERE source.event_type = 'PURCHASE')
    format:
      type: currency
      currency_code: USD
      abbreviation: compact
    synonyms:
      - revenue
      - spend
  - name: paying_players
    expr: COUNT(DISTINCT source.player_id) FILTER (WHERE source.event_type = 'PURCHASE')
    synonyms:
      - payers
  - name: arppu_usd
    expr: try_divide(MEASURE(gross_revenue_usd), MEASURE(paying_players))
    comment: Average revenue per paying player.
    format:
      type: currency
      currency_code: USD
      decimal_places:
        type: exact
        places: 2
  - name: chargeback_count
    expr: COUNT(1) FILTER (WHERE source.has_chargeback)
  - name: chargeback_rate
    expr: try_divide(MEASURE(chargeback_count), MEASURE(purchase_count))
    comment: >-
      Charged-back purchases divided by all purchases, by purchase date. Filter is_chargeback_window_closed = true
      for final rates; recent purchases have not had time to charge back.
    format:
      type: percentage
      decimal_places:
        type: exact
        places: 2
  - name: chargeback_disputed_usd
    expr: SUM(source.chargeback_amount_usd) FILTER (WHERE source.has_chargeback)
    format:
      type: currency
      currency_code: USD
      abbreviation: compact
  - name: chargeback_fees_usd
    expr: SUM(source.chargeback_fee_usd) FILTER (WHERE source.has_chargeback)
    format:
      type: currency
      currency_code: USD
      abbreviation: compact
  - name: chargeback_loss_usd
    expr: MEASURE(chargeback_disputed_usd) + MEASURE(chargeback_fees_usd)
    comment: Disputed amount plus card-network fees.
    format:
      type: currency
      currency_code: USD
      abbreviation: compact
    synonyms:
      - fraud loss
  - name: net_revenue_usd
    expr: MEASURE(gross_revenue_usd) - COALESCE(MEASURE(chargeback_disputed_usd), 0)
    comment: Gross revenue minus disputed chargeback amounts (fees not subtracted).
    format:
      type: currency
      currency_code: USD
      abbreviation: compact
  - name: report_count
    expr: COUNT(1) FILTER (WHERE source.event_type = 'REPORT')
    synonyms:
      - abuse reports
  - name: reported_players
    expr: COUNT(DISTINCT source.reported_player_id)
  - name: high_value_player_count
    expr: COUNT(DISTINCT source.player_id) FILTER (WHERE p360.is_high_value_player)
    comment: >-
      Distinct high-value players (status as of 2026-12-31) with at least one event in the selected slice.
      Every high-value player has purchases, so with no filters this equals the total high-value player count.
"""

# CREATE OR REPLACE resets grants on the view; switch to ALTER VIEW ... AS $$ ... $$ once permissions are assigned.
spark.sql(f"CREATE OR REPLACE VIEW {MV_NAME} WITH METRICS LANGUAGE YAML AS $$\n{MV_YAML}\n$$")
print(f"created {MV_NAME}")
