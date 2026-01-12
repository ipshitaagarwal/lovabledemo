const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

async function searchPerplexity(query, numResults = 10) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const startTime = Date.now();

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful search assistant. Return relevant information with citations.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: 1024,
      return_citations: true,
      return_related_questions: false
    })
  });

  const latency = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract citations and create results
  const citations = data.citations || [];
  const content = data.choices?.[0]?.message?.content || '';

  // Normalize results to common format
  const results = citations.slice(0, numResults).map((url, idx) => ({
    title: `Source ${idx + 1}`,
    url: url,
    snippet: '',
    publishedDate: null
  }));

  return {
    provider: 'perplexity',
    query,
    results,
    latency,
    resultCount: results.length,
    synthesizedAnswer: content
  };
}

module.exports = { searchPerplexity };
