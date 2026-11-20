import { Badge } from '@databricks/appkit-ui/react';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

// Semantic mapping of gold_mart_player_360.recommended_action values to badge variants.
const ACTION_STYLE: Record<string, { label: string; variant: BadgeVariant }> = {
  suspend: { label: 'Suspend', variant: 'destructive' },
  review_fraud: { label: 'Review fraud', variant: 'destructive' },
  warn_toxicity: { label: 'Warn toxicity', variant: 'default' },
  review_cheating: { label: 'Review cheating', variant: 'default' },
  monitor: { label: 'Monitor', variant: 'secondary' },
  retain: { label: 'Retain', variant: 'outline' },
};

export function ActionBadge({ action }: { action: unknown }) {
  const key = typeof action === 'string' ? action : '';
  const style = ACTION_STYLE[key];
  if (!style) return <Badge variant="outline">No action</Badge>;
  return <Badge variant={style.variant}>{style.label}</Badge>;
}

// Filter chips for the Risk Queue. value '' = all players.
export const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All players' },
  { value: 'suspend', label: 'Suspend' },
  { value: 'review_fraud', label: 'Review fraud' },
  { value: 'warn_toxicity', label: 'Warn toxicity' },
  { value: 'review_cheating', label: 'Review cheating' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'retain', label: 'Retain' },
];

/**
 * Prescriptive playbook per recommended_action, mirroring the priority CASE in gold_mart_player_360
 * (highest-priority signal wins: suspend > review_fraud > warn_toxicity > review_cheating > retain > monitor).
 */
export const ACTION_PLAYBOOK: Record<string, { rule: string; why: string; doThis: string }> = {
  suspend: {
    rule: 'Fraud score ≥ 0.651 and toxicity ≥ 0.3',
    why: 'Likely fraudster who is also abusing other players: chargeback loss plus community harm.',
    doThis: 'Suspend the account, then check Fraud Rings for linked accounts on the same device.',
  },
  review_fraud: {
    rule: 'Fraud score ≥ 0.651',
    why: 'High chargeback risk; most of these players are high-value, so a false positive is costly.',
    doThis: 'Review recent purchases in Player 360; suspend if confirmed, clear if legitimate.',
  },
  warn_toxicity: {
    rule: 'Toxicity ≥ 0.5 of sampled chat messages',
    why: 'Toxic chat drives reports and pushes other players to churn.',
    doThis: 'Warn first; mute on repeat. Escalate to suspend if reports keep arriving.',
  },
  review_cheating: {
    rule: 'Shooter titles, ≥ 3 sessions, 2 of: headshot ≥ 40%, accuracy ≥ 45%, kills/match ≥ 9',
    why: 'Cheaters ruin match fairness in Iron Vanguard and Starfall Legends.',
    doThis: 'Review match stats in Player 360; suspend confirmed cheaters, clear false positives.',
  },
  retain: {
    rule: 'Churn at-risk, lifetime spend > $50, active in the last 14 days',
    why: 'High-value players about to leave: the cheapest revenue to protect.',
    doThis: 'Send a retention offer or live-ops invite before they lapse.',
  },
  monitor: {
    rule: 'Churn at-risk, not high-value',
    why: 'Early churn signal on lower-spend players.',
    doThis: 'Include in the next live-ops re-engagement campaign; no moderator action needed.',
  },
};

export const actionLabel = (action: string): string =>
  ACTION_FILTER_OPTIONS.find((o) => o.value === action)?.label ?? action;
