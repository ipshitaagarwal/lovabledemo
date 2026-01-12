const EXA_API_URL = 'https://api.exa.ai/search';

async function searchExa(query, numResults = 10) {
  const apiKey = process.env.EXA_API_KEY;
  
  if (!apiKey) {
    throw new Error('EXA_API_KEY not configured');
  }

  const startTime = Date.now();

  const response = await fetch(EXA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
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

  const latency = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Exa API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Normalize results to common format
  const results = (data.results || []).map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.text || r.highlights?.join(' ') || '',
    publishedDate: r.publishedDate || null
  }));

  return {
    provider: 'exa',
    query,
    results,
    latency,
    resultCount: results.length
  };
}

module.exports = { searchExa };
