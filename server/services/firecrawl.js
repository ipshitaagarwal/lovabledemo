const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/search';

async function searchFirecrawl(query, numResults = 10) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  const startTime = Date.now();

  const response = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      query,
      limit: numResults,
      scrapeOptions: {
        formats: ['markdown']
      }
    })
  });

  const latency = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Normalize results to common format
  const results = (data.data || []).map(r => ({
    title: r.metadata?.title || r.title || '',
    url: r.url || r.metadata?.sourceURL || '',
    snippet: r.metadata?.description || r.markdown?.substring(0, 300) || '',
    publishedDate: r.metadata?.publishedDate || null
  }));

  return {
    provider: 'firecrawl',
    query,
    results,
    latency,
    resultCount: results.length
  };
}

module.exports = { searchFirecrawl };
