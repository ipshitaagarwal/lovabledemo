// Standalone worker: polls the Notion database every WORKER_INTERVAL_MS and
// enriches new rows. Run with `npm run worker`. The HTTP server exposes the
// same loop via POST /api/scan; this is the always-on equivalent for prod.

require('dotenv').config();

const { enrichCompany } = require('./services/parallel');
const { findUnenrichedRows, writeEnrichment, setStatus } = require('./services/notion');

const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const INTERVAL = Number(process.env.WORKER_INTERVAL_MS || 30000);

if (!DATABASE_ID) {
  console.error('NOTION_DATABASE_ID required');
  process.exit(1);
}

async function tick() {
  try {
    const rows = await findUnenrichedRows(DATABASE_ID, { limit: 5 });
    if (rows.length === 0) {
      console.log(`[${new Date().toISOString()}] no new rows`);
      return;
    }
    console.log(`[${new Date().toISOString()}] found ${rows.length} row(s)`);
    for (const row of rows) {
      if (!row.company) continue;
      try {
        await setStatus(row.id, 'Enriching').catch(() => {});
        console.log(`  → enriching "${row.company}"`);
        const out = await enrichCompany(row.company);
        await writeEnrichment(row.id, out.data, out.run_id);
        console.log(`  ✓ wrote ${row.company} (ICP fit: ${out.data.icp_fit_score})`);
      } catch (err) {
        await setStatus(row.id, 'Failed').catch(() => {});
        console.error(`  ✗ ${row.company}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('worker tick error:', err.message);
  }
}

console.log(`Worker started — polling ${DATABASE_ID} every ${INTERVAL}ms`);
tick();
setInterval(tick, INTERVAL);
