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
  
  // Debug log
  console.log('[OpenAI Search] Response structure:', JSON.stringify(data, null, 2).substring(0, 1000));

  // Extract URLs from the response - handle various response formats
  const results = [];
  const outputText = data.output_text || '';
  
  // Method 1: Look for annotations in output array
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      // Handle message type
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.annotations && Array.isArray(content.annotations)) {
            for (const ann of content.annotations) {
              if (ann.url) {
                results.push({
                  title: ann.title || extractDomain(ann.url),
                  url: ann.url,
                  snippet: ann.text || '',
                  publishedDate: null
                });
              }
            }
          }
        }
      }
      // Handle web_search_call type
      if (item.type === 'web_search_call' && item.results) {
        for (const r of item.results) {
          results.push({
            title: r.title || extractDomain(r.url),
            url: r.url,
            snippet: r.snippet || r.content || '',
            publishedDate: null
          });
        }
      }
    }
  }

  // Method 2: Check for citations array directly
  if (data.citations && Array.isArray(data.citations)) {
    for (const url of data.citations) {
      if (!results.find(r => r.url === url)) {
        results.push({
          title: extractDomain(url),
          url: url,
          snippet: '',
          publishedDate: null
        });
      }
    }
  }

  // Method 3: Extract URLs from output_text using regex
  if (results.length === 0 && outputText) {
    const urlRegex = /https?:\/\/[^\s\]\)]+/g;
    const urls = outputText.match(urlRegex) || [];
    for (const url of [...new Set(urls)].slice(0, numResults)) {
      results.push({
        title: extractDomain(url),
        url: url,
        snippet: '',
        publishedDate: null
      });
    }
  }

  console.log(`[OpenAI Search] Found ${results.length} results`);

  return {
    provider: 'openai',
    query,
    results: results.slice(0, numResults),
    latency,
    resultCount: results.length,
    synthesizedAnswer: outputText.substring(0, 500)
  };
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Source';
  }
}

module.exports = { searchOpenAI };
