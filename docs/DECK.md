# Emberline Studios: Protect revenue and players with one Player 360

Presented to: Priya Raman, VP Player Experience & Trust (executive sponsor), with the Head of Payments Risk and the
Trust & Safety operations manager (domain owners) and Marcus Chen, Director of Data Platform.
All data is synthetic; simulated as-of date 2026-12-31. Every number below is measured in the build unless marked *estimate*.

---

## 1. The outcome

**Emberline loses about $10.5M a year to three connected leaks. We built one governed Player 360 and a decision console
that stops them, and every decision a moderator makes flows straight back into the data.** *(estimate; $5.3M if only half is realized)*

| Leak | What it costs Emberline today | What changes |
|---|---|---|
| Payment fraud | Chargebacks + fees = **2.96% of gross**, about $17.8M a year at $600M bookings | Review the riskiest 1% of purchases and catch **75.6%** of chargeback dollars: **$6.7M a year** |
| Toxicity | **9.7%** of players are victims; they churn at **75.9% vs 55.6%** | Act on toxic players faster: **$2.6M a year** in retained revenue |
| Manual triage | ~1.59M player reports a year, read by hand | LLM labels reports (F1 **0.994**): **47,800 analyst hours, $1.2M a year** |

Live today: 6 titles, 50K-player sample, 1 console, 2 Genie agents, refreshed every morning at 06:00.

---

## 2. What it means for the executive sponsor (Priya Raman)

Priya owns retention, player trust and the brand. She gets:

* **Revenue protected:** about $10.5M a year *(estimate)*, from fraud, toxicity-driven churn and moderator time.
* **One place to see the business:** last 30 days revenue $1.34M (**+32%** vs the prior 30 days), 21,549 MAU,
  DAU/MAU stickiness 32.9%, chargeback rate, open action backlog, all on the Executive Overview with prior-period deltas.
* **Where to act first:** shooters (Iron Vanguard, Starfall Legends) earn **46%** of revenue but cause **81%** of
  chargeback losses (chargeback rate 1.56% and 1.77% vs 0.60-0.69% for the other titles).
* **Self-service answers:** "Which game had the worst matchmaking last month?" answered in plain English by the
  Player Experience Genie agent, 10/10 on its benchmark questions.
* **Brand safety with an audit trail:** every suspend, warn and clear is recorded with who, when and why.

---

## 3. What it means for the domain owners

**Head of Payments Risk**

| KPI | Today | With the build |
|---|---|---|
| Chargeback rate (closed window) | 1.12% | about 0.69% *(estimate, half of caught losses prevented)* |
| Chargeback $ caught at fixed review capacity (1% of purchases) | Not measured | **75.6%** |
| Fraud rings | Found case by case | **155 rings, 604 accounts, $286.8K in chargebacks** shown as one list, bulk suspend in one click |
| Rings the model alone would miss | Unknown | 14 accounts in 8 rings, caught through shared devices |

**Trust & Safety operations manager**

| KPI | Today | With the build |
|---|---|---|
| Report triage | Manual | LLM labels: F1 0.994 vs 0.191 for keyword rules; banter false positives 20% vs 69% |
| Work queue | Spread over tools | One Risk Queue: 618 suspend, 2,350 fraud reviews, 1,648 toxicity warnings, 307 cheating reviews, each with plain-English reasons |
| Cheaters | Reports only | Rule flags 337 players, **0 false positives** (precision 1.000, recall 0.936) |
| Time from decision to analytics | Not connected | Next morning, automatically (verified: 2.7-minute job) |

---

## 4. One player, end to end (how the layers connect)

Player **P000090** sends abusive chat in Starfall Legends.

1. **Data lands:** chat, sessions, payments and reports arrive as daily files in a Unity Catalog volume.
2. **Lakeflow** cleans them (bad rows dropped by expectations: 21,606 sessions) and builds one star schema.
3. **AI** labels the messages: toxicity score 1.0. The churn and fraud models score the same player.
4. **Unity Catalog** governs it: the email is masked for anyone outside `game_cx_pii_viewers`; lineage shows every step.
5. **Player 360** sets `recommended_action = warn_toxicity`.
6. **Lakebase** serves the profile to the console in **3.9 ms**.
7. The moderator opens **Risk Queue**, reads why, clicks **Warn**: written to Lakebase in **12 ms**.
8. **Next morning** the job carries the action back: bronze -> fact table -> Player 360 -> metric view -> Lakebase.
   P000090 now shows `actions_taken = 1`, and the dashboard, Genie and the next model retrain all see it.

We ran exactly this test on 2026-11-20: the action appeared in all 6 layers after one job run ([evidence](../evidence/e2e_verification.md)).

---

## 5. The demo (tell, show, tell)

| Step | Screen | What the audience sees | KPI it moves |
|---|---|---|---|
| 1 | Executive Overview | Revenue +32%, chargeback rate by game, action backlog with What / Why / How / Next | Revenue, chargeback rate |
| 2 | Risk Queue -> Player 360 | Why a player is flagged, in plain English; suspend or warn | Time to action |
| 3 | Fraud Rings | One ring, shared devices, chargebacks; bulk suspend | Fraud loss, rings detected |
| 4 | Ask Trust & Safety (Genie) | "Chargeback rate by game for closed windows" | Self-service |
| 5 | Ask Player Experience (Genie) | "Which live-ops events reached the most players?" | Retention, live-ops |
| 6 | Dashboard + alerts | Fraud-ring and toxicity-spike alerts, email | Detection time |

---

## 6. How the value adds up *(estimate)*

Method: rates measured in the data, scaled to Emberline's $600M annual bookings with one factor
($600M / $11.49M 2026 sample bookings = **52.2x**).

| Lever | Measured | Assumption | Annual value |
|---|---|---|---|
| Fraud | Loss 2.96% of gross; 75.6% of chargeback $ caught at 1% review | 50% of caught loss prevented | $17.8M x 75.6% x 50% = **$6.7M** |
| Toxicity | Victims spent $820K (sample, 2025); +20.3 pts churn | 30% less exposure | $8.7M lost x 30% = **$2.6M** |
| Moderation | 30,508 reports (sample, 2026) = 1.59M at scale | 60% auto-triaged, 3 min each, $25/hour | **$1.2M** |
| **Total** | | | **$10.5M** (conservative: $5.3M) |

Sensitivity: our synthetic fraud loss rate is high. At half that rate the fraud lever is $3.4M and the total $7.2M.
Upside not counted: retention of high-value at-risk players, chargeback-fee and card-network penalty reductions.

---

## 7. Decisions and trade-offs

| Decision | Why | What we gave up |
|---|---|---|
| One Player 360 for three teams | Fraud, toxicity and churn hit the same players; one score per player, one queue | Shared ownership of one mart |
| Lakebase for the console, warehouse for KPIs | Millisecond lookups and transactional write-back; aggregates through governed metric views | Two data paths, kept in step by the daily job |
| Daily sync of actions | Simple, idempotent, full history | Analytics see actions next morning (the console updates instantly) |
| LLM toxicity on a 10K sample | F1 0.994 at bounded cost | Not every message labelled; production scores reported messages as they arrive |
| Transparent cheat rule, not a model | Moderators can explain every flag; no false positives | Misses players with too few shooter matches |
| Two scoped Genie agents | Fewer tables per agent, more accurate answers | Two tabs instead of one |
| Synthetic data with ground truth | Every model measured against the truth; same players across all sources | Rates differ from a real studio, shown in the sensitivity |
| Everything in bundles | Pipeline, job, alerts, dashboard, app deploy from Git to dev and prod | Initial setup effort |

---

## 8. Proof it works

| Check | Result |
|---|---|
| Closed loop: one new decision through 6 layers | PASS, one 2.7-minute job run |
| Reconciliation bronze -> silver -> gold | PASS; revenue $20,141,969.22 identical in silver and gold |
| Fraud model (holdout) | PR-AUC 0.314 vs 1.0% base rate; ROC-AUC 0.765 |
| Churn model (holdout) | ROC-AUC 0.882; top-decile lift 5.8x |
| Toxicity LLM | F1 0.994 vs keyword 0.191 |
| Genie agents | 10/10 and 10/10 benchmark questions |
| Lakebase | 3.9 ms lookup, 12.1 ms write |
| Daily job | 3 of 3 runs SUCCESS |

---

## 9. Architecture (for Marcus Chen)

```
Raw files (UC volume)
  -> Lakeflow Spark Declarative Pipeline: 9 bronze -> 9 silver -> 6 dims + 2 facts + Player 360 mart (serverless)
  -> Unity Catalog: comments, governed tags, PII column masks, lineage, 2 metric views, 2 Discover domains
  -> MLflow + UC registry: fraud_txn_classifier, churn_player_classifier; ai_query LLM toxicity; cheat rule
  -> Lakebase Postgres: synced risk profile (read) + moderation actions (write)
  -> Genie agents (2) on metric views + mart;  AI/BI dashboard + 2 SQL alerts
  -> Databricks App (AppKit, React/TypeScript): reads Lakebase, writes actions, embeds both Genie agents
  -> Job 06:00 daily: actions -> Delta -> pipeline -> Lakebase sync   (closed loop)
Deployed with Declarative Automation Bundles (dev and prod targets). No secrets in code: OAuth everywhere.
```

---

## 10. How AI built this with us

Built with **Genie Code** as a teammate, in the workspace, end to end ([full log](AI_BUILD_LOG.md)).

* **Plan first:** Genie Code drafted `PLAN.md` (requirements, KPIs, personas, phases); I accepted or changed each decision.
* **Build:** data generator, 27 pipeline SQL files, 3 models, Lakebase setup, 2 Genie agents, dashboard, alerts, bundles, app.
* **Check every number:** reconciliation and ground-truth tests caught 4 pipeline bugs, a wrong recall figure (0.957 vs 0.936) and
  an overstated job duration before they reached this deck.
* **Guardrails:** pre-commit secret scan before every push; a reusable `gaming-cx` skill carries the data model into future sessions.
* **AI in the product:** LLM toxicity labels, Genie agents for business users.

---

## 11. Next steps: a 6-week pilot

| Weeks | What | Success measure |
|---|---|---|
| 1-2 | Connect real payments, chat and telemetry feeds (Lakeflow Connect / Auto Loader) for one shooter title | Daily refresh SUCCESS; reconciliation PASS |
| 3-4 | Retrain fraud and churn models on Emberline data; T&S team uses the console | Chargeback $ caught at 1% review >= 60% |
| 5-6 | Measure | Chargeback rate down, time to action down, hours saved; confirm the value model with Finance |

Asks: an executive sponsor (Priya), a Payments Risk and a T&S owner, read access to the three source systems, and an account admin to set
the AI Gateway budget and Slack alerts.

---

## Appendix: assumptions and limits

* Synthetic data; 50K players stand for Emberline's base. $600M bookings and $25/hour moderator cost were agreed in planning;
  3 minutes per report, 50% of caught fraud prevented, 30% less toxicity exposure and 60% auto-triage are our assumptions, to confirm in the pilot.
* Not done: AI Gateway budget, Slack delivery, UC sub-domains (admin rights or account limits); Lakehouse quality monitors (workspace limit).
  Pipeline expectations cover data quality meanwhile.
* `ai_query` used a system model directly because it cannot call custom gateway services in this workspace.
