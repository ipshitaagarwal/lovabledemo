const PARALLEL_API_URL = 'https://api.parallel.ai/v1beta/search';

async function searchParallel(query, numResults = 10) {
  const apiKey = process.env.PARALLEL_API_KEY;
  
  if (!apiKey) {
    throw new Error('PARALLEL_API_KEY not configured');
  }

  const startTime = Date.now();

  const response = await fetch(PARALLEL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'parallel-beta': 'search-extract-2025-10-10'
    },
    body: JSON.stringify({
      objective: query,
      search_queries: [query],
      max_results: numResults,
      excerpts: { max_chars_per_result: 5000 }
    })
  });

  const latency = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Parallel API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Normalize results to common format
  const results = (data.results || []).map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: Array.isArray(r.excerpts) ? r.excerpts.join(' ').substring(0, 300) : (r.excerpts || '').substring(0, 300),
    publishedDate: r.publish_date || null
  }));

  return {
    provider: 'parallel',
    query,
    results,
    latency,
    resultCount: results.length
  };
}

module.exports = { searchParallel };
