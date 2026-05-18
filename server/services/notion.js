// Notion API client for the CRM enrichment Worker.
//
// We work against a Notion database whose schema is established by
// `ensureSchema(databaseId)`. The Worker:
//   1. queries the DB for pages tagged Status="New" (or with empty enrichment)
//   2. for each, calls Parallel to enrich
//   3. PATCHes the page with the structured fields and flips Status=Enriched.

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function authHeaders() {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error('NOTION_TOKEN not set');
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function notionFetch(path, init = {}) {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Notion ${init.method || 'GET'} ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

// Property schema the Worker writes into. Used by ensureSchema().
const REQUIRED_PROPERTIES = {
  Company: { title: {} },
  Status: {
    status: {
      // Notion auto-manages status options; we read/write by name.
    },
  },
  Website: { url: {} },
  Description: { rich_text: {} },
  Industry: { select: {} },
  HQ: { rich_text: {} },
  Headcount: {
    select: {
      options: [
        '1-10', '11-50', '51-200', '201-500',
        '501-1000', '1001-5000', '5001-10000', '10000+',
      ].map((name) => ({ name })),
    },
  },
  'Funding Stage': {
    select: {
      options: [
        'Bootstrapped', 'Pre-Seed', 'Seed', 'Series A', 'Series B',
        'Series C', 'Series D+', 'Public', 'Acquired', 'Unknown',
      ].map((name) => ({ name })),
    },
  },
  'Total Funding (USD)': { number: { format: 'dollar' } },
  'ICP Score': { number: { format: 'number' } },
  'ICP Rationale': { rich_text: {} },
  'Recent News': { rich_text: {} },
  'Key People': { rich_text: {} },
  'Parallel Run': { url: {} },
  'Enriched At': { date: {} },
};

async function ensureSchema(databaseId) {
  const db = await notionFetch(`/databases/${databaseId}`);
  const have = db.properties || {};
  const toAdd = {};
  for (const [name, schema] of Object.entries(REQUIRED_PROPERTIES)) {
    if (!have[name]) toAdd[name] = schema;
  }
  if (Object.keys(toAdd).length === 0) return { added: [], existing: Object.keys(have) };
  await notionFetch(`/databases/${databaseId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: toAdd }),
  });
  return { added: Object.keys(toAdd), existing: Object.keys(have) };
}

// Read company name from a page (title property is whichever prop has type=title).
function readTitle(page) {
  const props = page.properties || {};
  for (const [, prop] of Object.entries(props)) {
    if (prop.type === 'title') {
      return (prop.title || []).map((t) => t.plain_text).join('').trim();
    }
  }
  return '';
}

function readStatus(page, name = 'Status') {
  const p = page.properties?.[name];
  if (!p) return null;
  if (p.type === 'status') return p.status?.name || null;
  if (p.type === 'select') return p.select?.name || null;
  return null;
}

async function findUnenrichedRows(databaseId, { limit = 25 } = {}) {
  // Match rows where Status is "New" OR missing — robust to DBs that don't yet
  // have a Status property (we fall back to "Industry is empty").
  const body = {
    page_size: limit,
    filter: {
      or: [
        { property: 'Status', status: { equals: 'New' } },
        { property: 'Industry', select: { is_empty: true } },
      ],
    },
  };
  let data;
  try {
    data = await notionFetch(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (e) {
    // If the filter references properties that don't exist, fall back to fetching all.
    data = await notionFetch(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({ page_size: limit }),
    });
  }
  return (data.results || []).map((page) => ({
    id: page.id,
    company: readTitle(page),
    status: readStatus(page),
    url: page.url,
  }));
}

function richText(content) {
  if (!content) return [];
  // Notion caps a single rich_text item at 2000 chars; split if needed.
  const out = [];
  let s = String(content);
  while (s.length > 0) {
    out.push({ type: 'text', text: { content: s.slice(0, 1900) } });
    s = s.slice(1900);
  }
  return out;
}

function newsToText(news = []) {
  return news
    .map((n) => `• ${n.date} — ${n.headline} (${n.url})`)
    .join('\n');
}

function peopleToText(people = []) {
  return people
    .map((p) => `• ${p.name} — ${p.role}${p.linkedin ? ` (${p.linkedin})` : ''}`)
    .join('\n');
}

function buildProperties(enrichment, runId) {
  const d = enrichment;
  const props = {
    Status: { status: { name: 'Enriched' } },
    Website: d.website ? { url: d.website } : { url: null },
    Description: { rich_text: richText(d.one_line_description) },
    Industry: d.industry ? { select: { name: d.industry } } : { select: null },
    HQ: { rich_text: richText(d.hq_location) },
    Headcount: d.headcount_range ? { select: { name: d.headcount_range } } : { select: null },
    'Funding Stage': d.funding_stage ? { select: { name: d.funding_stage } } : { select: null },
    'Total Funding (USD)': { number: d.total_funding_usd ?? null },
    'ICP Score': { number: d.icp_fit_score ?? null },
    'ICP Rationale': { rich_text: richText(d.icp_fit_rationale) },
    'Recent News': { rich_text: richText(newsToText(d.recent_news)) },
    'Key People': { rich_text: richText(peopleToText(d.key_people)) },
    'Enriched At': { date: { start: new Date().toISOString() } },
  };
  if (runId) {
    props['Parallel Run'] = { url: `https://platform.parallel.ai/runs/${runId}` };
  }
  return props;
}

async function setStatus(pageId, statusName) {
  return notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: { Status: { status: { name: statusName } } } }),
  });
}

async function writeEnrichment(pageId, enrichment, runId) {
  return notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: buildProperties(enrichment, runId) }),
  });
}

async function getPage(pageId) {
  return notionFetch(`/pages/${pageId}`);
}

module.exports = {
  ensureSchema,
  findUnenrichedRows,
  writeEnrichment,
  setStatus,
  getPage,
  readTitle,
  readStatus,
  REQUIRED_PROPERTIES,
};
