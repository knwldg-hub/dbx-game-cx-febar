// Trust & Safety console routes backed by Lakebase (Postgres).
// Reads: game_cx_players.lb_serve_player_risk_profile (synced from gold_mart_player_360, read-only).
// Writes: game_cx_players.lb_moderation_actions (OLTP write-back table).
// The app service principal needs USAGE on schema game_cx_players, SELECT on both tables,
// INSERT on lb_moderation_actions and USAGE on its action_id sequence.

import { z } from 'zod';
import type { Application, Request } from 'express';

interface AppKitWithLakebase {
  lakebase: {
    query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

const PROFILE_TABLE = 'game_cx_players.lb_serve_player_risk_profile';
const ACTIONS_TABLE = 'game_cx_players.lb_moderation_actions';

// Composite risk used by the Risk Queue (PLAN: 0.4 fraud + 0.4 churn + 0.2 toxicity).
const COMPOSITE_RISK_SQL = `ROUND((0.4 * COALESCE(fraud_risk_score, 0)
  + 0.4 * COALESCE(churn_risk_score, 0)
  + 0.2 * COALESCE(toxicity_score, 0))::numeric, 3)`;

const RECOMMENDED_ACTIONS = ['', 'suspend', 'review_fraud', 'warn_toxicity', 'review_cheating', 'monitor', 'retain'] as const;
const MODERATION_ACTIONS = ['warn', 'mute', 'suspend', 'clear'] as const;

const QueueQuery = z.object({
  page: z.coerce.number().int().min(1).max(2000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  action: z.enum(RECOMMENDED_ACTIONS).default(''),
});

const PlayerIdParam = z.string().regex(/^P\d{6}$/);

const ActionBody = z.object({
  action_type: z.enum(MODERATION_ACTIONS),
  notes: z.string().trim().max(500).optional(),
});

// Ring-wide action: every account on one shared device fingerprint (largest ring is 4 accounts).
const BulkActionBody = z.object({
  player_ids: z.array(PlayerIdParam).min(1).max(20),
  action_type: z.enum(MODERATION_ACTIONS),
  notes: z.string().trim().max(500).optional(),
});

/** Return the signed-in caller from the Databricks Apps proxy headers. */
function callerIdentity(req: Request): { email: string | null; user: string | null } {
  return {
    email: req.header('x-forwarded-email') ?? null,
    user: req.header('x-forwarded-user') ?? null,
  };
}

export function setupConsoleRoutes(appkit: AppKitWithLakebase) {
  appkit.server.extend((app) => {
    // Moderation data changes on every click: never let the browser reuse a cached API response.
    app.use('/api', (_req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });

    app.get('/api/whoami', (req, res) => {
      res.json(callerIdentity(req));
    });

    app.get('/api/risk-queue', async (req, res) => {
      const parsed = QueueQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid page, pageSize, or action filter' });
        return;
      }
      const { page, pageSize, action } = parsed.data;
      try {
        const { rows } = await appkit.lakebase.query(
          `SELECT player_id, recommended_action, fraud_risk_score, churn_risk_score, toxicity_score,
                  lifetime_spend_usd, reports_received, is_high_value_player,
                  ${COMPOSITE_RISK_SQL} AS composite_risk,
                  COUNT(*) OVER () AS total_rows
           FROM ${PROFILE_TABLE}
           WHERE ($1::text = '' OR recommended_action = $1::text)
           ORDER BY composite_risk DESC, player_id
           LIMIT $2 OFFSET $3`,
          [action, pageSize, (page - 1) * pageSize],
        );
        const total = rows.length > 0 ? Number(rows[0].total_rows) : 0;
        res.json({ page, pageSize, total, rows });
      } catch (err) {
        console.error('[console] risk queue failed:', err);
        res.status(500).json({ error: 'Failed to load risk queue' });
      }
    });

    // Per-action counts for the Risk Queue filter chips (one GROUP BY over 50K rows, ~10ms).
    app.get('/api/risk-queue/summary', async (_req, res) => {
      try {
        const { rows } = await appkit.lakebase.query(
          `SELECT COALESCE(recommended_action, '') AS action, COUNT(*) AS players
           FROM ${PROFILE_TABLE}
           GROUP BY 1`,
        );
        const counts: Record<string, number> = {};
        let total = 0;
        for (const r of rows) {
          const n = Number(r.players);
          counts[String(r.action)] = n;
          total += n;
        }
        res.json({ total, counts });
      } catch (err) {
        console.error('[console] risk queue summary failed:', err);
        res.status(500).json({ error: 'Failed to load action counts' });
      }
    });

    app.post('/api/rings/actions', async (req, res) => {
      const body = BulkActionBody.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({ error: 'Invalid player IDs or action' });
        return;
      }
      const who = callerIdentity(req);
      const resolvedBy = who.email ?? who.user ?? 'unknown';
      const notes = body.data.notes ?? 'Ring-wide action from Fraud Rings view';
      try {
        // Insert only IDs that exist in the served risk profile; one statement, one round-trip.
        const { rows } = await appkit.lakebase.query(
          `INSERT INTO ${ACTIONS_TABLE} (player_id, action_type, resolved_by, notes, resolved_at)
           SELECT p.player_id, $2, $3, $4, NOW()
           FROM ${PROFILE_TABLE} p
           WHERE p.player_id = ANY($1::text[])
           RETURNING action_id, player_id, action_type, resolved_by, created_at`,
          [Array.from(new Set(body.data.player_ids)), body.data.action_type, resolvedBy, notes],
        );
        res.status(201).json({ recorded: rows.length, actions: rows });
      } catch (err) {
        console.error('[console] ring action write failed:', err);
        res.status(500).json({ error: 'Failed to record ring action' });
      }
    });

    app.get('/api/players/:playerId', async (req, res) => {
      const id = PlayerIdParam.safeParse(req.params.playerId);
      if (!id.success) {
        res.status(400).json({ error: 'Player ID must look like P012345' });
        return;
      }
      try {
        const profile = await appkit.lakebase.query(
          `SELECT *, ${COMPOSITE_RISK_SQL} AS composite_risk FROM ${PROFILE_TABLE} WHERE player_id = $1`,
          [id.data],
        );
        if (profile.rows.length === 0) {
          res.status(404).json({ error: `Player ${id.data} not found` });
          return;
        }
        const actions = await appkit.lakebase.query(
          `SELECT action_id, action_type, resolved_by, notes, created_at
           FROM ${ACTIONS_TABLE} WHERE player_id = $1 ORDER BY created_at DESC LIMIT 20`,
          [id.data],
        );
        res.json({ profile: profile.rows[0], actions: actions.rows });
      } catch (err) {
        console.error('[console] player lookup failed:', err);
        res.status(500).json({ error: 'Failed to load player' });
      }
    });

    app.post('/api/players/:playerId/actions', async (req, res) => {
      const id = PlayerIdParam.safeParse(req.params.playerId);
      const body = ActionBody.safeParse(req.body);
      if (!id.success || !body.success) {
        res.status(400).json({ error: 'Invalid player ID or action' });
        return;
      }
      const who = callerIdentity(req);
      const resolvedBy = who.email ?? who.user ?? 'unknown';
      try {
        const exists = await appkit.lakebase.query(`SELECT 1 FROM ${PROFILE_TABLE} WHERE player_id = $1`, [id.data]);
        if (exists.rows.length === 0) {
          res.status(404).json({ error: `Player ${id.data} not found` });
          return;
        }
        const { rows } = await appkit.lakebase.query(
          `INSERT INTO ${ACTIONS_TABLE} (player_id, action_type, resolved_by, notes, resolved_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING action_id, action_type, resolved_by, notes, created_at`,
          [id.data, body.data.action_type, resolvedBy, body.data.notes ?? null],
        );
        res.status(201).json(rows[0]);
      } catch (err) {
        console.error('[console] moderation write failed:', err);
        res.status(500).json({ error: 'Failed to record moderation action' });
      }
    });
  });
}
