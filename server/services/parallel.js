// Parallel Task API client.
// Docs: https://docs.parallel.ai — Task API: create run + fetch result.
//
// We constrain the Task output to a JSON schema whose fields map 1:1 to
// columns in the Notion "Companies" / "Prospects" database, so the response
// is directly writable to Notion with no post-processing.

const PARALLEL_BASE = process.env.PARALLEL_BASE_URL || 'https://api.parallel.ai';

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'company_name',
    'website',
    'one_line_description',
    'industry',
    'hq_location',
    'headcount_range',
    'funding_stage',
    'total_funding_usd',
    'recent_news',
    'key_people',
    'icp_fit_score',
    'icp_fit_rationale',
  ],
  properties: {
    company_name: { type: 'string', description: 'Canonical legal/brand name of the company.' },
    website: { type: 'string', description: 'Primary marketing website URL, including scheme.' },
    one_line_description: { type: 'string', description: 'One sentence describing what the company does.' },
    industry: { type: 'string', description: 'Primary industry/category (e.g. "Productivity SaaS").' },
    hq_location: { type: 'string', description: 'Headquarters city and country.' },
    headcount_range: {
      type: 'string',
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+'],
    },
    funding_stage: {
      type: 'string',
      enum: ['Bootstrapped', 'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+', 'Public', 'Acquired', 'Unknown'],
    },
    total_funding_usd: {
      type: ['number', 'null'],
      description: 'Total disclosed funding raised, in USD. Null if unknown.',
    },
    recent_news: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'headline', 'url'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD if known, else YYYY-MM.' },
          headline: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
    key_people: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'role'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string', description: 'e.g. "CEO & Co-founder"' },
          linkedin: { type: 'string' },
        },
      },
    },
    icp_fit_score: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      description: 'How well this company fits the user-supplied ICP (1=poor, 10=ideal).',
    },
    icp_fit_rationale: {
      type: 'string',
      description: 'Two to three sentences justifying the ICP fit score, citing the strongest signals.',
    },
  },
};

const DEFAULT_ICP =
  'B2B SaaS, 50-1000 employees, Series A through C, selling productivity, ' +
  'collaboration, or developer tools to mid-market or enterprise customers, ' +
  'with active GTM hiring in the last 6 months.';

function authHeaders() {
  const key = process.env.PARALLEL_API_KEY;
  if (!key) throw new Error('PARALLEL_API_KEY not set');
  return { 'x-api-key': key, 'Content-Type': 'application/json' };
}

async function createRun({ companyName, icp = DEFAULT_ICP, processor = 'core' }) {
  const body = {
    input:
      `Research the company "${companyName}".\n\n` +
      `Produce a CRM enrichment record for sales prospecting.\n\n` +
      `Ideal Customer Profile (ICP) for scoring fit:\n${icp}\n\n` +
      `Score icp_fit_score against this ICP. Be honest — give a low score ` +
      `when the company is clearly out of ICP.`,
    task_spec: {
      output_schema: { type: 'json', json_schema: OUTPUT_SCHEMA },
    },
    processor,
  };

  const res = await fetch(`${PARALLEL_BASE}/v1/tasks/runs`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Parallel createRun ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getResult(runId, { timeoutMs = 240000, pollMs = 3000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${PARALLEL_BASE}/v1/tasks/runs/${runId}/result`, {
      headers: authHeaders(),
    });
    if (res.status === 200) return res.json();
    if (res.status !== 202 && res.status !== 404) {
      throw new Error(`Parallel getResult ${res.status}: ${await res.text()}`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Parallel run ${runId} timed out`);
}

async function enrichCompany(companyName, { icp, processor } = {}) {
  const run = await createRun({ companyName, icp, processor });
  const result = await getResult(run.run_id);
  const content = result.output?.content;
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;
  return {
    run_id: run.run_id,
    data: parsed,
    basis: result.output?.basis || null,
  };
}

module.exports = { enrichCompany, OUTPUT_SCHEMA, DEFAULT_ICP };
