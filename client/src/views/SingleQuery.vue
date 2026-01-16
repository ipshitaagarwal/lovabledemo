<template>
  <div class="single-query">
    <!-- Loading State for Shared Results -->
    <div v-if="loadingShared" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading shared results...</p>
    </div>

    <template v-else>
    <!-- Shared View Banner -->
    <div v-if="isSharedView" class="shared-banner">
      <div class="shared-info">
        <span class="share-icon">🔗</span>
        <span>Shared Results</span>
        <span class="share-date" v-if="sharedData?.createdAt">{{ formatDate(sharedData.createdAt) }}</span>
      </div>
      <router-link to="/" class="btn-new-query">Run Your Own Query</router-link>
    </div>

    <!-- Context Banner -->
    <div v-if="!isSharedView" class="context-banner">
      <div class="context-icon">🎨</div>
      <div class="context-text">
        <strong>Scenario:</strong> A Canva user is creating designs and needs to search for design inspiration, templates, tutorials, stock assets, or creative techniques.
      </div>
    </div>

    <!-- Search Input -->
    <div v-if="!isSharedView" class="search-section">
      <div class="search-box">
        <div class="search-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <input
          v-model="query"
          type="text"
          placeholder="What would a Canva user search for? Try: 'minimalist logo design trends 2024'"
          @keyup.enter="runSearch"
          :disabled="loading"
        />
        <button @click="runSearch" :disabled="loading || !query.trim()" class="search-btn">
          <span v-if="loading" class="spinner"></span>
          <span v-else>Compare</span>
        </button>
      </div>
    </div>

    <!-- Example Queries -->
    <div v-if="!isSharedView && !results" class="example-queries">
      <span class="example-label">Try these design queries:</span>
      <button v-for="example in exampleQueries" :key="example" @click="setQuery(example)" class="example-btn">
        {{ example }}
      </button>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error-banner">
      <span>⚠️</span> {{ error }}
    </div>

    <!-- Results Section -->
    <div v-if="results" class="results-section">
      <div class="query-header">
        <div class="query-info">
          <span class="query-label">Query</span>
          <h2>"{{ searchedQuery }}"</h2>
        </div>
        <div class="header-actions">
          <button @click="runJudge" :disabled="judging" class="judge-btn">
            <span v-if="judging" class="spinner small"></span>
            <span v-else class="judge-icon">🧠</span>
            {{ judging ? 'Analyzing...' : judgment ? 'Re-Judge' : 'Judge with GPT-4o' }}
          </button>
          <button v-if="!shareUrl && !isSharedView" @click="shareResults" :disabled="sharing" class="share-btn">
            <span v-if="sharing" class="spinner small"></span>
            <span v-else>🔗</span>
            {{ sharing ? 'Saving...' : 'Share' }}
          </button>
          <div v-if="shareUrl" class="share-link-container">
            <input type="text" :value="shareUrl" readonly class="share-link-input" ref="shareLinkInput" />
            <button @click="copyShareLink" class="btn-copy" :class="{ copied }">
              {{ copied ? '✓' : 'Copy' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Judgment Panel -->
      <div v-if="judgment" class="judgment-panel">
        <div class="judgment-header">
          <span class="judgment-icon">🏆</span>
          <span class="winner-label">Winner: <strong>{{ judgment.winner }}</strong></span>
        </div>
        <p class="judgment-reasoning">{{ judgment.reasoning }}</p>
        <p class="judgment-recommendation" v-if="judgment.recommendation">
          <strong>Recommendation:</strong> {{ judgment.recommendation }}
        </p>
        
        <!-- Score Cards -->
        <div class="score-cards">
          <div v-for="provider in ['parallel', 'firecrawl', 'exa']" :key="provider" 
               class="score-card" :class="{ winner: judgment.winner === provider }">
            <div class="score-provider">{{ provider }}</div>
            <div class="score-total">{{ judgment[provider]?.totalScore || 0 }}/50</div>
            <div class="score-breakdown">
              <span>Relevance: {{ judgment[provider]?.scores?.relevance || 0 }}</span>
              <span>Freshness: {{ judgment[provider]?.scores?.freshness || 0 }}</span>
              <span>Actionability: {{ judgment[provider]?.scores?.actionability || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Four Column Results Grid -->
      <div class="results-grid four-columns">
        <!-- Parallel -->
        <div class="provider-column parallel">
          <div class="column-header">
            <h3>Parallel</h3>
            <div class="column-meta">
              <span class="latency" v-if="results.parallel?.latency">{{ results.parallel.latency }}ms</span>
              <span class="count">{{ results.parallel?.results?.length || 0 }} results</span>
            </div>
          </div>
          <div v-if="results.parallel?.error" class="provider-error">
            {{ results.parallel.error }}
          </div>
          <div v-else class="results-list">
            <div v-for="(result, idx) in results.parallel?.results || []" :key="idx" class="result-card">
              <div class="result-rank">{{ idx + 1 }}</div>
              <div class="result-content">
                <a :href="result.url" target="_blank" class="result-title">{{ truncate(result.title, 60) }}</a>
                <p class="result-snippet">{{ truncate(result.snippet, 120) }}</p>
                <span class="result-url">{{ truncateUrl(result.url) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Firecrawl -->
        <div class="provider-column firecrawl">
          <div class="column-header">
            <h3>Firecrawl</h3>
            <div class="column-meta">
              <span class="latency" v-if="results.firecrawl?.latency">{{ results.firecrawl.latency }}ms</span>
              <span class="count">{{ results.firecrawl?.results?.length || 0 }} results</span>
            </div>
          </div>
          <div v-if="results.firecrawl?.error" class="provider-error">
            {{ results.firecrawl.error }}
          </div>
          <div v-else class="results-list">
            <div v-for="(result, idx) in results.firecrawl?.results || []" :key="idx" class="result-card">
              <div class="result-rank">{{ idx + 1 }}</div>
              <div class="result-content">
                <a :href="result.url" target="_blank" class="result-title">{{ truncate(result.title, 60) }}</a>
                <p class="result-snippet">{{ truncate(result.snippet, 120) }}</p>
                <span class="result-url">{{ truncateUrl(result.url) }}</span>
              </div>
            </div>
          </div>
        </div>


        <!-- Exa -->
        <div class="provider-column exa">
          <div class="column-header">
            <h3>Exa</h3>
            <div class="column-meta">
              <span class="latency" v-if="results.exa?.latency">{{ results.exa.latency }}ms</span>
              <span class="count">{{ results.exa?.results?.length || 0 }} results</span>
            </div>
          </div>
          <div v-if="results.exa?.error" class="provider-error">
            {{ results.exa.error }}
          </div>
          <div v-else class="results-list">
            <div v-for="(result, idx) in results.exa?.results || []" :key="idx" class="result-card">
              <div class="result-rank">{{ idx + 1 }}</div>
              <div class="result-content">
                <a :href="result.url" target="_blank" class="result-title">{{ truncate(result.title, 60) }}</a>
                <p class="result-snippet">{{ truncate(result.snippet, 120) }}</p>
                <span class="result-url">{{ truncateUrl(result.url) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!results && !loading && !isSharedView" class="empty-state">
      <div class="empty-grid">
        <div class="empty-card parallel">
          <div class="empty-icon">⚡</div>
          <h4>Parallel</h4>
          <p>Fast, accurate web search API</p>
        </div>
        <div class="empty-card firecrawl">
          <div class="empty-icon">🔥</div>
          <h4>Firecrawl</h4>
          <p>Web scraping & search</p>
        </div>
        <div class="empty-card exa">
          <div class="empty-icon">🔮</div>
          <h4>Exa</h4>
          <p>Neural search for developers</p>
        </div>
      </div>
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
      query: '',
      searchedQuery: '',
      results: null,
      judgment: null,
      loading: false,
      judging: false,
      error: null,
      sharing: false,
      shareUrl: null,
      copied: false,
      exampleQueries: [
        "minimalist logo design trends 2024",
        "instagram story templates aesthetic",
        "color palette generator pastel",
        "brand identity design guidelines",
        "social media post dimensions guide",
        "typography pairing recommendations",
        "free stock photos high quality",
        "presentation design best practices"
      ]
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
      this.error = null
      try {
        const res = await fetch(`/api/query/results/${this.id}`)
        if (!res.ok) {
          if (res.status === 404) throw new Error('Shared results not found')
          throw new Error('Failed to load shared results')
        }
        const data = await res.json()
        this.sharedData = data
        this.searchedQuery = data.query
        this.results = data.results
        this.judgment = data.judgment
      } catch (err) {
        this.error = err.message
      } finally {
        this.loadingShared = false
      }
    },
    setQuery(example) {
      this.query = example
      this.runSearch()
    },
    async runSearch() {
      if (!this.query.trim()) return
      this.loading = true
      this.error = null
      this.results = null
      this.judgment = null
      this.shareUrl = null
      this.searchedQuery = this.query

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: this.query, numResults: 10 })
        })
        if (!res.ok) throw new Error('Search failed')
        this.results = await res.json()
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    async runJudge() {
      if (!this.results) return
      this.judging = true
      try {
        const res = await fetch('/api/judge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: this.searchedQuery,
            parallelResults: this.results.parallel,
            firecrawlResults: this.results.firecrawl,
            exaResults: this.results.exa
          })
        })
        if (!res.ok) throw new Error('Judging failed')
        this.judgment = await res.json()
      } catch (err) {
        this.error = err.message
      } finally {
        this.judging = false
      }
    },
    async shareResults() {
      if (!this.results) return
      this.sharing = true
      this.error = null
      try {
        const res = await fetch('/api/query/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: this.searchedQuery,
            results: this.results,
            judgment: this.judgment
          })
        })
        if (!res.ok) throw new Error('Failed to save results')
        const data = await res.json()
        this.shareUrl = window.location.origin + data.url
      } catch (err) {
        this.error = err.message
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
    truncate(text, length) {
      if (!text) return ''
      return text.length > length ? text.substring(0, length) + '...' : text
    },
    truncateUrl(url) {
      if (!url) return ''
      try {
        const u = new URL(url)
        return u.hostname + (u.pathname.length > 30 ? u.pathname.substring(0, 30) + '...' : u.pathname)
      } catch {
        return url.substring(0, 50)
      }
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
  text-align: center;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(0, 196, 204, 0.2);
  border-top-color: #00C4CC;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.shared-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 12px;
  margin-bottom: 20px;
}

.shared-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.share-date {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.btn-new-query {
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, #00C4CC, #7B2FF7);
  border: none;
  border-radius: 10px;
  color: white;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-new-query:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0, 196, 204, 0.4);
}

.context-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(0, 196, 204, 0.1), rgba(123, 47, 247, 0.05));
  border: 1px solid rgba(0, 196, 204, 0.2);
  border-radius: 12px;
  margin-bottom: 20px;
}

.context-icon {
  font-size: 28px;
}

.context-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.search-section {
  margin-bottom: 20px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  transition: all 0.2s ease;
}

.search-box:focus-within {
  border-color: rgba(0, 196, 204, 0.5);
  box-shadow: 0 0 0 4px rgba(0, 196, 204, 0.1);
}

.search-icon {
  color: rgba(255, 255, 255, 0.4);
}

.search-box input {
  flex: 1;
  padding: 14px 0;
  font-size: 16px;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
}

.search-box input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  font-size: 15px;
  font-weight: 600;
  background: linear-gradient(135deg, #00C4CC, #7B2FF7);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
}

.search-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0, 196, 204, 0.4);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.small {
  width: 16px;
  height: 16px;
}

.example-queries {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 24px;
}

.example-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  margin-right: 4px;
}

.example-btn {
  padding: 8px 14px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.example-btn:hover {
  background: rgba(0, 196, 204, 0.1);
  border-color: rgba(0, 196, 204, 0.3);
  color: #00C4CC;
}

.error-banner {
  padding: 14px 18px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  color: #f87171;
  font-size: 14px;
  margin-bottom: 20px;
}

.query-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.query-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.query-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.4);
}

.query-info h2 {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.judge-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.judge-btn:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.3);
  transform: translateY(-1px);
}

.judge-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.share-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.share-btn:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.3);
  transform: translateY(-1px);
}

.share-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  width: 200px;
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
  background: linear-gradient(135deg, #00C4CC, #7B2FF7);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-copy.copied {
  background: linear-gradient(135deg, #34d399, #10b981);
}

/* Judgment Panel */
.judgment-panel {
  padding: 20px;
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 12px;
  margin-bottom: 24px;
}

.judgment-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.judgment-icon {
  font-size: 24px;
}

.winner-label {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
}

.winner-label strong {
  color: #34d399;
  text-transform: capitalize;
}

.judgment-reasoning {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  margin-bottom: 12px;
}

.judgment-recommendation {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 16px;
}

.score-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.score-card {
  padding: 14px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.score-card.winner {
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.1);
}

.score-provider {
  font-size: 13px;
  font-weight: 600;
  text-transform: capitalize;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}

.score-total {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
}

.score-breakdown {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

/* Results Grid */
.results-grid.four-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.provider-column {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  overflow: hidden;
}

.column-header {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.2);
}

.column-header h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}

.provider-column.parallel .column-header h3 { color: #60a5fa; }
.provider-column.firecrawl .column-header h3 { color: #f97316; }
.provider-column.exa .column-header h3 { color: #34d399; }
.provider-column.openai .column-header h3 { color: #a78bfa; }

.column-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.latency {
  color: rgba(255, 255, 255, 0.6);
}

.provider-error {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: #f87171;
}

.results-list {
  padding: 12px;
  max-height: 600px;
  overflow-y: auto;
}

.synthesized-answer {
  padding: 12px;
  background: rgba(167, 139, 250, 0.1);
  border-radius: 10px;
  margin-bottom: 12px;
}

.synth-label {
  font-size: 11px;
  font-weight: 600;
  color: #a78bfa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.provider-column.openai .synthesized-answer {
  background: rgba(167, 139, 250, 0.1);
}

.synthesized-answer p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
  margin-top: 6px;
}

.result-card {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.result-card:hover {
  background: rgba(255, 255, 255, 0.05);
}

.result-rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #60a5fa;
  text-decoration: none;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-title:hover {
  text-decoration: underline;
}

.result-snippet {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
  margin-bottom: 4px;
}

.result-url {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}

/* Empty State */
.empty-state {
  padding: 60px 20px;
}

.empty-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.empty-card {
  padding: 30px 20px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  text-align: center;
  transition: all 0.2s ease;
}

.empty-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.empty-icon {
  font-size: 36px;
  margin-bottom: 12px;
}

.empty-card h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
}

.empty-card.parallel h4 { color: #60a5fa; }
.empty-card.firecrawl h4 { color: #f97316; }
.empty-card.exa h4 { color: #34d399; }
.empty-card.openai h4 { color: #a78bfa; }

.empty-card p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
}

/* Responsive */
@media (max-width: 1200px) {
  .results-grid.four-columns,
  .empty-grid,
  .score-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .results-grid.four-columns,
  .empty-grid,
  .score-cards {
    grid-template-columns: 1fr;
  }
  
  .query-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .header-actions {
    flex-wrap: wrap;
  }
}
</style>
