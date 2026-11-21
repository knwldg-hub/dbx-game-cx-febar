# Role-play script: Emberline Studios Player Trust & Safety

Audience: **Priya Raman**, VP Player Experience & Trust (business, executive sponsor) and **Marcus Chen**, Director of Data Platform (technical).
Length: 12 minutes + questions. Structure: tell (2 min) -> show (8 min) -> tell (2 min).
App: `https://game-cx-players-console-7474646384679108.aws.databricksapps.com`

## Before the call (checklist)

* Open in tabs: app Executive Overview, app Risk Queue, dashboard `Emberline Player Trust & Safety`, Genie Fraud & Trust Safety.
* Warm up: load each app page once (first warehouse query is slower).
* Check the latest daily job run is SUCCESS and the app is RUNNING.
* Pick a player in the warn queue for the live action (not P000090, already actioned).
* Have `evidence/e2e_verification.md` open as a backup if a screen fails.

## Tell (2 min): the outcome

> "Priya, Emberline is losing about $10.5 million a year in three places that look separate but hit the same players:
> fraud chargebacks at almost 3% of gross, toxicity that makes victims churn 20 points more, and moderators reading reports by hand.
> Today your payments, chat and gameplay data sit in different systems, so no one sees the whole player.
> We built one Player 360 and one console. Let me show you what your team would do with it on Monday morning."

One line for Marcus: "Everything you will see runs on one governed copy of the data in Unity Catalog, and every decision flows back into it."

## Show (8 min)

| Time | Screen | Say | Point at |
|---|---|---|---|
| 0:00 | Executive Overview | "This is Priya's page. Revenue up 32% on the last 30 days, 21,549 monthly players. But look at chargebacks by game." | Shooters: 1.56% and 1.77% vs about 0.6% elsewhere |
| 1:30 | Same, action backlog | "Each number is a queue: what it is, why it matters, how to act, what next. 618 accounts to suspend, 2,350 fraud reviews." | What / Why / How / Next panel |
| 2:30 | Risk Queue -> Player 360 | "Your moderator sees why, in plain English: fraud score, toxicity, reports. One click." Click **Warn** on the prepared player | Confirmation banner |
| 4:00 | Fraud Rings | "For the Head of Payments Risk: 155 rings, 604 accounts sharing devices, $287K in chargebacks. Suspend a ring at once. 14 accounts the model alone missed are caught through shared devices." | Ring detail |
| 5:30 | Ask Trust & Safety (Genie) | Ask: "What is the chargeback rate by game for closed chargeback windows?" | Answer + SQL |
| 6:30 | Ask Player Experience (Genie) | Ask: "Which game had the worst matchmaking quality in the last 30 days?" | Self-service answer |
| 7:15 | Closed loop (tell, with evidence) | "The warn I just clicked is in Lakebase now. Tomorrow at 06:00 it flows into the lakehouse: fact table, Player 360, dashboard, Genie, next model retrain. We tested exactly that: one job run, 2.7 minutes, all 6 layers." | evidence table |

## Tell (2 min): value and ask

> "So: fraud at $6.7M, toxicity churn at $2.6M, moderator time at $1.2M. About $10.5M a year, and $5.3M even if only half lands.
> What I propose is a 6-week pilot on one shooter title with your real feeds. We measure chargeback dollars caught at your current
> review capacity, time to action, and hours saved, and confirm the number with Finance.
> Can we agree on the title and an owner from Payments Risk and Trust & Safety this week?"

## Objections: Priya Raman (business)

| Objection | Answer |
|---|---|
| "$10.5M from synthetic data? Why should I believe it?" | The rates are measured, the assumptions are shown on one slide, and the conservative case is $5.3M. The pilot exists to replace our rates with yours; we commit to the measure, not the number. |
| "Will we ban innocent players?" | Nothing is automatic. Fraud review is the top 1% for a human to decide. The cheat rule has had zero false positives against ground truth; the LLM cut banter false positives from 69% to 20%. Every action has who, when and why. |
| "My team won't adopt another tool." | It replaces several: one queue with reasons in plain English, and one-click actions. Moderators don't need SQL; Genie answers questions in plain English. |
| "What does it cost to run?" | Serverless and pay per use. The daily refresh takes under 3 minutes; toxicity labelling is a bounded batch. We size it properly in week 1 of the pilot against your volumes. |
| "We already use an anti-fraud vendor." | Keep it. Its score becomes one more feature in the Player 360. What the vendor can't see is chat, gameplay and moderation history for the same player. |
| "Can it act in real time, during a match?" | Today the console acts instantly and analytics refresh daily. Lakeflow supports streaming; we'd move toxicity scoring to real time where the business case justifies it. |
| "What about player privacy?" | Emails, phones and chat text are masked for anyone outside an approved group; access is governed and audited in Unity Catalog. |
| "How long until we see value?" | Six weeks to a measured result on one title. |

## Objections: Marcus Chen (technical)

| Objection | Answer |
|---|---|
| "Why Lakebase and not query the warehouse from the app?" | The console needs millisecond point reads (3.9 ms measured) and transactional writes (12 ms). The warehouse serves the aggregates through governed metric views. Lakebase stays in sync from Unity Catalog, so there is no extra ETL. |
| "Daily sync means analytics are a day late." | A deliberate trade-off: simple, idempotent, full history. The console itself is instant. If needed, the job can run more often; the table is small. |
| "Will it scale to 8M MAU?" | Serverless pipeline with incremental Auto Loader ingest; today 7.1M sessions refresh in about 1.4 minutes. Volume grows the compute, not the design. |
| "How is it governed?" | Unity Catalog: column masks, governed tags, lineage, comments on every column, least-privilege grants for the app's service principal, two Discover domains. |
| "How do you keep models current?" | MLflow in Unity Catalog with `@champion` aliases. Moderator actions now land as events, which gives labels for retraining. |
| "LLM cost and safety?" | Batch labelling of 10K messages with a bounded sample. `ai_query` can't call custom gateway services in this workspace, so production would call the AI Gateway service (PII guardrail, safety filter, fallback) and add a budget once an account admin sets it. |
| "How is it deployed?" | Declarative Automation Bundles from Git: pipeline, job, alerts, dashboard and app, dev and prod targets; secret scan before every commit; OAuth only, no stored secrets. |
| "Why two Genie agents?" | Fewer tables per agent gives sharper answers; both score 10/10 on benchmark questions. |
| "Lock-in?" | Data is Delta in your cloud storage; serving is Postgres; models are MLflow. All open formats and APIs. |
| "The pipeline is in development mode." | Intentional for the demo (faster iteration). The bundle's `prod` target deploys in production mode. |

## If something breaks live

* Genie slow: show the saved answer and SQL from the benchmark, then move on.
* App page error: switch to the dashboard (same metric views), then show `evidence/e2e_verification.md`.
* Never debug live; say "I'll follow up with the exact cause" and continue.

## Rehearsal

Run it out loud twice at 12 minutes. Practice the 3 hardest questions: "believe the $10.5M", "innocent players", "why Lakebase".
