# AI build log: how Genie Code was used as a teammate

The whole build (plan, data, pipeline, governance, models, Lakebase, Genie agents, dashboard, alerts, app, bundles, docs) was done
with **Genie Code** in the Databricks workspace, over about 10 working sessions. I set the goals and made the decisions; Genie Code
proposed, built, ran and checked.

## Tools

| Tool | Used for |
|---|---|
| Genie Code (agent mode) | Planning, writing notebooks / SQL / TypeScript, running code on serverless, deploying bundles, verifying results |
| Genie Code skills | Built-in: pipelines, dashboards, apps, metric views, Lakebase, jobs, Git. Custom: `gaming-cx` (this project's data model), `pre-commit-code-review` (secret scan) |
| Genie Code memory | Kept decisions, IDs and lessons across sessions (for example the app grant rule) so no session started from zero |
| `ai_query` | LLM toxicity labels inside SQL |
| Genie agents | Natural-language analytics for the business users, tuned with benchmark questions |

## Patterns that worked

1. **Plan before build.** First session: requirements only. Genie Code wrote `docs/PLAN.md` (outcome, KPIs, personas, phases, open
   questions); I accepted or changed each decision before any code.
2. **Decision log for the human.** When I was away, Genie Code continued the work that needed no decisions and collected the rest in
   `docs/MONDAY_DECISIONS.md` (8 items), instead of guessing.
3. **Measure against ground truth.** Synthetic data came with hidden labels; every model and rule was scored against them.
4. **Verify with a second method.** Every number in the docs was re-queried before writing. This caught a recall of 0.957 that should
   have been 0.936 (wrong denominator) and a job duration written as about 6 minutes that was 2.9.
5. **Reusable knowledge.** The `gaming-cx` skill packages the data model, vocabulary and pitfalls, so a new session (or a colleague)
   is productive immediately.
6. **Guardrails before Git.** The secret scan runs before every commit; it flagged a git-ignored `.env`, which was checked and dismissed.

## Example prompts (as given)

* "Build from scratch... realistic data, star schema, raw files in a UC volume, 50K players."
* "Continue all work not needing my decision, per plan; decisions on Monday."
* "Lead with business value; show the journey, integrated; document trade-offs; quantify the value."
* "Run secret scan and commit to Git."
* "Run end-to-end verification checks."

## What AI got wrong, and how it was caught

| Issue | Caught by | Fix |
|---|---|---|
| Pipeline SQL used column names not in the raw files | Pipeline dry run | Matched real schemas |
| 5 countries mapped to region 'Other' | Reconciliation check | Fixed geography dimension |
| Accuracy expectation failed 53.7% of rows (NULL for non-shooters) | Expectation vs injected defect | Allow NULL |
| Email expectation found 0 defects (hid injected NULLs) | Same | Flag NULL |
| App deploy took the app down (missing grant failed type generation) | App status check | Grant first, then deploy; rule added to the skill |
| Metric view recreate dropped grants | Grant check after the change | Use `ALTER VIEW` |
| Wrong cheat recall in notes | Recomputed against ground truth | Report both 0.936 and 0.957 with denominators |

## Time saved (my estimate)

A build of this scope (27-table pipeline, 3 models, Lakebase, 2 Genie agents, dashboard, alerts, full-stack app, bundles, docs) would
normally take a small team several weeks. With Genie Code it took about 10 sessions for one person, with every result verified.
