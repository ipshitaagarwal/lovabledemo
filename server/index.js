require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { searchParallel } = require('./services/parallel');
const { searchFirecrawl } = require('./services/firecrawl');
const { searchExa } = require('./services/exa');
const { searchOpenAI } = require('./services/openai-search');
const { judgeResults, generateTestSuite } = require('./services/openai');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Results storage directory
const RESULTS_DIR = path.join(__dirname, '../results');
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Search endpoint - runs all four providers in parallel
app.post('/api/search', async (req, res) => {
  try {
    const { query, numResults = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`[Search] Query: "${query}"`);

    // Run all searches in parallel
    const [parallelResult, firecrawlResult, exaResult, openaiResult] = await Promise.allSettled([
      searchParallel(query, numResults),
      searchFirecrawl(query, numResults),
      searchExa(query, numResults),
      searchOpenAI(query, numResults)
    ]);

    const response = {
      query,
      timestamp: new Date().toISOString(),
      parallel: parallelResult.status === 'fulfilled' ? parallelResult.value : { error: parallelResult.reason?.message },
      firecrawl: firecrawlResult.status === 'fulfilled' ? firecrawlResult.value : { error: firecrawlResult.reason?.message },
      exa: exaResult.status === 'fulfilled' ? exaResult.value : { error: exaResult.reason?.message },
      openai: openaiResult.status === 'fulfilled' ? openaiResult.value : { error: openaiResult.reason?.message }
    };

    console.log(`[Search] Complete - Parallel: ${response.parallel.latency || 'error'}ms, Firecrawl: ${response.firecrawl.latency || 'error'}ms, Exa: ${response.exa.latency || 'error'}ms, OpenAI: ${response.openai.latency || 'error'}ms`);

    res.json(response);
  } catch (err) {
    console.error('[Search] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Judge endpoint - compares results using GPT-4o
app.post('/api/judge', async (req, res) => {
  try {
    const { query, parallelResults, firecrawlResults, exaResults, openaiResults } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`[Judge] Evaluating results for: "${query}"`);

    const judgment = await judgeResults(query, parallelResults, firecrawlResults, exaResults, openaiResults);

    console.log(`[Judge] Winner: ${judgment.winner}`);

    res.json(judgment);
  } catch (err) {
    console.error('[Judge] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate test suite
app.post('/api/test-suite/generate', async (req, res) => {
  try {
    const { description, count = 10 } = req.body;

    console.log(`[TestSuite] Generating ${count} queries`);

    const queries = await generateTestSuite(description, count);

    res.json({ queries });
  } catch (err) {
    console.error('[TestSuite] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Run test suite - returns all results at once
app.post('/api/test-suite/run', async (req, res) => {
  try {
    const { queries } = req.body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'Queries array is required' });
    }

    console.log(`[TestSuite] Running ${queries.length} queries`);

    const results = [];
    const summary = {
      total: queries.length,
      parallelWins: 0,
      firecrawlWins: 0,
      exaWins: 0,
      openaiWins: 0,
      ties: 0,
      avgLatency: { parallel: 0, firecrawl: 0, exa: 0, openai: 0 }
    };

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`[TestSuite] Processing ${i + 1}/${queries.length}: "${query}"`);

      try {
        // Search all providers
        const [parallelResult, firecrawlResult, exaResult, openaiResult] = await Promise.allSettled([
          searchParallel(query, 10),
          searchFirecrawl(query, 10),
          searchExa(query, 10),
          searchOpenAI(query, 10)
        ]);

        const searchResults = {
          parallel: parallelResult.status === 'fulfilled' ? parallelResult.value : { error: parallelResult.reason?.message },
          firecrawl: firecrawlResult.status === 'fulfilled' ? firecrawlResult.value : { error: firecrawlResult.reason?.message },
          exa: exaResult.status === 'fulfilled' ? exaResult.value : { error: exaResult.reason?.message },
          openai: openaiResult.status === 'fulfilled' ? openaiResult.value : { error: openaiResult.reason?.message }
        };

        // Judge results
        const judgment = await judgeResults(
          query,
          searchResults.parallel,
          searchResults.firecrawl,
          searchResults.exa,
          searchResults.openai
        );

        // Update summary
        if (judgment.winner === 'parallel') summary.parallelWins++;
        else if (judgment.winner === 'firecrawl') summary.firecrawlWins++;
        else if (judgment.winner === 'exa') summary.exaWins++;
        else if (judgment.winner === 'openai') summary.openaiWins++;
        else summary.ties++;

        if (searchResults.parallel?.latency) summary.avgLatency.parallel += searchResults.parallel.latency;
        if (searchResults.firecrawl?.latency) summary.avgLatency.firecrawl += searchResults.firecrawl.latency;
        if (searchResults.exa?.latency) summary.avgLatency.exa += searchResults.exa.latency;
        if (searchResults.openai?.latency) summary.avgLatency.openai += searchResults.openai.latency;

        results.push({
          query,
          searchResults,
          judgment
        });

      } catch (err) {
        console.error(`[TestSuite] Error for query "${query}":`, err);
        results.push({ query, error: err.message });
      }
    }

    // Calculate averages
    const validCount = results.filter(r => !r.error).length;
    if (validCount > 0) {
      summary.avgLatency.parallel = Math.round(summary.avgLatency.parallel / validCount);
      summary.avgLatency.firecrawl = Math.round(summary.avgLatency.firecrawl / validCount);
      summary.avgLatency.exa = Math.round(summary.avgLatency.exa / validCount);
      summary.avgLatency.openai = Math.round(summary.avgLatency.openai / validCount);
    }

    console.log(`[TestSuite] Complete - Winner counts: Parallel=${summary.parallelWins}, Firecrawl=${summary.firecrawlWins}, Exa=${summary.exaWins}, OpenAI=${summary.openaiWins}`);

    res.json({ type: 'complete', summary, results });

  } catch (err) {
    console.error('[TestSuite] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save single query results
app.post('/api/query/save', async (req, res) => {
  try {
    const { query, results, judgment } = req.body;

    if (!query || !results) {
      return res.status(400).json({ error: 'Query and results are required' });
    }

    const id = 'q-' + crypto.randomBytes(4).toString('hex');
    
    const data = {
      id,
      type: 'single-query',
      createdAt: new Date().toISOString(),
      query,
      results,
      judgment: judgment || null
    };

    const filePath = path.join(RESULTS_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    res.json({ id, url: `/q/${id}` });
  } catch (err) {
    console.error('Save query results error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single query results
app.get('/api/query/results/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(RESULTS_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Results not found' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(data);
  } catch (err) {
    console.error('Get query results error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save test suite results
app.post('/api/test-suite/save', async (req, res) => {
  try {
    const { summary, results } = req.body;

    if (!summary || !results) {
      return res.status(400).json({ error: 'Summary and results are required' });
    }

    const id = 'ts-' + crypto.randomBytes(4).toString('hex');
    
    const data = {
      id,
      type: 'test-suite',
      createdAt: new Date().toISOString(),
      summary,
      results
    };

    const filePath = path.join(RESULTS_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    res.json({ id, url: `/suite/${id}` });
  } catch (err) {
    console.error('Save test suite error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get test suite results
app.get('/api/test-suite/results/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(RESULTS_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Results not found' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(data);
  } catch (err) {
    console.error('Get test suite results error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Lovable Search Demo server running on port ${PORT}`);
  console.log(`   Comparing: Parallel vs Firecrawl vs Exa vs OpenAI`);
});
