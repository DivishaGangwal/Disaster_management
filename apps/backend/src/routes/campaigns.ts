/**
 * CAMPAIGN ROUTES  (Planned — Workstream E/F)
 *
 * Spec: API-SCHEMA.md "Planned endpoints — /campaigns/*"
 *
 * Campaign state machine (WEB-006, DEC-025):
 *   draft → validated → approved → archived
 *             ↑
 *   content edited → back to draft (contentEdited rule)
 *
 * POST /campaigns/:id/approve returns 400 if content_hash changed since
 * validation (WEB-007). An over-budget campaign is REPORTED — never silently
 * truncated (WEB-005).
 */

import { Hono } from 'hono';
import { randomBytes } from 'node:crypto';
import type { SqliteBackendStore } from '../store.js';
import type { OutboundService } from '../services.js';

type CampaignState = 'draft' | 'validated' | 'approved' | 'archived';

interface CampaignRow {
  campaign_id: string;
  region_code: string;
  state: CampaignState;
  content_hash: string;
  manifest_json: string;
  created_at_ms: number;
  validated_at_ms: number | null;
  approved_at_ms: number | null;
  validated_hash: string | null;
}

export function campaignRoutes(store: SqliteBackendStore, _outbound: OutboundService) {
  const app = new Hono();
  const db = (store as unknown as { db: import('better-sqlite3').Database }).db;

  // POST /campaigns — create a new campaign in draft state
  app.post('/', async (c) => {
    const body = await c.req.json<{
      regionCode?: string;
      manifestJson?: string;
      contentHash?: string;
    }>();

    const regionCode = String(body.regionCode ?? '').trim();
    const manifestJson = String(body.manifestJson ?? '').trim();
    const contentHash = String(body.contentHash ?? '').trim();

    if (!regionCode || regionCode.length > 32) return c.json({ error: 'invalid regionCode' }, 400);
    if (!manifestJson) return c.json({ error: 'manifestJson required' }, 400);
    if (!contentHash) return c.json({ error: 'contentHash required' }, 400);

    // Validate JSON
    try { JSON.parse(manifestJson); } catch {
      return c.json({ error: 'manifestJson must be valid JSON' }, 400);
    }

    const campaignId = `CMP-${randomBytes(4).toString('hex').toUpperCase()}`;
    const nowMs = Date.now();

    db.prepare(`
      INSERT INTO campaigns (campaign_id, region_code, state, content_hash, manifest_json, created_at_ms)
      VALUES (?, ?, 'draft', ?, ?, ?)
    `).run(campaignId, regionCode, contentHash, manifestJson, nowMs);

    return c.json({ campaignId, state: 'draft', createdAtMs: nowMs });
  });

  // GET /campaigns/:id/preview — byte and duration preview (WEB-005)
  app.get('/:id/preview', (c) => {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE campaign_id = ?').get(c.req.param('id')) as CampaignRow | undefined;
    if (!campaign) return c.json({ error: 'unknown campaign' }, 404);

    const manifest = JSON.parse(campaign.manifest_json) as {
      items?: { packetId: string; tier1Bytes: number; tier2Bytes: number; repeats: number }[];
      budgetS?: number;
    };

    const items = manifest.items ?? [];
    const totalTier2Bytes = items.reduce((sum, i) => sum + (i.tier2Bytes ?? 0) * (i.repeats ?? 1), 0);
    // Rough estimate: 48_000 samples/s, 12 bytes/frame ≈ 0.0025 s/byte at 48 kHz
    const totalDurationS = Math.ceil(totalTier2Bytes * 0.003);
    const budgetS = manifest.budgetS ?? 180;
    const overBudget = totalDurationS > budgetS;

    // An over-budget campaign is REPORTED — never silently truncated (WEB-005)
    return c.json({
      campaignId: campaign.campaign_id,
      state: campaign.state,
      totalTier2Bytes,
      totalDurationS,
      budgetS,
      overBudget,
      items: items.map((item) => ({
        packetId: item.packetId,
        tier2Bytes: item.tier2Bytes,
        repeats: item.repeats,
        estimatedAudioMs: Math.ceil(item.tier2Bytes * 0.003 * 1000),
      })),
    });
  });

  // POST /campaigns/:id/validate
  app.post('/:id/validate', (c) => {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE campaign_id = ?').get(c.req.param('id')) as CampaignRow | undefined;
    if (!campaign) return c.json({ error: 'unknown campaign' }, 404);
    if (campaign.state === 'archived') return c.json({ error: 'archived campaigns cannot be validated' }, 400);

    const nowMs = Date.now();
    db.prepare(`
      UPDATE campaigns
      SET state = 'validated', validated_at_ms = ?, validated_hash = ?
      WHERE campaign_id = ?
    `).run(nowMs, campaign.content_hash, campaign.campaign_id);

    return c.json({ campaignId: campaign.campaign_id, state: 'validated', validatedAtMs: nowMs });
  });

  // POST /campaigns/:id/approve
  app.post('/:id/approve', (c) => {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE campaign_id = ?').get(c.req.param('id')) as CampaignRow | undefined;
    if (!campaign) return c.json({ error: 'unknown campaign' }, 404);
    if (campaign.state !== 'validated') return c.json({ error: 'campaign must be validated before approval' }, 400);

    // DEC-025 / WEB-007: if content changed since validation, reject approval
    if (campaign.content_hash !== campaign.validated_hash) {
      return c.json({
        error: 'content changed since validation — re-validate before approving',
        currentHash: campaign.content_hash,
        validatedHash: campaign.validated_hash,
      }, 400);
    }

    const nowMs = Date.now();
    db.prepare(`
      UPDATE campaigns SET state = 'approved', approved_at_ms = ? WHERE campaign_id = ?
    `).run(nowMs, campaign.campaign_id);

    return c.json({ campaignId: campaign.campaign_id, state: 'approved', approvedAtMs: nowMs });
  });

  // POST /campaigns/:id/archive
  app.post('/:id/archive', (c) => {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE campaign_id = ?').get(c.req.param('id')) as CampaignRow | undefined;
    if (!campaign) return c.json({ error: 'unknown campaign' }, 404);

    db.prepare(`UPDATE campaigns SET state = 'archived' WHERE campaign_id = ?`).run(campaign.campaign_id);
    return c.json({ campaignId: campaign.campaign_id, state: 'archived' });
  });

  return app;
}
