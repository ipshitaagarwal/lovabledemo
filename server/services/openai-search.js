const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

async function searchOpenAI(query, numResults = 10) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const startTime = Date.now();

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' }],
      input: query
    })
  });

  const latency = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract URLs from the response
  const results = [];
  const outputText = data.output_text || '';
  
  // Look for annotations with URL citations
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.annotations) {
            for (const ann of content.annotations) {
              if (ann.type === 'url_citation' && ann.url) {
                results.push({
                  title: ann.title || 'Source',
                  url: ann.url,
                  snippet: '',
                  publishedDate: null
                });
              }
            }
          }
        }
      }
    }
  }

  return {
    provider: 'openai',
    query,
    results: results.slice(0, numResults),
    latency,
    resultCount: results.length,
    synthesizedAnswer: outputText.substring(0, 500)
  };
}

module.exports = { searchOpenAI };
