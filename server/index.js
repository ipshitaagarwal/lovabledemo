require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { enrichCompany, OUTPUT_SCHEMA, DEFAULT_ICP } = require('./services/parallel');
const {
  ensureSchema,
  findUnenrichedRows,
  writeEnrichment,
  setStatus,
  getPage,
  readTitle,
} = require('./services/notion');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../client/dist')));

// In-memory job log (so the UI can render the worker's stream of activity).
const JOBS = [];
function logJob(entry) {
  const job = { id: JOBS.length + 1, ts: new Date().toISOString(), ...entry };
  JOBS.unshift(job);
  if (JOBS.length > 200) JOBS.pop();
  return job;
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    has_parallel: !!process.env.PARALLEL_API_KEY,
    has_notion: !!process.env.NOTION_TOKEN,
    database_id: process.env.NOTION_DATABASE_ID || null,
    default_icp: DEFAULT_ICP,
  });
});

// Returns the JSON schema we ask Parallel to fill — the UI shows this so
// viewers can see the structured contract powering the enrichment.
app.get('/api/schema', (_req, res) => {
  res.json(OUTPUT_SCHEMA);
});

// Provision the required properties on the user's Notion database.
// Idempotent — adds only missing columns.
app.post('/api/setup', async (req, res) => {
  try {
    const databaseId = req.body?.database_id || process.env.NOTION_DATABASE_ID;
    if (!databaseId) return res.status(400).json({ error: 'database_id required' });
    const result = await ensureSchema(databaseId);
    logJob({ kind: 'setup', database_id: databaseId, ...result });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enrich a single company by name. Used by the UI's "try it" form.
// Does NOT touch Notion — just returns the structured Parallel output.
app.post('/api/enrich', async (req, res) => {
  try {
    const { company, icp } = req.body || {};
    if (!company) return res.status(400).json({ error: 'company required' });
    const started = Date.now();
    logJob({ kind: 'enrich_start', company });
    const out = await enrichCompany(company, { icp });
    logJob({ kind: 'enrich_done', company, run_id: out.run_id, ms: Date.now() - started });
    res.json({ ...out, latency_ms: Date.now() - started });
  } catch (err) {
    logJob({ kind: 'enrich_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Enrich a specific Notion page (by ID) and write results back.
app.post('/api/enrich-page', async (req, res) => {
  try {
    const { page_id, icp } = req.body || {};
    if (!page_id) return res.status(400).json({ error: 'page_id required' });

    const page = await getPage(page_id);
    const company = readTitle(page);
    if (!company) return res.status(400).json({ error: 'page has empty title' });

    await setStatus(page_id, 'Enriching').catch(() => {});
    logJob({ kind: 'enrich_page_start', page_id, company });

    const out = await enrichCompany(company, { icp });
    await writeEnrichment(page_id, out.data, out.run_id);
    logJob({ kind: 'enrich_page_done', page_id, company, run_id: out.run_id });

    res.json({ page_id, company, run_id: out.run_id, data: out.data });
  } catch (err) {
    logJob({ kind: 'enrich_page_error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Scan the Notion database for new rows and enrich each in turn.
// This is the "Worker" loop; called from the UI's run-once button and from worker.js.
app.post('/api/scan', async (req, res) => {
  try {
    const databaseId = req.body?.database_id || process.env.NOTION_DATABASE_ID;
    const icp = req.body?.icp;
    const limit = req.body?.limit || 10;
    if (!databaseId) return res.status(400).json({ error: 'database_id required' });

    const rows = await findUnenrichedRows(databaseId, { limit });
    logJob({ kind: 'scan', database_id: databaseId, found: rows.length });

    const processed = [];
    for (const row of rows) {
      if (!row.company) {
        processed.push({ ...row, skipped: 'empty title' });
        continue;
      }
      try {
        await setStatus(row.id, 'Enriching').catch(() => {});
        logJob({ kind: 'enrich_page_start', page_id: row.id, company: row.company });
        const out = await enrichCompany(row.company, { icp });
        await writeEnrichment(row.id, out.data, out.run_id);
        logJob({ kind: 'enrich_page_done', page_id: row.id, company: row.company, run_id: out.run_id });
        processed.push({ ...row, run_id: out.run_id, icp_fit_score: out.data.icp_fit_score });
      } catch (err) {
        await setStatus(row.id, 'Failed').catch(() => {});
        logJob({ kind: 'enrich_page_error', page_id: row.id, company: row.company, error: err.message });
        processed.push({ ...row, error: err.message });
      }
    }

    res.json({ scanned: rows.length, processed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recent job log — UI polls this for the live activity feed.
app.get('/api/jobs', (_req, res) => {
  res.json({ jobs: JOBS.slice(0, 50) });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Notion CRM Enrichment Worker listening on :${PORT}`);
  console.log(`  Parallel key:   ${process.env.PARALLEL_API_KEY ? 'set' : 'MISSING'}`);
  console.log(`  Notion token:   ${process.env.NOTION_TOKEN ? 'set' : 'MISSING'}`);
  console.log(`  Database ID:    ${process.env.NOTION_DATABASE_ID || '(none — pass per request)'}`);
});
