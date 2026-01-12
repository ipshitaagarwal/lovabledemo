<template>
  <div class="test-suite">
    <!-- Loading State for Shared Results -->
    <div v-if="loadingShared" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading shared results...</p>
    </div>

    <template v-else>
    <!-- Header -->
    <div class="suite-header">
      <div>
        <h1>Test Suite</h1>
        <p class="subtitle">Run multiple queries and compare aggregate performance</p>
      </div>
      <div class="header-actions" v-if="!isSharedView">
        <button @click="generateQueries" :disabled="generating || running" class="btn-generate">
          <span v-if="generating" class="spinner small"></span>
          <span v-else>✨</span>
          {{ generating ? 'Generating...' : 'Generate Queries' }}
        </button>
        <button @click="runSuite" :disabled="running || queries.length === 0" class="btn-run">
          <span v-if="running" class="spinner small"></span>
          <span v-else>▶</span>
          {{ running ? `Running ${progress.current}/${progress.total}...` : 'Run Test Suite' }}
        </button>
      </div>
    </div>

    <!-- Shared View Banner -->
    <div v-if="isSharedView" class="shared-banner">
      <div class="shared-info">
        <span class="share-icon">🔗</span>
        <span>Shared Test Suite Results</span>
        <span class="share-date" v-if="sharedData?.createdAt">{{ formatDate(sharedData.createdAt) }}</span>
      </div>
      <router-link to="/suite" class="btn-new">Run Your Own Suite</router-link>
    </div>

    <!-- Query Input -->
    <div v-if="!isSharedView" class="queries-section">
      <div class="queries-header">
        <h3>Test Queries ({{ queries.length }})</h3>
        <button @click="addQuery" :disabled="running" class="btn-add">
          <span>+</span> Add Query
        </button>
      </div>
      <div class="queries-list">
        <div v-for="(q, idx) in queries" :key="idx" class="query-item">
          <span class="query-num">{{ idx + 1 }}</span>
          <input v-model="queries[idx]" type="text" placeholder="Enter search query..." :disabled="running" />
          <button @click="removeQuery(idx)" :disabled="running" class="btn-remove">×</button>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div v-if="results" class="results-section">
      <!-- Share Bar -->
      <div class="share-bar">
        <div class="share-actions">
          <button v-if="!shareUrl && !isSharedView" @click="shareResults" :disabled="sharing" class="btn-share">
            <span v-if="sharing" class="spinner small"></span>
            <span v-else>🔗</span>
            {{ sharing ? 'Creating link...' : 'Share Results' }}
          </button>
          <div v-if="shareUrl" class="share-link-container">
            <input type="text" :value="shareUrl" readonly class="share-link-input" ref="shareLinkInput" />
            <button @click="copyShareLink" class="btn-copy" :class="{ copied }">
              {{ copied ? '✓ Copied!' : 'Copy' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-panel">
        <h3>Results Summary</h3>
        <div class="summary-cards">
          <div class="summary-card parallel" :class="{ winner: isWinner('parallel') }">
            <div class="card-label">Parallel</div>
            <div class="card-value">{{ results.summary.parallelWins }}</div>
            <div class="card-sub">wins</div>
            <div class="card-latency" v-if="results.summary.avgLatency">{{ results.summary.avgLatency.parallel }}ms avg</div>
          </div>
          <div class="summary-card firecrawl" :class="{ winner: isWinner('firecrawl') }">
            <div class="card-label">Firecrawl</div>
            <div class="card-value">{{ results.summary.firecrawlWins }}</div>
            <div class="card-sub">wins</div>
            <div class="card-latency" v-if="results.summary.avgLatency">{{ results.summary.avgLatency.firecrawl }}ms avg</div>
          </div>
          <div class="summary-card openai" :class="{ winner: isWinner('openai') }">
            <div class="card-label">OpenAI</div>
            <div class="card-value">{{ results.summary.openaiWins }}</div>
            <div class="card-sub">wins</div>
            <div class="card-latency" v-if="results.summary.avgLatency">{{ results.summary.avgLatency.openai }}ms avg</div>
          </div>
          <div class="summary-card exa" :class="{ winner: isWinner('exa') }">
            <div class="card-label">Exa</div>
            <div class="card-value">{{ results.summary.exaWins }}</div>
            <div class="card-sub">wins</div>
            <div class="card-latency" v-if="results.summary.avgLatency">{{ results.summary.avgLatency.exa }}ms avg</div>
          </div>
          <div class="summary-card ties">
            <div class="card-label">Ties</div>
            <div class="card-value">{{ results.summary.ties }}</div>
            <div class="card-sub">queries</div>
          </div>
        </div>
      </div>

      <!-- Results Table -->
      <div class="results-table-container">
        <table class="results-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Query</th>
              <th>Winner</th>
              <th>Parallel</th>
              <th>Firecrawl</th>
              <th>Exa</th>
              <th>OpenAI</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, idx) in results.results" :key="idx" :class="{ 'row-error': r.error }">
              <td class="col-num">{{ idx + 1 }}</td>
              <td class="col-query">{{ r.query }}</td>
              <td class="col-winner">
                <span v-if="r.error" class="error-badge">Error</span>
                <span v-else class="winner-badge" :class="r.judgment?.winner">{{ r.judgment?.winner || '-' }}</span>
              </td>
              <td class="col-score">{{ r.judgment?.parallel?.totalScore || '-' }}</td>
              <td class="col-score">{{ r.judgment?.firecrawl?.totalScore || '-' }}</td>
              <td class="col-score">{{ r.judgment?.exa?.totalScore || '-' }}</td>
              <td class="col-score">{{ r.judgment?.openai?.totalScore || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!results && !running && !isSharedView" class="empty-state">
      <div class="empty-icon">📊</div>
      <h3>Run a Test Suite</h3>
      <p>Add queries above or generate them automatically, then run the suite to compare all four providers.</p>
    </div>
    </template>
  </div>
</template>

<script>
export default {
  props: {
    id: { type: String, default: null }
  },
  data() {
    return {
      loadingShared: false,
      sharedData: null,
      queries: [
        'how to implement dark mode in react',
        'next.js api routes authentication',
        'tailwind css grid layout examples',
        'supabase realtime subscriptions',
        'react hook form validation'
      ],
      results: null,
      running: false,
      generating: false,
      progress: { current: 0, total: 0 },
      sharing: false,
      shareUrl: null,
      copied: false
    }
  },
  async mounted() {
    if (this.id) {
      await this.loadSharedResults()
    }
  },
  computed: {
    isSharedView() {
      return !!this.id
    }
  },
  methods: {
    async loadSharedResults() {
      if (!this.id) return
      this.loadingShared = true
      try {
        const res = await fetch(`/api/test-suite/results/${this.id}`)
        if (!res.ok) throw new Error('Results not found')
        const data = await res.json()
        this.sharedData = data
        this.results = data
      } catch (err) {
        console.error(err)
      } finally {
        this.loadingShared = false
      }
    },
    addQuery() {
      this.queries.push('')
    },
    removeQuery(idx) {
      this.queries.splice(idx, 1)
    },
    async generateQueries() {
      this.generating = true
      try {
        const res = await fetch('/api/test-suite/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            description: 'Lovable.dev is an AI app builder - generate queries developers would search for',
            count: 10 
          })
        })
        if (!res.ok) throw new Error('Generation failed')
        const data = await res.json()
        this.queries = data.queries || []
      } catch (err) {
        console.error(err)
      } finally {
        this.generating = false
      }
    },
    async runSuite() {
      const validQueries = this.queries.filter(q => q.trim())
      if (validQueries.length === 0) return

      this.running = true
      this.results = null
      this.shareUrl = null
      this.progress = { current: 0, total: validQueries.length }

      try {
        const response = await fetch('/api/test-suite/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queries: validQueries })
        })

        if (!response.ok) {
          throw new Error('Test suite failed')
        }

        const data = await response.json()
        this.results = data
        this.progress = { current: validQueries.length, total: validQueries.length }
      } catch (err) {
        console.error(err)
        alert('Test suite failed: ' + err.message)
      } finally {
        this.running = false
      }
    },
    async shareResults() {
      if (!this.results) return
      this.sharing = true
      try {
        const res = await fetch('/api/test-suite/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: this.results.summary,
            results: this.results.results
          })
        })
        if (!res.ok) throw new Error('Failed to save')
        const data = await res.json()
        this.shareUrl = window.location.origin + data.url
      } catch (err) {
        console.error(err)
      } finally {
        this.sharing = false
      }
    },
    async copyShareLink() {
      if (!this.shareUrl) return
      try {
        await navigator.clipboard.writeText(this.shareUrl)
        this.copied = true
        setTimeout(() => { this.copied = false }, 2000)
      } catch (err) {
        this.$refs.shareLinkInput.select()
        document.execCommand('copy')
        this.copied = true
        setTimeout(() => { this.copied = false }, 2000)
      }
    },
    isWinner(provider) {
      if (!this.results?.summary) return false
      const s = this.results.summary
      const wins = {
        parallel: s.parallelWins,
        firecrawl: s.firecrawlWins,
        exa: s.exaWins,
        openai: s.openaiWins
      }
      const max = Math.max(...Object.values(wins))
      return wins[provider] === max && max > 0
    },
    formatDate(date) {
      if (!date) return ''
      return new Date(date).toLocaleDateString()
    }
  }
}
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 56, 92, 0.2);
  border-top-color: #FF385C;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.suite-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
}

.suite-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 6px;
}

.subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-generate, .btn-run {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-generate {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.btn-generate:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.3);
}

.btn-run {
  background: linear-gradient(135deg, #FF385C, #EC4899);
  color: white;
}

.btn-run:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(255, 56, 92, 0.4);
}

.btn-generate:disabled, .btn-run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.small {
  width: 14px;
  height: 14px;
}

.shared-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 12px;
  margin-bottom: 24px;
}

.shared-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.share-date {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.btn-new {
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, #FF385C, #EC4899);
  border: none;
  border-radius: 10px;
  color: white;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-new:hover {
  transform: translateY(-1px);
}

.queries-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 30px;
}

.queries-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.queries-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.btn-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-add:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.queries-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.query-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.query-num {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.4);
}

.query-item input {
  flex: 1;
  padding: 12px 14px;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #fff;
  outline: none;
  transition: all 0.2s ease;
}

.query-item input:focus {
  border-color: rgba(255, 56, 92, 0.5);
}

.btn-remove {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-remove:hover:not(:disabled) {
  color: #f87171;
}

.share-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.btn-share {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-share:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.3);
}

.share-link-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.share-link-input {
  width: 280px;
  padding: 8px 12px;
  font-size: 12px;
  font-family: 'SF Mono', Monaco, monospace;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  outline: none;
}

.btn-copy {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #FF385C, #EC4899);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
}

.btn-copy.copied {
  background: linear-gradient(135deg, #34d399, #10b981);
}

.summary-panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.summary-panel h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.summary-card {
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  text-align: center;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.summary-card.winner {
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.1);
}

.card-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.summary-card.parallel .card-label { color: #60a5fa; }
.summary-card.firecrawl .card-label { color: #f97316; }
.summary-card.exa .card-label { color: #34d399; }
.summary-card.openai .card-label { color: #a78bfa; }
.summary-card.ties .card-label { color: rgba(255, 255, 255, 0.5); }

.card-value {
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.card-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
}

.card-latency {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 8px;
}

.results-table-container {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  overflow: hidden;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th {
  padding: 14px 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: left;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.results-table td {
  padding: 14px 16px;
  font-size: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.results-table tr:last-child td {
  border-bottom: none;
}

.results-table tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.col-num {
  width: 50px;
  color: rgba(255, 255, 255, 0.4);
}

.col-query {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-winner {
  width: 100px;
}

.col-score {
  width: 80px;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
}

.winner-badge {
  display: inline-block;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
  border-radius: 6px;
}

.winner-badge.parallel { background: rgba(96, 165, 250, 0.2); color: #60a5fa; }
.winner-badge.firecrawl { background: rgba(249, 115, 22, 0.2); color: #f97316; }
.winner-badge.exa { background: rgba(52, 211, 153, 0.2); color: #34d399; }
.winner-badge.openai { background: rgba(167, 139, 250, 0.2); color: #a78bfa; }
.winner-badge.tie { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.5); }

.error-badge {
  display: inline-block;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border-radius: 6px;
}

.row-error {
  opacity: 0.5;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 1024px) {
  .summary-cards {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .suite-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .summary-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .results-table-container {
    overflow-x: auto;
  }
}
</style>
