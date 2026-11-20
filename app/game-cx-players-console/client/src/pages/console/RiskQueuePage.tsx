import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { ActionBadge, ACTION_FILTER_OPTIONS, ACTION_PLAYBOOK, actionLabel } from '../../components/ActionBadge';
import { InsightPanel } from '../../components/InsightPanel';
import { formatInt, formatScore, formatUsd, AS_OF_DATE } from '../../lib/format';
import { useJson } from '../../lib/useJson';

const PAGE_SIZE = 25;

interface QueueRow {
  player_id: string;
  recommended_action: string | null;
  fraud_risk_score: number | string | null;
  churn_risk_score: number | string | null;
  toxicity_score: number | string | null;
  lifetime_spend_usd: number | string | null;
  reports_received: number | string | null;
  composite_risk: number | string;
}

interface QueueResponse {
  page: number;
  pageSize: number;
  total: number;
  rows: QueueRow[];
}

interface SummaryResponse {
  total: number;
  counts: Record<string, number>;
}

export function RiskQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('action') ?? '';
  const action = ACTION_FILTER_OPTIONS.some((o) => o.value === requested) ? requested : '';
  const setAction = (value: string) => setSearchParams(value ? { action: value } : {}, { replace: true });
  const [page, setPage] = useState(1);
  const [lookup, setLookup] = useState('');
  const play = ACTION_PLAYBOOK[action];

  const summary = useJson<SummaryResponse>('/api/risk-queue/summary');
  const countFor = (value: string): number | undefined =>
    value === '' ? summary.data?.total : summary.data?.counts[value];

  const { data, loading, error } = useJson<QueueResponse>(
    `/api/risk-queue?page=${page}&pageSize=${PAGE_SIZE}&action=${encodeURIComponent(action)}`,
  );
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const openLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const id = lookup.trim().toUpperCase();
    if (id) navigate(`/player/${encodeURIComponent(id)}`);
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Risk Queue</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Players ranked by composite risk (0.4 fraud + 0.4 churn + 0.2 toxicity), served from Lakebase.
          Scores as of {AS_OF_DATE}.
        </p>
      </div>

      <InsightPanel
        tone={action === 'suspend' || action === 'review_fraud' ? 'alert' : 'default'}
        what={
          play ? (
            <>
              <b>{formatInt(countFor(action))}</b> players are recommended for <b>{actionLabel(action)}</b>. Rule: {play.rule}.
            </>
          ) : (
            <>
              <b>{formatInt(summary.data ? summary.data.total - (summary.data.counts[''] ?? 0) : undefined)}</b> of{' '}
              {formatInt(summary.data?.total)} players have a recommended action. The riskiest are at the top.
            </>
          )
        }
        why={play ? play.why : 'Each player gets one action: the highest-priority signal wins (suspend, then fraud, toxicity, cheating, retention).'}
        how="Fraud (transaction model), churn (player model) and toxicity (LLM chat labels) scores, synced from the lakehouse to Lakebase. Composite = 0.4 fraud + 0.4 churn + 0.2 toxicity."
        next={
          play
            ? [
                { label: play.doThis },
                { label: 'Open a player to see the evidence and record a decision.' },
                { label: 'Decisions flow back to the lakehouse and close the recommendation.' },
              ]
            : [
                { label: 'Start with Suspend: fraud plus toxicity, highest harm.' },
                { label: 'Then Review fraud and Review cheating.' },
                { label: 'Hand Retain players to the live-ops team for offers.' },
              ]
        }
      />

      <Card>
        <CardContent className="pt-6 flex flex-col lg:flex-row gap-4 lg:items-center">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by recommended action">
            {ACTION_FILTER_OPTIONS.map((o) => {
              const n = countFor(o.value);
              const active = o.value === action;
              return (
                <Button
                  key={o.value || 'all'}
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  aria-pressed={active}
                  onClick={() => {
                    setAction(o.value);
                    setPage(1);
                  }}
                >
                  {o.label}
                  {n !== undefined && <span className="ml-1.5 opacity-70">{formatInt(n)}</span>}
                </Button>
              );
            })}
          </div>
          <form onSubmit={openLookup} className="flex gap-2 lg:ml-auto">
            <Input
              placeholder="Player ID, e.g. P049945"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              className="md:w-64"
            />
            <Button type="submit" disabled={!lookup.trim()}>
              Open Player 360
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {action ? `Recommended action: ${actionLabel(action)}` : 'All players'}
            {data && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {formatInt(data.total)} players · ranked by composite risk
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive bg-destructive/10 p-3 rounded-md">Error: {error}</div>}
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={`sk-${i}`} className="h-8 w-full" />
              ))}
            </div>
          )}
          {data && data.rows.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No players match this filter.</p>
          )}
          {data && data.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Player ID</th>
                    <th className="py-2 pr-4 font-medium">Recommended action</th>
                    <th className="py-2 pr-4 font-medium text-right">Composite</th>
                    <th className="py-2 pr-4 font-medium text-right">Fraud</th>
                    <th className="py-2 pr-4 font-medium text-right">Churn</th>
                    <th className="py-2 pr-4 font-medium text-right">Toxicity</th>
                    <th className="py-2 pr-4 font-medium text-right">Lifetime spend</th>
                    <th className="py-2 font-medium text-right">Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr
                      key={r.player_id}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/player/${r.player_id}`)}
                    >
                      <td className="py-2 pr-4 font-mono">{r.player_id}</td>
                      <td className="py-2 pr-4">
                        <ActionBadge action={r.recommended_action} />
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold">{formatScore(r.composite_risk)}</td>
                      <td className="py-2 pr-4 text-right">{formatScore(r.fraud_risk_score)}</td>
                      <td className="py-2 pr-4 text-right">{formatScore(r.churn_risk_score)}</td>
                      <td className="py-2 pr-4 text-right">{formatScore(r.toxicity_score)}</td>
                      <td className="py-2 pr-4 text-right">{formatUsd(r.lifetime_spend_usd)}</td>
                      <td className="py-2 text-right">{formatInt(r.reports_received)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-muted-foreground">
              Page {page} of {formatInt(totalPages)}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
