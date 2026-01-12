<template>
  <div class="how-it-works">
    <div class="page-header">
      <h1>🔍 How This Demo Works</h1>
      <p class="subtitle">Full transparency into how each search provider is called and how results are judged. No tricks, no bias.</p>
    </div>

    <!-- Search Provider Implementations -->
    <section class="code-section">
      <h2>Search Provider Implementations</h2>
      <p class="section-desc">Each provider is called with the same query and result limit. Here's the exact code:</p>

      <div class="code-tabs">
        <button 
          v-for="provider in providers" 
          :key="provider.id"
          @click="activeProvider = provider.id"
          :class="{ active: activeProvider === provider.id }"
          class="tab-btn"
        >
          {{ provider.name }}
        </button>
      </div>

      <div class="code-block">
        <div class="code-header">
          <span class="code-file">{{ activeProviderData.file }}</span>
          <button @click="copyCode(activeProviderData.code)" class="copy-btn" :class="{ copied: copiedCode === activeProvider }">
            {{ copiedCode === activeProvider ? '✓ Copied' : 'Copy' }}
          </button>
        </div>
        <pre><code class="hljs" v-html="highlightedProviderCode"></code></pre>
      </div>
    </section>

    <!-- Judge Prompt -->
    <section class="code-section">
      <h2>LLM Judge Prompt</h2>
      <p class="section-desc">Results are evaluated by GPT-4o using this exact prompt. Note: all providers are scored on identical criteria.</p>

      <div class="code-block judge-prompt">
        <div class="code-header">
          <span class="code-file">server/services/openai.js - judgeResults()</span>
          <button @click="copyCode(judgePrompt)" class="copy-btn" :class="{ copied: copiedCode === 'judge' }">
            {{ copiedCode === 'judge' ? '✓ Copied' : 'Copy' }}
          </button>
        </div>
        <pre><code class="hljs" v-html="highlightedJudgePrompt"></code></pre>
      </div>
    </section>

    <!-- Evaluation Criteria -->
    <section class="criteria-section">
      <h2>Evaluation Criteria</h2>
      <p class="section-desc">Each provider is scored 0-10 on these five dimensions (50 points max):</p>

      <div class="criteria-grid">
        <div class="criteria-card">
          <div class="criteria-icon">🎯</div>
          <h3>Relevance</h3>
          <p>How well do results match what a developer building apps would need?</p>
        </div>
        <div class="criteria-card">
          <div class="criteria-icon">🕐</div>
          <h3>Freshness</h3>
          <p>Are results up-to-date with latest versions and practices?</p>
        </div>
        <div class="criteria-card">
          <div class="criteria-icon">⚡</div>
          <h3>Actionability</h3>
          <p>Can the results directly help generate working code?</p>
        </div>
        <div class="criteria-card">
          <div class="criteria-icon">🏛️</div>
          <h3>Source Quality</h3>
          <p>Are sources authoritative (official docs, reputable tutorials)?</p>
        </div>
        <div class="criteria-card">
          <div class="criteria-icon">📚</div>
          <h3>Coverage</h3>
          <p>Do results cover the topic comprehensively?</p>
        </div>
      </div>
    </section>

    <!-- Architecture -->
    <section class="architecture-section">
      <h2>Architecture Overview</h2>
      <div class="architecture-flow">
        <div class="flow-step">
          <div class="step-num">1</div>
          <div class="step-content">
            <h4>User Query</h4>
            <p>Same query sent to all providers</p>
          </div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-step">
          <div class="step-num">2</div>
          <div class="step-content">
            <h4>Parallel Requests</h4>
            <p>All 4 APIs called simultaneously</p>
          </div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-step">
          <div class="step-num">3</div>
          <div class="step-content">
            <h4>Normalize Results</h4>
            <p>Same format for fair comparison</p>
          </div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-step">
          <div class="step-num">4</div>
          <div class="step-content">
            <h4>GPT-4o Judge</h4>
            <p>Blind evaluation of all results</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import 'highlight.js/styles/github-dark.css'

hljs.registerLanguage('javascript', javascript)

export default {
  data() {
    return {
      activeProvider: 'parallel',
      copiedCode: null,
      providers: [
        { id: 'parallel', name: 'Parallel' },
        { id: 'firecrawl', name: 'Firecrawl' },
        { id: 'exa', name: 'Exa' }
      ],
      providerCode: {
        parallel: {
          file: 'server/services/parallel.js',
          code: `const PARALLEL_API_URL = 'https://api.parallel.ai/v1beta/search';

async function searchParallel(query, numResults = 10) {
  const response = await fetch(PARALLEL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.PARALLEL_API_KEY,
      'parallel-beta': 'search-extract-2025-10-10'
    },
    body: JSON.stringify({
      objective: query,
      search_queries: [query],
      max_results: numResults,
      excerpts: { max_chars_per_result: 5000 }
    })
  });

  const data = await response.json();

  // Normalize to common format
  return {
    provider: 'parallel',
    results: data.results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.excerpts?.join(' ').substring(0, 300),
      publishedDate: r.publish_date
    }))
  };
}`
        },
        firecrawl: {
          file: 'server/services/firecrawl.js',
          code: `const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/search';

async function searchFirecrawl(query, numResults = 10) {
  const response = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${process.env.FIRECRAWL_API_KEY}\`
    },
    body: JSON.stringify({
      query,
      limit: numResults,
      scrapeOptions: { formats: ['markdown'] }
    })
  });

  const data = await response.json();

  // Normalize to common format
  return {
    provider: 'firecrawl',
    results: (data.data || []).map(r => ({
      title: r.metadata?.title || r.title,
      url: r.url || r.metadata?.sourceURL,
      snippet: r.metadata?.description || r.markdown?.substring(0, 300),
      publishedDate: r.metadata?.publishedDate
    }))
  };
}`
        },
        exa: {
          file: 'server/services/exa.js',
          code: `const EXA_API_URL = 'https://api.exa.ai/search';

async function searchExa(query, numResults = 10) {
  const response = await fetch(EXA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.EXA_API_KEY
    },
    body: JSON.stringify({
      query,
      numResults,
      useAutoprompt: true,
      type: 'neural',
      contents: {
        text: { maxCharacters: 500 },
        highlights: true
      }
    })
  });

  const data = await response.json();

  // Normalize to common format
  return {
    provider: 'exa',
    results: (data.results || []).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.text || r.highlights?.join(' '),
      publishedDate: r.publishedDate
    }))
  };
}`
        }
      },
      judgePrompt: `// GPT-4o evaluates ALL providers using identical criteria
// No provider-specific weighting or bias

const prompt = \`You are an expert evaluator comparing search API results 
for an AI-powered app builder called Lovable.dev.

**Query:** "\${query}"

**Parallel Results:**
\${JSON.stringify(parallelResults?.results?.slice(0, 5))}

**Firecrawl Results:**
\${JSON.stringify(firecrawlResults?.results?.slice(0, 5))}

**Exa Results:**
\${JSON.stringify(exaResults?.results?.slice(0, 5))}

**Evaluation Criteria (0-10 each, same for ALL providers):**
1. Relevance - Match to developer needs
2. Freshness - Up-to-date with latest versions
3. Actionability - Helps generate working code
4. Source Quality - Authoritative sources
5. Coverage - Comprehensive topic coverage

Return JSON with scores for each provider and declare winner 
based purely on total score.\`;`
    }
  },
  computed: {
    activeProviderData() {
      return this.providerCode[this.activeProvider]
    },
    highlightedProviderCode() {
      return hljs.highlight(this.activeProviderData.code, { language: 'javascript' }).value
    },
    highlightedJudgePrompt() {
      return hljs.highlight(this.judgePrompt, { language: 'javascript' }).value
    }
  },
  methods: {
    async copyCode(code) {
      try {
        await navigator.clipboard.writeText(code)
        this.copiedCode = this.activeProvider === 'parallel' || this.activeProvider === 'firecrawl' || this.activeProvider === 'exa'
          ? this.activeProvider 
          : 'judge'
        setTimeout(() => { this.copiedCode = null }, 2000)
      } catch (err) {
        console.error('Copy failed', err)
      }
    }
  }
}
</script>

<style scoped>
.how-it-works {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 12px;
}

.subtitle {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  max-width: 600px;
  margin: 0 auto;
}

.code-section, .criteria-section, .architecture-section {
  margin-bottom: 48px;
}

h2 {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 12px;
}

.section-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 20px;
}

.code-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab-btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}

.tab-btn.active {
  background: rgba(255, 56, 92, 0.15);
  border-color: rgba(255, 56, 92, 0.4);
  color: #FF385C;
}

.code-block {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.code-file {
  font-size: 13px;
  font-family: 'SF Mono', Monaco, monospace;
  color: rgba(255, 255, 255, 0.5);
}

.copy-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.copy-btn.copied {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.code-block pre {
  padding: 20px;
  margin: 0;
  overflow-x: auto;
}

.code-block code {
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
  white-space: pre;
}

.judge-prompt pre {
  max-height: 400px;
}

.criteria-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.criteria-card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  text-align: center;
}

.criteria-icon {
  font-size: 28px;
  margin-bottom: 10px;
}

.criteria-card h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #fff;
}

.criteria-card p {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
}

.architecture-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30px 20px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
}

.flow-step {
  display: flex;
  align-items: center;
  gap: 14px;
}

.step-num {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #FF385C, #EC4899);
  border-radius: 50%;
  color: white;
  flex-shrink: 0;
}

.step-content h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.step-content p {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.flow-arrow {
  font-size: 24px;
  color: rgba(255, 255, 255, 0.2);
}

@media (max-width: 1024px) {
  .criteria-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .architecture-flow {
    flex-wrap: wrap;
    gap: 20px;
  }
  
  .flow-arrow {
    display: none;
  }
}

@media (max-width: 768px) {
  .criteria-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .code-tabs {
    flex-wrap: wrap;
  }
}
</style>
