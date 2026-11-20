import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { ActionBadge, ACTION_PLAYBOOK, actionLabel } from '../../components/ActionBadge';
import { InsightPanel, type NextStep } from '../../components/InsightPanel';
import { formatDate, formatDateTime, formatInt, formatScore, formatUsd, toNumber, AS_OF_DATE } from '../../lib/format';
import { useJson, type WhoAmI } from '../../lib/useJson';

interface PlayerResponse {
  profile: Record<string, unknown>;
  actions: Array<{
    action_id: number;
    action_type: string;
    resolved_by: string | null;
    notes: string | null;
    created_at: string;
  }>;
}

type EventRow = Record<string, unknown>;

const MODERATION_BUTTONS: Array<{ type: 'warn' | 'mute' | 'suspend' | 'clear'; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = [
  { type: 'warn', label: 'Warn', variant: 'secondary' },
  { type: 'mute', label: 'Mute', variant: 'secondary' },
  { type: 'suspend', label: 'Suspend', variant: 'destructive' },
  { type: 'clear', label: 'Clear', variant: 'outline' },
];

/**
 * Plain-language reasons for a player's recommendation, using the same thresholds as the
 * recommended_action CASE in gold_mart_player_360.
 */
function reasonsFor(p: Record<string, unknown>): string[] {
  const out: string[] = [];
  const fraud = toNumber(p.fraud_risk_score);
  const tox = toNumber(p.toxicity_score);
  const churn = toNumber(p.churn_risk_score);
  if (fraud >= 0.651) out.push(`Fraud score ${formatScore(fraud)} is above the 0.651 action threshold.`);
  if (tox >= 0.5) out.push(`${Math.round(tox * 100)}% of sampled chat messages were labeled toxic (threshold 50%).`);
  else if (tox >= 0.3 && fraud >= 0.651) out.push(`${Math.round(tox * 100)}% toxic chat combined with high fraud risk.`);
  if (p.is_suspected_cheater === true) {
    out.push(
      `Shooter stats look like cheating over ${formatInt(p.shooter_sessions)} sessions: headshots ${formatInt(Math.round(toNumber(p.avg_headshot_pct)))}%, ` +
        `accuracy ${formatInt(Math.round(toNumber(p.avg_accuracy_pct)))}%, ${toNumber(p.kills_per_match).toFixed(1)} kills per match.`,
    );
  }
  if (p.is_at_risk === true) out.push(`Churn model flags this player as at-risk (score ${formatScore(churn)}).`);
  if (p.is_high_value_player === true) out.push(`High-value: ${formatUsd(p.lifetime_spend_usd)} lifetime spend and active in the last 14 days.`);
  if (toNumber(p.reports_received) > 0) out.push(`${formatInt(p.reports_received)} abuse reports filed against this player.`);
  if (out.length === 0) out.push('No risk signal above an action threshold.');
  return out;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

export function Player360Page() {
  const { playerId = '' } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const player = useJson<PlayerResponse>(`/api/players/${encodeURIComponent(playerId)}`, reloadKey);
  const me = useJson<WhoAmI>('/api/whoami');
  const events = useAnalyticsQuery('player_events', { player_id: sql.string(playerId) });
  const eventRows = (events.data ?? []) as unknown as EventRow[];
  const p = player.data?.profile;
  const rec = typeof p?.recommended_action === 'string' ? p.recommended_action : '';
  const play = ACTION_PLAYBOOK[rec];
  const lastDecision = player.data?.actions[0];
  const nextSteps: NextStep[] = [];
  if (lastDecision) {
    nextSteps.push({ label: `Already decided: ${lastDecision.action_type} by ${lastDecision.resolved_by ?? 'unknown'} on ${formatDateTime(lastDecision.created_at)}. Re-open only if new evidence arrives.` });
  } else if (play) {
    nextSteps.push({ label: play.doThis });
    nextSteps.push({ label: 'Record the decision below; it is written to Lakebase as you.' });
  } else {
    nextSteps.push({ label: 'No action needed now; the player stays under automated monitoring.' });
  }
  if (rec === 'suspend' || rec === 'review_fraud') {
    nextSteps.push({ label: 'Check whether this account shares a device with others.', to: '/fraud-rings', cta: 'Fraud Rings' });
  }

  const recordAction = async (type: string) => {
    setSubmitting(type);
    setActionError(null);
    setConfirmation(null);
    try {
      const res = await fetch(`/api/players/${encodeURIComponent(playerId)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: type, notes: notes.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? res.statusText);
      }
      const created = (await res.json()) as { action_id: number; resolved_by: string | null; created_at: string };
      const label = MODERATION_BUTTONS.find((b) => b.type === type)?.label ?? type;
      const at = new Date(created.created_at).toLocaleTimeString();
      setConfirmation(
        `${label} recorded for ${playerId} by ${created.resolved_by ?? 'you'} at ${at} (action #${created.action_id}).`,
      );
      setNotes('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to record action');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/risk-queue" className="text-sm text-muted-foreground hover:text-foreground">
          ← Risk Queue
        </Link>
        <h2 className="text-2xl font-bold text-foreground font-mono">{playerId}</h2>
        {p && <ActionBadge action={p.recommended_action} />}
        {p?.is_high_value_player === true && <Badge variant="secondary">High-value</Badge>}
        {p?.is_at_risk === true && <Badge variant="destructive">At-risk</Badge>}
        {p?.is_suspected_cheater === true && <Badge variant="destructive">Suspected cheater</Badge>}
        {p?.account_status === 'closed' && <Badge variant="outline">Account closed</Badge>}
      </div>

      {p && (
        <InsightPanel
          tone={rec === 'suspend' || rec === 'review_fraud' ? 'alert' : 'default'}
          what={
            <>
              Recommended: <b>{rec ? actionLabel(rec) : 'No action'}</b> · composite risk <b>{formatScore(p.composite_risk)}</b>.
              {play && <> Rule: {play.rule}.</>}
            </>
          }
          why={
            <ul className="list-disc pl-4 space-y-0.5">
              {reasonsFor(p).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          }
          how="Scores and signals from gold_mart_player_360, synced to Lakebase. Moderation history below is read live from Lakebase."
          next={nextSteps}
        />
      )}

      {player.error && <div className="text-destructive bg-destructive/10 p-3 rounded-md">Error: {player.error}</div>}
      {player.loading && !p && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={`kpi-${i}`} className="h-20 w-full" />
          ))}
        </div>
      )}

      {p && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Kpi label="Composite risk" value={formatScore(p.composite_risk)} />
          <Kpi label="Fraud score" value={formatScore(p.fraud_risk_score)} />
          <Kpi label="Churn score" value={formatScore(p.churn_risk_score)} />
          <Kpi label="Toxicity score" value={formatScore(p.toxicity_score)} />
          <Kpi label="Lifetime spend" value={formatUsd(p.lifetime_spend_usd)} />
          <Kpi label="Reports received" value={formatInt(p.reports_received)} />
        </div>
      )}
      {p && (
        <p className="text-xs text-muted-foreground">
          Last active {formatDate(p.last_active_date)} · {formatInt(p.sessions_30d)} sessions in the 30 days before{' '}
          {AS_OF_DATE} · profile served from Lakebase.
        </p>
      )}

      {p && (
        <Card>
          <CardHeader>
            <CardTitle>Moderation action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Recorded to Lakebase as{' '}
              <span className="font-medium text-foreground">{me.data?.email ?? me.data?.user ?? 'the signed-in user'}</span>.
            </p>
            <Input
              placeholder="Optional note (max 500 characters)"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting !== null}
            />
            <div className="flex flex-wrap gap-2">
              {MODERATION_BUTTONS.map((b) => (
                <Button
                  key={b.type}
                  variant={b.variant}
                  disabled={submitting !== null}
                  onClick={() => recordAction(b.type)}
                >
                  {submitting === b.type ? 'Recording…' : b.label}
                </Button>
              ))}
            </div>
            {confirmation && (
              <div role="status" className="border border-primary/40 bg-primary/10 text-foreground p-3 rounded-md text-sm">
                {confirmation}
              </div>
            )}
            {actionError && <div className="text-destructive bg-destructive/10 p-3 rounded-md">{actionError}</div>}
            {player.data && player.data.actions.length > 0 && (
              <p className="text-xs font-medium text-muted-foreground pt-1">
                Moderation history ({player.data.actions.length} most recent)
              </p>
            )}
            {player.data && player.data.actions.length > 0 ? (
              <ul className="text-sm divide-y border rounded-md">
                {player.data.actions.map((a) => (
                  <li key={a.action_id} className="p-2 flex flex-wrap gap-3">
                    <span className="font-medium capitalize">{a.action_type}</span>
                    <span className="text-muted-foreground">{a.resolved_by ?? 'unknown'}</span>
                    <span className="text-muted-foreground">{formatDateTime(a.created_at)}</span>
                    {a.notes && <span className="text-foreground">{a.notes}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No moderation actions recorded for this player yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent purchases and reports</CardTitle>
        </CardHeader>
        <CardContent>
          {events.loading && <Skeleton className="h-32 w-full" />}
          {events.error && <div className="text-destructive bg-destructive/10 p-3 rounded-md">Error: {events.error}</div>}
          {!events.loading && !events.error && eventRows.length === 0 && (
            <p className="text-muted-foreground text-center py-6">No purchase or report events for this player.</p>
          )}
          {eventRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Game</th>
                    <th className="py-2 pr-4 font-medium text-right">Amount</th>
                    <th className="py-2 font-medium">Chargeback / report</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRows.map((e) => (
                    <tr key={String(e.event_id)} className="border-b">
                      <td className="py-2 pr-4">{formatDate(e.event_date)}</td>
                      <td className="py-2 pr-4">{String(e.event_type ?? '')}</td>
                      <td className="py-2 pr-4">{String(e.game_title ?? '—')}</td>
                      <td className="py-2 pr-4 text-right">{formatUsd(e.amount_usd)}</td>
                      <td className="py-2">
                        {e.has_chargeback === true && <Badge variant="destructive">{String(e.chargeback_reason ?? 'Chargeback')}</Badge>}
                        {e.report_category ? <Badge variant="secondary">{String(e.report_category)}</Badge> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
