const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/search';

async function searchFirecrawl(query, numResults = 10) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  const startTime = Date.now();

  // Add timeout of 30 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query,
        limit: numResults
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Firecrawl] API error for "${query}": ${response.status} - ${errorText}`);
      throw new Error(`Firecrawl API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Firecrawl] Got ${data.data?.length || 0} results for "${query}" in ${latency}ms`);

    // Normalize results to common format
    const results = (data.data || []).map(r => ({
      title: r.metadata?.title || r.title || '',
      url: r.url || r.metadata?.sourceURL || '',
      snippet: r.metadata?.description || (r.markdown ? r.markdown.substring(0, 300) : '') || '',
      publishedDate: r.metadata?.publishedDate || null
    }));

    return {
      provider: 'firecrawl',
      query,
      results,
      latency,
      resultCount: results.length
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`[Firecrawl] Timeout for "${query}"`);
      throw new Error('Firecrawl timeout (>30s)');
    }
    throw err;
  }
}

module.exports = { searchFirecrawl };
