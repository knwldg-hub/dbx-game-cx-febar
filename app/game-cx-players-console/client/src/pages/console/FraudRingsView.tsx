import { useState } from 'react';
import { Link } from 'react-router';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { ActionBadge } from '../../components/ActionBadge';
import { InsightPanel } from '../../components/InsightPanel';
import { formatInt, formatPct, formatScore, formatUsd, toNumber } from '../../lib/format';

type Row = Record<string, unknown>;

const shortFingerprint = (fp: string): string => (fp.length > 14 ? `${fp.slice(0, 8)}…${fp.slice(-4)}` : fp);

const sumOf = (rows: Row[], col: string): number => rows.reduce((acc, r) => acc + (toNumber(r[col]) || 0), 0);

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

/**
 * Fraud Rings as a story: (1) the headline takeaway across all rings, (2) rings ranked by money lost,
 * (3) the selected ring explained in one sentence, its member devices, and a ring-wide action.
 */
export function FraudRingsPage() {
  const [selected, setSelected] = useState('');
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const rings = useAnalyticsQuery('fraud_rings', {});
  const ringRows = (rings.data ?? []) as unknown as Row[];
  const visibleRings = onlyMissed ? ringRows.filter((r) => toNumber(r.missed_by_model) > 0) : ringRows;
  const activeFp = selected || String(visibleRings[0]?.device_fingerprint ?? '');
  const activeRing = ringRows.find((r) => String(r.device_fingerprint) === activeFp);

  // Always called (hooks rule); an empty fingerprint matches no rows.
  const members = useAnalyticsQuery('ring_members', { fingerprint: sql.string(activeFp) });
  const memberRows = (members.data ?? []) as unknown as Row[];
  const memberIds = Array.from(new Set(memberRows.map((m) => String(m.player_id))));

  // Headline totals. Safe to sum: no account belongs to more than one ring.
  const totalRings = ringRows.length;
  const totalAccounts = sumOf(ringRows, 'ring_size');
  const totalSpend = sumOf(ringRows, 'ring_spend_usd');
  const totalChargebackUsd = sumOf(ringRows, 'chargeback_usd');
  const totalChargebacks = sumOf(ringRows, 'chargebacks');
  const totalMissed = sumOf(ringRows, 'missed_by_model');
  const ringsWithMissed = ringRows.filter((r) => toNumber(r.missed_by_model) > 0).length;

  const suspendRing = async () => {
    setBusy(true);
    setBulkError(null);
    setBulkMessage(null);
    try {
      const res = await fetch('/api/rings/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_ids: memberIds,
          action_type: 'suspend',
          notes: `Ring-wide suspend: shared device ${activeFp}`,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? res.statusText);
      }
      const out = (await res.json()) as { recorded: number; actions: Array<{ resolved_by: string | null }> };
      setBulkMessage(
        `Suspend recorded for ${out.recorded} account${out.recorded === 1 ? '' : 's'} on ring ${shortFingerprint(activeFp)}` +
          ` by ${out.actions[0]?.resolved_by ?? 'you'}. Each account's Player 360 history now shows it.`,
      );
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Failed to record ring action');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Fraud Rings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A ring is 2+ accounts sharing one device fingerprint where at least one device is an emulator: one operator
          running many accounts.
        </p>
      </div>

      {rings.error && <div className="text-destructive bg-destructive/10 p-3 rounded-md">Error: {rings.error}</div>}
      {rings.loading && <Skeleton className="h-32 w-full" />}

      {totalRings > 0 && (
        <>
          <InsightPanel
            tone="alert"
            what={
              <>
                <b>{formatInt(totalRings)} device rings</b> link <b>{formatInt(totalAccounts)} accounts</b> that charged back{' '}
                <b>{formatUsd(totalChargebackUsd, true)}</b> across {formatInt(totalChargebacks)} disputes.
              </>
            }
            why={
              <>
                That is <b>{formatPct(totalSpend > 0 ? totalChargebackUsd / totalSpend : NaN, 0)}</b> of the{' '}
                {formatUsd(totalSpend, true)} these accounts spent. One operator behind many accounts keeps coming back unless
                every account is closed together.
              </>
            }
            how={
              <>
                Accounts sharing one device fingerprint with at least one emulator. The per-player model already flags{' '}
                {formatInt(totalAccounts - totalMissed)} of them; the shared-device signal adds <b>{formatInt(totalMissed)} more</b> in{' '}
                {formatInt(ringsWithMissed)} rings whose individual scores sit below the threshold.
              </>
            }
            next={[
              { label: 'Filter to "Missed by model" to see the accounts only the ring signal catches.' },
              { label: 'Pick a ring, check its devices, then suspend the whole ring in one click.' },
              { label: 'Open any member in Player 360 to confirm the evidence first.' },
            ]}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Rings detected" value={formatInt(totalRings)} />
            <Kpi label="Accounts in rings" value={formatInt(totalAccounts)} />
            <Kpi label="Chargeback loss" value={formatUsd(totalChargebackUsd, true)} hint={`${formatInt(totalChargebacks)} disputes`} />
            <Kpi label="Missed by per-player model" value={formatInt(totalMissed)} hint={`in ${formatInt(ringsWithMissed)} rings`} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="space-y-3">
            <CardTitle>Rings by chargeback loss</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant={onlyMissed ? 'outline' : 'default'} onClick={() => { setOnlyMissed(false); setSelected(''); }}>
                All {formatInt(totalRings)}
              </Button>
              <Button size="sm" variant={onlyMissed ? 'default' : 'outline'} onClick={() => { setOnlyMissed(true); setSelected(''); }}>
                Missed by model {formatInt(ringsWithMissed)}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {visibleRings.length > 0 && (
              <div className="max-h-[620px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Device</th>
                      <th className="py-2 pr-3 font-medium text-right">Accounts</th>
                      <th className="py-2 pr-3 font-medium text-right">Avg fraud</th>
                      <th className="py-2 font-medium text-right">Charged back</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRings.map((r) => {
                      const fp = String(r.device_fingerprint);
                      const active = fp === activeFp;
                      const missed = toNumber(r.missed_by_model);
                      return (
                        <tr
                          key={fp}
                          onClick={() => {
                            setSelected(fp);
                            setBulkMessage(null);
                            setBulkError(null);
                          }}
                          className={`border-b cursor-pointer ${active ? 'bg-muted' : 'hover:bg-muted/50'}`}
                        >
                          <td className="py-2 pr-3">
                            <div className="font-mono text-xs">{shortFingerprint(fp)}</div>
                            <div className="text-xs text-muted-foreground">
                              {String(r.platforms ?? '')}
                              {missed > 0 && (
                                <Badge variant="destructive" className="ml-2">
                                  {formatInt(missed)} missed
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {formatInt(r.ring_size)}
                            <div className="text-xs text-muted-foreground">{formatInt(r.emulator_devices)} emulated</div>
                          </td>
                          <td className="py-2 pr-3 text-right">{formatScore(r.avg_fraud_score)}</td>
                          <td className="py-2 text-right font-semibold">{formatUsd(r.chargeback_usd)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{activeRing ? `Ring ${shortFingerprint(activeFp)}` : 'Ring detail'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeRing && !rings.loading && <p className="text-muted-foreground text-center py-8">Select a ring.</p>}
            {activeRing && (
              <p className="text-sm text-foreground">
                <span className="font-semibold">{formatInt(activeRing.ring_size)} accounts</span> share this device
                fingerprint. {formatInt(activeRing.emulator_devices)} of their devices are emulators; platforms seen:{' '}
                {String(activeRing.platforms ?? '')}. Together they spent {formatUsd(activeRing.ring_spend_usd)} and
                charged back <span className="font-semibold">{formatUsd(activeRing.chargeback_usd)}</span> across{' '}
                {formatInt(activeRing.chargebacks)} disputes. Average fraud score {formatScore(activeRing.avg_fraud_score)}.
                {toNumber(activeRing.missed_by_model) > 0 && (
                  <span className="text-destructive font-medium">
                    {' '}
                    {formatInt(activeRing.missed_by_model)} of these accounts were not flagged for fraud by the per-player
                    model. The shared device is the only signal.
                  </span>
                )}
              </p>
            )}

            {activeRing && members.loading && <Skeleton className="h-40 w-full" />}
            {activeRing && members.error && (
              <div className="text-destructive bg-destructive/10 p-3 rounded-md">Error: {members.error}</div>
            )}
            {activeRing && memberRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Account</th>
                      <th className="py-2 pr-3 font-medium">Device</th>
                      <th className="py-2 pr-3 font-medium text-right">Fraud</th>
                      <th className="py-2 pr-3 font-medium text-right">Spend</th>
                      <th className="py-2 pr-3 font-medium text-right">Charged back</th>
                      <th className="py-2 font-medium">Model says</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberRows.map((m) => (
                      <tr key={String(m.device_id)} className="border-b">
                        <td className="py-2 pr-3">
                          <Link
                            to={`/player/${String(m.player_id)}`}
                            className="font-mono text-primary underline-offset-4 hover:underline"
                          >
                            {String(m.player_id)}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          <div>{String(m.device_model ?? '—')}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-xs text-muted-foreground">{String(m.platform ?? '')}</span>
                            {m.is_emulator === true && <Badge variant="destructive">Emulator</Badge>}
                            {m.is_rooted_or_jailbroken === true && <Badge variant="secondary">Rooted</Badge>}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right">{formatScore(m.fraud_risk_score)}</td>
                        <td className="py-2 pr-3 text-right">{formatUsd(m.lifetime_spend_usd)}</td>
                        <td className="py-2 pr-3 text-right">
                          {formatUsd(m.chargeback_usd)}
                          <div className="text-xs text-muted-foreground">{formatInt(m.chargebacks)} disputes</div>
                        </td>
                        <td className="py-2">
                          <ActionBadge action={m.recommended_action} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeRing && memberIds.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="destructive" disabled={busy} onClick={suspendRing}>
                    {busy ? 'Recording…' : `Suspend all ${memberIds.length} accounts in this ring`}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Records one moderation action per account in Lakebase, attributed to you.
                  </span>
                </div>
                {bulkMessage && (
                  <div role="status" className="border border-primary/40 bg-primary/10 text-foreground p-3 rounded-md text-sm">
                    {bulkMessage}
                  </div>
                )}
                {bulkError && <div className="text-destructive bg-destructive/10 p-3 rounded-md">{bulkError}</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
