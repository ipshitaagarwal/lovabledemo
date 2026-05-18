<template>
  <div class="app">
    <header class="header">
      <div class="header-inner">
        <div class="brand">
          <div class="brand-marks">
            <span class="mark notion">N</span>
            <span class="x">×</span>
            <span class="mark parallel">∥</span>
          </div>
          <div class="brand-text">
            <h1>CRM Enrichment Worker</h1>
            <p>Parallel Task API → Notion database</p>
          </div>
        </div>
        <div class="health" v-if="health">
          <span class="dot" :class="{ ok: health.has_parallel }"></span> Parallel
          <span class="dot" :class="{ ok: health.has_notion }"></span> Notion
        </div>
      </div>
    </header>

    <main class="main">
      <section class="hero">
        <h2>Add a company. Get a research-grade CRM record.</h2>
        <p class="lede">
          Drop a company name into your Notion <em>Companies</em> database.
          The Worker fires on row creation, calls the Parallel Task API to research
          funding stage, headcount, recent news, key people, and ICP fit — then
          writes structured fields back into the row.
        </p>
        <div class="flow">
          <div class="flow-step">
            <div class="num">1</div>
            <div class="label">New row in Notion</div>
            <code class="mono">"Linear"</code>
          </div>
          <div class="arrow">→</div>
          <div class="flow-step">
            <div class="num">2</div>
            <div class="label">Worker calls Parallel Task</div>
            <code class="mono">POST /v1/tasks/runs</code>
          </div>
          <div class="arrow">→</div>
          <div class="flow-step">
            <div class="num">3</div>
            <div class="label">Structured fields → Notion</div>
            <code class="mono">PATCH /v1/pages/{id}</code>
          </div>
        </div>
      </section>

      <section class="grid">
        <!-- LEFT: Try the enrichment -->
        <div class="card">
          <div class="card-head">
            <h3>Try the enrichment</h3>
            <span class="pill">No Notion write — preview only</span>
          </div>

          <label class="field">
            <span>Company name</span>
            <input v-model="company" placeholder="e.g. Linear, Ramp, Anthropic" />
          </label>

          <label class="field">
            <span>Your ICP <small>— used to score fit</small></span>
            <textarea v-model="icp" rows="3" />
          </label>

          <button class="btn primary" :disabled="!company || enriching" @click="runEnrich">
            <span v-if="!enriching">Run Parallel Task</span>
            <span v-else>Researching <span class="spin"></span></span>
          </button>

          <div v-if="enrichError" class="alert err">{{ enrichError }}</div>

          <div v-if="enrichResult" class="result">
            <div class="result-meta">
              <span>Run <code class="mono">{{ enrichResult.run_id }}</code></span>
              <span>{{ (enrichResult.latency_ms / 1000).toFixed(1) }}s</span>
            </div>

            <div class="company-card">
              <div class="cc-top">
                <h4>{{ enrichResult.data.company_name }}</h4>
                <a :href="enrichResult.data.website" target="_blank" class="link">{{ enrichResult.data.website }}</a>
              </div>
              <p class="desc">{{ enrichResult.data.one_line_description }}</p>

              <div class="badges">
                <span class="badge">{{ enrichResult.data.industry }}</span>
                <span class="badge">{{ enrichResult.data.hq_location }}</span>
                <span class="badge">{{ enrichResult.data.headcount_range }} employees</span>
                <span class="badge stage">{{ enrichResult.data.funding_stage }}</span>
                <span class="badge funds" v-if="enrichResult.data.total_funding_usd">
                  ${{ formatMoney(enrichResult.data.total_funding_usd) }} raised
                </span>
              </div>

              <div class="icp">
                <div class="icp-score">
                  <div class="score-num">{{ enrichResult.data.icp_fit_score }}<small>/10</small></div>
                  <div class="score-bar">
                    <div class="score-fill" :style="{ width: (enrichResult.data.icp_fit_score * 10) + '%' }"></div>
                  </div>
                  <div class="score-label">ICP fit</div>
                </div>
                <p class="icp-why">{{ enrichResult.data.icp_fit_rationale }}</p>
              </div>

              <div class="cols">
                <div>
                  <h5>Recent news</h5>
                  <ul class="news">
                    <li v-for="(n, i) in enrichResult.data.recent_news" :key="i">
                      <span class="date">{{ n.date }}</span>
                      <a :href="n.url" target="_blank">{{ n.headline }}</a>
                    </li>
                    <li v-if="!enrichResult.data.recent_news?.length" class="empty">No recent news found.</li>
                  </ul>
                </div>
                <div>
                  <h5>Key people</h5>
                  <ul class="people">
                    <li v-for="(p, i) in enrichResult.data.key_people" :key="i">
                      <strong>{{ p.name }}</strong>
                      <span>{{ p.role }}</span>
                      <a v-if="p.linkedin" :href="p.linkedin" target="_blank">↗</a>
                    </li>
                    <li v-if="!enrichResult.data.key_people?.length" class="empty">No key people found.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: The Worker -->
        <div class="card">
          <div class="card-head">
            <h3>The Worker</h3>
            <span class="pill green">Writes to Notion</span>
          </div>

          <p class="muted">
            Point at your Notion database. The Worker adds any missing properties,
            scans for new rows (Status = <em>New</em>), enriches each via Parallel,
            and writes the structured fields back.
          </p>

          <label class="field">
            <span>Notion database ID</span>
            <input v-model="databaseId" placeholder="32-char Notion database id" />
          </label>

          <div class="row">
            <button class="btn" :disabled="!databaseId || setupRunning" @click="runSetup">
              <span v-if="!setupRunning">1. Provision schema</span>
              <span v-else>Provisioning…</span>
            </button>
            <button class="btn primary" :disabled="!databaseId || scanRunning" @click="runScan">
              <span v-if="!scanRunning">2. Scan & enrich</span>
              <span v-else>Scanning…</span>
            </button>
          </div>

          <div v-if="setupResult" class="alert ok">
            Schema OK.
            <span v-if="setupResult.added.length">Added: {{ setupResult.added.join(', ') }}.</span>
            <span v-else>All required properties already present.</span>
          </div>
          <div v-if="scanResult" class="alert ok">
            Scanned {{ scanResult.scanned }} row(s).
            <ul class="scan-list">
              <li v-for="r in scanResult.processed" :key="r.id">
                <span class="company">{{ r.company || '(empty)' }}</span>
                <span v-if="r.error" class="err-text">{{ r.error }}</span>
                <span v-else-if="r.run_id" class="ok-text">ICP {{ r.icp_fit_score }}/10</span>
                <span v-else class="muted">{{ r.skipped }}</span>
              </li>
            </ul>
          </div>
          <div v-if="scanError || setupError" class="alert err">{{ scanError || setupError }}</div>

          <h4 class="feed-title">Activity</h4>
          <div class="feed">
            <div v-for="j in jobs" :key="j.id" class="feed-row" :class="j.kind">
              <span class="feed-time">{{ formatTime(j.ts) }}</span>
              <span class="feed-kind">{{ kindLabel(j.kind) }}</span>
              <span class="feed-body">
                <template v-if="j.company">"{{ j.company }}"</template>
                <template v-if="j.run_id"> · <code class="mono">{{ j.run_id.slice(0,12) }}…</code></template>
                <template v-if="j.error"> · {{ j.error }}</template>
                <template v-if="j.kind === 'scan'"> · {{ j.found }} row(s)</template>
                <template v-if="j.kind === 'setup'"> · added {{ j.added.length }}</template>
              </span>
            </div>
            <div v-if="!jobs.length" class="feed-empty">No activity yet. Add a row in Notion and click <em>Scan &amp; enrich</em>.</div>
          </div>
        </div>
      </section>

      <section class="card schema-card">
        <div class="card-head">
          <h3>The output contract</h3>
          <span class="pill">Parallel <code class="mono">task_spec.output_schema</code></span>
        </div>
        <p class="muted">
          Every Parallel run is constrained to this JSON schema. That means every
          response maps 1:1 to a Notion column — no glue code, no parsing, no
          drift.
        </p>
        <pre class="schema mono"><code>{{ schemaPretty }}</code></pre>
      </section>

      <section class="card setup-card">
        <h3>Wiring it up</h3>
        <ol>
          <li>
            Create an internal integration at
            <a href="https://www.notion.so/profile/integrations" target="_blank">notion.so/profile/integrations</a>
            and copy the secret into <code class="mono">NOTION_TOKEN</code>.
          </li>
          <li>
            Share your <em>Companies</em> database with the integration
            (… menu → <em>Connections</em> → add it).
          </li>
          <li>
            Drop your Parallel key into <code class="mono">PARALLEL_API_KEY</code>
            (<a href="https://platform.parallel.ai" target="_blank">platform.parallel.ai</a>).
          </li>
          <li>
            Paste the database ID above and click <em>Provision schema</em> — the
            Worker adds any missing columns idempotently.
          </li>
          <li>
            <strong>Production:</strong> instead of <em>Scan &amp; enrich</em>,
            run <code class="mono">npm run worker</code> for the standalone
            polling loop, or point a Notion automation webhook at
            <code class="mono">POST /api/enrich-page</code>.
          </li>
        </ol>
      </section>
    </main>

    <footer class="footer">
      <p>Built for Notion · powered by <strong>Parallel Task API</strong></p>
    </footer>
  </div>
</template>

<script>
export default {
  data() {
    return {
      health: null,
      schema: null,
      company: 'Linear',
      icp: '',
      enriching: false,
      enrichResult: null,
      enrichError: null,
      databaseId: '',
      setupRunning: false,
      setupResult: null,
      setupError: null,
      scanRunning: false,
      scanResult: null,
      scanError: null,
      jobs: [],
      _pollHandle: null,
    }
  },
  computed: {
    schemaPretty() {
      return this.schema ? JSON.stringify(this.schema, null, 2) : 'loading…'
    },
  },
  mounted() {
    this.loadHealth()
    this.loadSchema()
    this.pollJobs()
    this._pollHandle = setInterval(this.pollJobs, 3000)
  },
  beforeUnmount() {
    clearInterval(this._pollHandle)
  },
  methods: {
    async loadHealth() {
      const r = await fetch('/api/health').then(r => r.json()).catch(() => null)
      this.health = r
      if (r?.default_icp && !this.icp) this.icp = r.default_icp
      if (r?.database_id && !this.databaseId) this.databaseId = r.database_id
    },
    async loadSchema() {
      this.schema = await fetch('/api/schema').then(r => r.json()).catch(() => null)
    },
    async pollJobs() {
      const r = await fetch('/api/jobs').then(r => r.json()).catch(() => null)
      if (r?.jobs) this.jobs = r.jobs
    },
    async runEnrich() {
      this.enriching = true
      this.enrichError = null
      this.enrichResult = null
      try {
        const r = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: this.company, icp: this.icp }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'enrichment failed')
        this.enrichResult = data
      } catch (e) {
        this.enrichError = e.message
      } finally {
        this.enriching = false
      }
    },
    async runSetup() {
      this.setupRunning = true
      this.setupError = null
      this.setupResult = null
      try {
        const r = await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ database_id: this.databaseId }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'setup failed')
        this.setupResult = data
      } catch (e) {
        this.setupError = e.message
      } finally {
        this.setupRunning = false
      }
    },
    async runScan() {
      this.scanRunning = true
      this.scanError = null
      this.scanResult = null
      try {
        const r = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ database_id: this.databaseId, icp: this.icp }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'scan failed')
        this.scanResult = data
      } catch (e) {
        this.scanError = e.message
      } finally {
        this.scanRunning = false
      }
    },
    formatMoney(n) {
      if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
      if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
      if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
      return String(n)
    },
    formatTime(ts) {
      return new Date(ts).toLocaleTimeString()
    },
    kindLabel(k) {
      return {
        enrich_start: 'preview start',
        enrich_done: 'preview done',
        enrich_error: 'preview error',
        enrich_page_start: 'enrich start',
        enrich_page_done: 'enrich done',
        enrich_page_error: 'enrich error',
        setup: 'schema',
        scan: 'scan',
      }[k] || k
    },
  },
}
</script>

<style>
.app { min-height: 100vh; display: flex; flex-direction: column; }

.header {
  border-bottom: 1px solid #e9e7e2;
  background: #fff;
  position: sticky; top: 0; z-index: 50;
}
.header-inner {
  max-width: 1180px; margin: 0 auto;
  padding: 14px 24px; display: flex; align-items: center; justify-content: space-between;
}
.brand { display: flex; align-items: center; gap: 14px; }
.brand-marks { display: flex; align-items: center; gap: 6px; }
.mark {
  width: 32px; height: 32px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 18px;
}
.mark.notion { background: #fff; color: #000; border: 1px solid #e0ddd5; }
.mark.parallel { background: #0f0f10; color: #fff; }
.x { color: #b3afa6; font-weight: 500; }
.brand-text h1 { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.brand-text p { font-size: 12px; color: #888378; }
.health { font-size: 12px; color: #888378; display: flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #d8d4ca; margin-right: 2px; }
.dot.ok { background: #2fbf71; }

.main { flex: 1; max-width: 1180px; margin: 0 auto; padding: 40px 24px 60px; width: 100%; }

.hero { margin-bottom: 32px; }
.hero h2 {
  font-size: 32px; font-weight: 600; letter-spacing: -0.02em;
  margin-bottom: 10px; max-width: 720px;
}
.lede { font-size: 16px; color: #5b5950; max-width: 720px; margin-bottom: 24px; }
.flow {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 18px; background: #fff; border: 1px solid #ece9e2; border-radius: 12px;
}
.flow-step { flex: 1; min-width: 200px; }
.flow-step .num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  background: #0f0f10; color: #fff; font-size: 12px; font-weight: 600;
  margin-bottom: 8px;
}
.flow-step .label { font-weight: 500; font-size: 14px; margin-bottom: 4px; }
.flow-step code { font-size: 12px; color: #888378; }
.arrow { color: #c8c4ba; font-size: 18px; }

.grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
  margin-bottom: 20px;
}
@media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }

.card {
  background: #fff; border: 1px solid #ece9e2; border-radius: 12px;
  padding: 24px;
}
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.card-head h3 { font-size: 17px; font-weight: 600; }
.pill {
  font-size: 11px; padding: 4px 10px; border-radius: 999px;
  background: #f0eee8; color: #6c6a60; border: 1px solid #e6e3da;
}
.pill.green { background: #e6f7ed; color: #1e7a47; border-color: #cfecd9; }

.field { display: block; margin-bottom: 14px; }
.field > span { display: block; font-size: 12px; font-weight: 500; color: #6c6a60; margin-bottom: 6px; }
.field > span small { font-weight: 400; color: #a3a094; }
.field input, .field textarea {
  width: 100%; padding: 10px 12px; border: 1px solid #e2dfd6; border-radius: 8px;
  font: inherit; font-size: 14px; background: #fbfaf6;
  resize: vertical;
}
.field input:focus, .field textarea:focus { outline: 2px solid #0f0f10; outline-offset: -1px; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 18px; border-radius: 8px; border: 1px solid #d8d4ca;
  background: #fff; font: inherit; font-size: 14px; font-weight: 500;
  color: #37352f; cursor: pointer;
  transition: all .15s;
}
.btn:hover:not(:disabled) { background: #f3f1ec; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.primary { background: #0f0f10; color: #fff; border-color: #0f0f10; }
.btn.primary:hover:not(:disabled) { background: #28272b; }
.row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }

.spin {
  display: inline-block; width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.alert { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 14px; }
.alert.ok { background: #ecf7f0; color: #1e7a47; border: 1px solid #cfecd9; }
.alert.err { background: #fdecec; color: #a4322b; border: 1px solid #f3d4d2; }

.result { margin-top: 18px; }
.result-meta { display: flex; justify-content: space-between; font-size: 12px; color: #888378; margin-bottom: 10px; }
.result-meta code { font-size: 11px; }

.company-card { border: 1px solid #ece9e2; border-radius: 10px; padding: 18px; background: #fbfaf6; }
.cc-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 6px; flex-wrap: wrap; }
.cc-top h4 { font-size: 20px; font-weight: 600; }
.link { font-size: 13px; color: #2c6db3; text-decoration: none; }
.link:hover { text-decoration: underline; }
.desc { color: #5b5950; margin-bottom: 14px; font-size: 14px; }

.badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.badge {
  font-size: 12px; padding: 4px 10px; border-radius: 6px;
  background: #f0eee8; color: #5b5950; border: 1px solid #e6e3da;
}
.badge.stage { background: #eef3fb; color: #2c6db3; border-color: #d8e4f3; }
.badge.funds { background: #fbf3e6; color: #a26b00; border-color: #f0e1c2; }

.icp {
  display: flex; gap: 16px; align-items: flex-start;
  padding: 14px; background: #fff; border: 1px solid #ece9e2; border-radius: 8px;
  margin-bottom: 16px;
}
.icp-score { text-align: center; min-width: 96px; }
.score-num { font-size: 26px; font-weight: 700; }
.score-num small { font-size: 13px; color: #a3a094; font-weight: 500; }
.score-bar { height: 6px; background: #ece9e2; border-radius: 3px; overflow: hidden; margin: 6px 0; }
.score-fill {
  height: 100%;
  background: linear-gradient(90deg, #f0a85c, #2fbf71);
  transition: width .4s;
}
.score-label { font-size: 11px; color: #888378; text-transform: uppercase; letter-spacing: 0.5px; }
.icp-why { font-size: 13px; color: #5b5950; flex: 1; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 600px) { .cols { grid-template-columns: 1fr; } }
.cols h5 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #888378; margin-bottom: 8px; }
.news, .people { list-style: none; font-size: 13px; }
.news li { margin-bottom: 6px; line-height: 1.4; }
.news .date { color: #a3a094; font-size: 11px; margin-right: 6px; }
.news a, .people a { color: #2c6db3; text-decoration: none; }
.news a:hover, .people a:hover { text-decoration: underline; }
.people li { margin-bottom: 6px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.people strong { font-weight: 600; }
.people span { color: #5b5950; font-size: 12px; }
.empty { color: #a3a094; font-style: italic; }

.muted { color: #888378; font-size: 13px; margin-bottom: 14px; }

.scan-list { list-style: none; margin-top: 8px; font-size: 13px; }
.scan-list li { padding: 4px 0; display: flex; gap: 10px; justify-content: space-between; border-top: 1px dashed #cfecd9; }
.scan-list li:first-child { border-top: none; }
.scan-list .company { font-weight: 500; }
.ok-text { color: #1e7a47; }
.err-text { color: #a4322b; }

.feed-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #888378; margin: 22px 0 10px; }
.feed {
  background: #0f0f10; color: #c9c6bd; border-radius: 8px;
  padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px;
  max-height: 260px; overflow-y: auto;
}
.feed-row { display: flex; gap: 10px; padding: 3px 0; }
.feed-time { color: #6a6760; min-width: 70px; }
.feed-kind { color: #f0a85c; min-width: 110px; }
.feed-row.enrich_page_done .feed-kind { color: #2fbf71; }
.feed-row.enrich_page_error .feed-kind,
.feed-row.enrich_error .feed-kind { color: #ff7a6b; }
.feed-row.scan .feed-kind { color: #6db3ff; }
.feed-row.setup .feed-kind { color: #b388ff; }
.feed-body { flex: 1; color: #c9c6bd; }
.feed-empty { color: #6a6760; font-style: italic; padding: 8px; }

.schema-card { margin-bottom: 20px; }
.schema {
  background: #0f0f10; color: #c9c6bd; padding: 18px; border-radius: 8px;
  overflow-x: auto; font-size: 12px; line-height: 1.55; max-height: 480px;
}

.setup-card ol { padding-left: 22px; }
.setup-card li { margin-bottom: 10px; font-size: 14px; color: #37352f; }
.setup-card code { font-size: 12px; background: #f0eee8; padding: 2px 6px; border-radius: 4px; }
.setup-card a { color: #2c6db3; }

.footer { padding: 24px; text-align: center; font-size: 12px; color: #a3a094; }
.footer strong { color: #5b5950; }
</style>
