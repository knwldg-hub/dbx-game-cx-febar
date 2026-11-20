import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  BarChart,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DonutChart,
  LineChart,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { InsightPanel, type NextStep } from '../../components/InsightPanel';
import { ACTION_PLAYBOOK, ActionBadge } from '../../components/ActionBadge';
import { formatInt, formatPct, formatUsd, toNumber, AS_OF_DATE } from '../../lib/format';

type Row = Record<string, unknown>;

const GAMES = ['Iron Vanguard', 'Starfall Legends', 'Realm of Ash', 'Hollow Crown', 'Gem Tide', 'Pocket Racers'];
const SHOOTERS = new Set(['Iron Vanguard', 'Starfall Legends']);
const REGIONS = ['Americas', 'EMEA', 'APAC'];

// Every period ends at as_of_date 2026-12-31. The prior period is the same length immediately before.
const PERIODS = [
  { key: 'all', label: 'All time', start: '2025-01-01', phrase: 'since Jan 2025' },
  { key: 'ytd', label: '2026', start: '2026-01-01', phrase: 'in 2026' },
  { key: '90d', label: 'Last 90 days', start: '2026-10-03', phrase: 'in the last 90 days' },
  { key: '30d', label: 'Last 30 days', start: '2026-12-02', phrase: 'in the last 30 days' },
];

// Internal targets (assumptions for the demo, not external benchmarks).
const CHARGEBACK_TARGET = 0.01;
const POOR_MATCHMAKING_TARGET = 0.1;

// Backlog shown in the same priority order the mart uses to pick one action per player.
const ACTION_ORDER = ['suspend', 'review_fraud', 'warn_toxicity', 'review_cheating', 'retain', 'monitor'];

const asRows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const num = (v: unknown): number => {
  const n = toNumber(v);
  return Number.isNaN(n) ? 0 : n;
};
const usdAxis = (v: string | number): string => formatUsd(v, true);

function Delta({ cur, prev, goodWhenUp = true }: { cur: unknown; prev: unknown; goodWhenUp?: boolean }) {
  const c = toNumber(cur);
  const p = toNumber(prev);
  if (Number.isNaN(c) || Number.isNaN(p) || p <= 0) return null;
  const d = (c - p) / p;
  const good = goodWhenUp ? d >= 0 : d <= 0;
  return (
    <span className={`text-xs font-medium ${good ? 'text-emerald-600' : 'text-destructive'}`}>
      {d >= 0 ? '▲' : '▼'} {formatPct(Math.abs(d), 1)} vs prior period
    </span>
  );
}

function Kpi({
  label,
  value,
  hint,
  delta,
  status,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  delta?: ReactNode;
  status?: 'good' | 'bad';
}) {
  const border = status === 'bad' ? 'border-l-4 border-l-destructive' : status === 'good' ? 'border-l-4 border-l-emerald-500' : '';
  return (
    <Card className={border}>
      <CardContent className="pt-5 pb-4 space-y-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {delta}
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function QueryError({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div className="text-destructive bg-destructive/10 p-3 rounded-md text-sm">Error: {error}</div>;
}

/** One-line prescriptive signal per title for the scorecard. */
function gameSignal(r: Row): { text: string; bad: boolean } {
  const cb = toNumber(r.chargeback_rate_closed);
  if (!Number.isNaN(cb) && cb > CHARGEBACK_TARGET) {
    return { text: 'Chargebacks above target: tighten payment-risk checks and work the fraud queue', bad: true };
  }
  if (toNumber(r.poor_matchmaking_rate) > POOR_MATCHMAKING_TARGET) {
    return { text: 'Matchmaking quality below target: review queue tuning', bad: true };
  }
  return { text: 'Healthy: keep monitoring', bad: false };
}

/**
 * Executive Overview (landing page): what is happening across the portfolio, why it matters,
 * how we know, and the next actions, with game / region / period filters.
 */
export function ExecutiveOverviewPage() {
  const [game, setGame] = useState('all');
  const [region, setRegion] = useState('all');
  const [periodKey, setPeriodKey] = useState('all');
  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[0];
  const g = game === 'all' ? '' : game;
  const r = region === 'all' ? '' : region;
  const filtered = g !== '' || r !== '' || periodKey !== 'all';

  const fullParams = useMemo(
    () => ({ game: sql.string(g), region: sql.string(r), start_date: sql.date(period.start) }),
    [g, r, period.start],
  );
  const portfolioParams = useMemo(() => ({ region: sql.string(r), start_date: sql.date(period.start) }), [r, period.start]);
  const regionParams = useMemo(() => ({ region: sql.string(r) }), [r]);

  const kpis = useAnalyticsQuery('exec_kpis', fullParams);
  const scorecard = useAnalyticsQuery('game_scorecard', portfolioParams);
  const backlog = useAnalyticsQuery('action_backlog', regionParams);

  const k = asRows(kpis.data)[0];
  const scRows = asRows(scorecard.data);
  const blRows = asRows(backlog.data)
    .slice()
    .sort((a, b) => ACTION_ORDER.indexOf(String(a.recommended_action)) - ACTION_ORDER.indexOf(String(b.recommended_action)));
  const bl = (action: string): Row | undefined => blRows.find((x) => x.recommended_action === action);

  // Portfolio insight: share of chargeback loss vs share of revenue from the two shooters.
  const totalLoss = scRows.reduce((acc, x) => acc + num(x.chargeback_loss_usd), 0);
  const totalRev = scRows.reduce((acc, x) => acc + num(x.gross_revenue_usd), 0);
  const shooterLoss = scRows.filter((x) => SHOOTERS.has(String(x.game_title))).reduce((acc, x) => acc + num(x.chargeback_loss_usd), 0);
  const shooterRev = scRows.filter((x) => SHOOTERS.has(String(x.game_title))).reduce((acc, x) => acc + num(x.gross_revenue_usd), 0);
  const openTotal = blRows.filter((x) => x.recommended_action !== 'monitor').reduce((acc, x) => acc + num(x.open_players), 0);

  const cbClosed = toNumber(k?.chargeback_rate_closed);
  const cbOpen = Number.isNaN(cbClosed);
  const cbBad = !cbOpen && cbClosed > CHARGEBACK_TARGET;
  const scope = [g || 'all games', r || 'all regions'].join(' · ');

  const nextSteps: NextStep[] = [];
  const sus = bl('suspend');
  if (sus) {
    nextSteps.push({
      label: (
        <>
          Suspend <b>{formatInt(sus.open_players)}</b> players flagged for fraud and toxicity ({formatUsd(sus.lifetime_spend_usd, true)} spend involved).
        </>
      ),
      to: '/risk-queue?action=suspend',
      cta: 'Risk Queue',
    });
  }
  nextSteps.push({ label: 'Break up device-sharing fraud rings the per-player model misses.', to: '/fraud-rings', cta: 'Fraud Rings' });
  const rf = bl('review_fraud');
  if (rf) {
    nextSteps.push({
      label: (
        <>
          Review <b>{formatInt(rf.open_players)}</b> fraud cases; {formatInt(rf.high_value_players)} are high-value, so confirm before suspending.
        </>
      ),
      to: '/risk-queue?action=review_fraud',
      cta: 'Review',
    });
  }
  const rt = bl('retain');
  if (rt) {
    nextSteps.push({
      label: (
        <>
          Save <b>{formatInt(rt.open_players)}</b> high-value players about to churn ({formatUsd(rt.lifetime_spend_usd, true)} lifetime spend).
        </>
      ),
      to: '/risk-queue?action=retain',
      cta: 'Retain',
    });
  }
  const rc = bl('review_cheating');
  if (rc) {
    nextSteps.push({
      label: (
        <>
          Review <b>{formatInt(rc.open_players)}</b> suspected cheaters in the shooters.
        </>
      ),
      to: '/risk-queue?action=review_cheating',
      cta: 'Review',
    });
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Executive Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue, trust and player experience across Emberline's six titles. Data as of {AS_OF_DATE}.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col lg:flex-row lg:items-center gap-3">
          <Select value={game} onValueChange={setGame}>
            <SelectTrigger className="lg:w-52" aria-label="Filter by game">
              <SelectValue placeholder="All games" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All games</SelectItem>
              {GAMES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="lg:w-44" aria-label="Filter by region">
              <SelectValue placeholder="All regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {REGIONS.map((x) => (
                <SelectItem key={x} value={x}>
                  {x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={p.key === periodKey ? 'default' : 'outline'}
                aria-pressed={p.key === periodKey}
                onClick={() => setPeriodKey(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {filtered && (
            <Button
              size="sm"
              variant="ghost"
              className="lg:ml-auto"
              onClick={() => {
                setGame('all');
                setRegion('all');
                setPeriodKey('all');
              }}
            >
              Reset filters
            </Button>
          )}
        </CardContent>
      </Card>

      <QueryError error={kpis.error} />
      {kpis.loading && !k && <Skeleton className="h-36 w-full" />}
      {k && (
        <InsightPanel
          tone={cbBad ? 'alert' : 'default'}
          what={
            <>
              <b>{formatUsd(k.gross_revenue_usd, true)}</b> gross revenue {period.phrase} ({scope}){' '}
              <Delta cur={k.gross_revenue_usd} prev={k.prev_gross_revenue_usd} />. <b>{formatInt(k.mau_30d)}</b> players were active in
              the last 30 days, and {formatPct(k.stickiness_30d, 0)} of them play on a typical day.
            </>
          }
          why={
            <>
              {cbOpen ? (
                <>The chargeback window is still open for this period (disputes land 15–75 days after purchase), so pick a longer period for a final rate. </>
              ) : (
                <>
                  Final chargeback rate is <b className={cbBad ? 'text-destructive' : ''}>{formatPct(cbClosed)}</b> against a{' '}
                  {formatPct(CHARGEBACK_TARGET, 1)} target, costing {formatUsd(k.chargeback_loss_usd, true)}.{' '}
                </>
              )}
              {g === '' && totalLoss > 0 && (
                <>
                  The two shooters earn {formatPct(shooterRev / totalRev, 0)} of revenue but cause{' '}
                  <b>{formatPct(shooterLoss / totalLoss, 0)}</b> of chargeback loss.
                </>
              )}
            </>
          }
          how={
            <>
              Governed metric views over the gold layer. ML fraud, churn and toxicity scores plus a cheat rule roll up to one
              recommended action per player; {formatInt(openTotal)} players{r ? ` in ${r}` : ''} still need a moderator decision.
              Decisions write back through Lakebase into the lakehouse.
            </>
          }
          next={nextSteps}
        />
      )}

      {k && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            label="Gross revenue"
            value={formatUsd(k.gross_revenue_usd, true)}
            delta={<Delta cur={k.gross_revenue_usd} prev={k.prev_gross_revenue_usd} />}
            hint={`Net ${formatUsd(k.net_revenue_usd, true)} after disputes`}
          />
          <Kpi
            label="Chargeback rate (final)"
            value={cbOpen ? 'Pending' : formatPct(cbClosed)}
            status={cbOpen ? undefined : cbBad ? 'bad' : 'good'}
            hint={
              cbOpen
                ? 'Purchases too recent to be final'
                : `Target ≤ ${formatPct(CHARGEBACK_TARGET, 1)} · loss ${formatUsd(k.chargeback_loss_usd, true)}`
            }
          />
          <Kpi label="Paying players" value={formatInt(k.paying_players)} hint={`${formatUsd(k.arppu_usd)} average spend per payer`} />
          <Kpi
            label="Active players in period"
            value={formatInt(k.active_players)}
            delta={<Delta cur={k.active_players} prev={k.prev_active_players} />}
            hint={`${formatInt(Math.round(num(k.avg_dau)))} on an average day`}
          />
          <Kpi
            label="Monthly active (last 30 days)"
            value={formatInt(k.mau_30d)}
            hint={`Stickiness (DAU/MAU) ${formatPct(k.stickiness_30d, 1)}`}
          />
          <Kpi
            label="Avg session length"
            value={`${num(k.avg_session_minutes).toFixed(1)} min`}
            status={toNumber(k.poor_matchmaking_rate) > POOR_MATCHMAKING_TARGET ? 'bad' : undefined}
            hint={`${formatPct(k.poor_matchmaking_rate, 1)} of sessions poorly matched`}
          />
          <Kpi
            label="Player reports"
            value={formatInt(k.report_count)}
            delta={<Delta cur={k.report_count} prev={k.prev_report_count} goodWhenUp={false} />}
            hint="Harassment, griefing, cheating and more"
          />
          <Kpi
            label="Suspected cheaters active"
            value={formatInt(k.suspected_cheaters)}
            hint={`${formatPct(k.cheater_session_share, 1)} of sessions include one`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader>
            <CardTitle>Revenue by month</CardTitle>
            <p className="text-xs text-muted-foreground">
              Gross vs net of chargebacks. Net for the most recent ~75 days will fall as late disputes arrive.
            </p>
          </CardHeader>
          <CardContent>
            <LineChart
              queryKey="revenue_trend"
              parameters={fullParams}
              xKey="month"
              yKey={['gross_revenue_usd', 'net_revenue_usd']}
              valueFormatter={usdAxis}
              height={280}
              ariaLabel="Monthly gross and net revenue"
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>What players report</CardTitle>
            <p className="text-xs text-muted-foreground">Abuse reports by category for the current filters.</p>
          </CardHeader>
          <CardContent>
            <DonutChart
              queryKey="reports_by_category"
              parameters={fullParams}
              xKey="report_category"
              yKey="reports"
              innerRadius={55}
              height={280}
              ariaLabel="Player reports by category"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader>
            <CardTitle>Player engagement by month</CardTitle>
            <p className="text-xs text-muted-foreground">Monthly active players and average daily active players.</p>
          </CardHeader>
          <CardContent>
            <LineChart
              queryKey="engagement_trend"
              parameters={fullParams}
              xKey="month"
              yKey={['mau', 'avg_dau']}
              height={280}
              ariaLabel="Monthly active and average daily active players"
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Revenue by game</CardTitle>
            <p className="text-xs text-muted-foreground">Click a bar to filter the page to that game.</p>
          </CardHeader>
          <CardContent>
            <BarChart
              queryKey="revenue_by_game"
              parameters={portfolioParams}
              xKey="game_title"
              yKey="gross_revenue_usd"
              orientation="horizontal"
              valueFormatter={usdAxis}
              selected={g || undefined}
              onDataClick={(d) => setGame(d.name === g ? 'all' : d.name)}
              height={280}
              ariaLabel="Gross revenue by game"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Game scorecard</CardTitle>
          <p className="text-xs text-muted-foreground">
            Money, trust and experience per title for {r || 'all regions'}, {period.phrase}. Red marks a signal past its target
            (chargebacks {formatPct(CHARGEBACK_TARGET, 1)}, poorly matched sessions {formatPct(POOR_MATCHMAKING_TARGET, 0)}).
          </p>
        </CardHeader>
        <CardContent>
          <QueryError error={scorecard.error} />
          {scorecard.loading && scRows.length === 0 && <Skeleton className="h-40 w-full" />}
          {scRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Game</th>
                    <th className="py-2 pr-3 font-medium text-right">Revenue</th>
                    <th className="py-2 pr-3 font-medium text-right">Active players</th>
                    <th className="py-2 pr-3 font-medium text-right">Chargeback rate</th>
                    <th className="py-2 pr-3 font-medium text-right">Chargeback loss</th>
                    <th className="py-2 pr-3 font-medium text-right">Reports</th>
                    <th className="py-2 pr-3 font-medium text-right">Avg session</th>
                    <th className="py-2 pr-3 font-medium text-right">Poorly matched</th>
                    <th className="py-2 font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {scRows.map((x) => {
                    const title = String(x.game_title);
                    const sig = gameSignal(x);
                    const cb = toNumber(x.chargeback_rate_closed);
                    const mm = toNumber(x.poor_matchmaking_rate);
                    return (
                      <tr key={title} className={`border-b ${title === g ? 'bg-muted' : ''}`}>
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="font-medium text-foreground hover:underline text-left"
                            onClick={() => setGame(title === g ? 'all' : title)}
                          >
                            {title}
                          </button>
                          <div className="text-xs text-muted-foreground">{String(x.genre ?? '')}</div>
                        </td>
                        <td className="py-2 pr-3 text-right">{formatUsd(x.gross_revenue_usd, true)}</td>
                        <td className="py-2 pr-3 text-right">{formatInt(x.active_players)}</td>
                        <td className={`py-2 pr-3 text-right ${cb > CHARGEBACK_TARGET ? 'text-destructive font-semibold' : ''}`}>
                          {Number.isNaN(cb) ? 'Pending' : formatPct(cb)}
                        </td>
                        <td className="py-2 pr-3 text-right">{formatUsd(x.chargeback_loss_usd, true)}</td>
                        <td className="py-2 pr-3 text-right">{formatInt(x.report_count)}</td>
                        <td className="py-2 pr-3 text-right">{num(x.avg_session_minutes).toFixed(0)} min</td>
                        <td className={`py-2 pr-3 text-right ${mm > POOR_MATCHMAKING_TARGET ? 'text-destructive font-semibold' : ''}`}>
                          {formatPct(mm, 1)}
                        </td>
                        <td className={`py-2 text-xs ${sig.bad ? 'text-destructive' : 'text-muted-foreground'}`}>{sig.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Action backlog: what to do next</CardTitle>
          <p className="text-xs text-muted-foreground">
            One recommended action per player as of {AS_OF_DATE}, highest-priority signal first, for {r || 'all regions'}.
            Player-level, so the game and period filters do not apply. "Still open" means no moderator decision yet.
          </p>
        </CardHeader>
        <CardContent>
          <QueryError error={backlog.error} />
          {backlog.loading && blRows.length === 0 && <Skeleton className="h-40 w-full" />}
          {blRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Action</th>
                    <th className="py-2 pr-3 font-medium text-right">Players</th>
                    <th className="py-2 pr-3 font-medium text-right">Still open</th>
                    <th className="py-2 pr-3 font-medium text-right">High-value</th>
                    <th className="py-2 pr-3 font-medium text-right">Spend involved</th>
                    <th className="py-2 pr-3 font-medium">Why and what to do</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {blRows.map((x) => {
                    const action = String(x.recommended_action);
                    const play = ACTION_PLAYBOOK[action];
                    return (
                      <tr key={action} className="border-b align-top">
                        <td className="py-2 pr-3">
                          <ActionBadge action={action} />
                        </td>
                        <td className="py-2 pr-3 text-right">{formatInt(x.players)}</td>
                        <td className="py-2 pr-3 text-right font-semibold">{formatInt(x.open_players)}</td>
                        <td className="py-2 pr-3 text-right">{formatInt(x.high_value_players)}</td>
                        <td className="py-2 pr-3 text-right">{formatUsd(x.lifetime_spend_usd, true)}</td>
                        <td className="py-2 pr-3 text-xs">
                          {play && (
                            <>
                              <div className="text-muted-foreground">{play.why}</div>
                              <div className="text-foreground mt-0.5">{play.doThis}</div>
                            </>
                          )}
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          <Link to={`/risk-queue?action=${encodeURIComponent(action)}`} className="text-primary font-medium hover:underline">
                            Work queue →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
