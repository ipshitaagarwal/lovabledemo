const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

async function judgeResults(query, parallelResults, firecrawlResults, exaResults) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = `You are an expert evaluator comparing search API results for an AI-powered app builder called Lovable.dev.

Lovable.dev helps users build apps through natural language prompts. Their search needs include:
- Technical documentation lookups
- Code examples and snippets
- API references
- Framework guides (React, Vue, Next.js, etc.)
- UI component libraries
- Design patterns and best practices

**Query:** "${query}"

**Parallel Results:**
${JSON.stringify(parallelResults?.results?.slice(0, 5) || [], null, 2)}

**Firecrawl Results:**
${JSON.stringify(firecrawlResults?.results?.slice(0, 5) || [], null, 2)}

**Exa Results:**
${JSON.stringify(exaResults?.results?.slice(0, 5) || [], null, 2)}

**Evaluation Criteria for App Building Context:**
1. **Relevance** (0-10): How well do results match what a developer building apps would need?
2. **Freshness** (0-10): Are results up-to-date with latest versions/practices?
3. **Actionability** (0-10): Can the results directly help generate working code?
4. **Source Quality** (0-10): Are sources authoritative (official docs, reputable tutorials)?
5. **Coverage** (0-10): Do results cover the topic comprehensively?

Provide your evaluation as JSON:
{
  "parallel": {
    "scores": { "relevance": X, "freshness": X, "actionability": X, "sourceQuality": X, "coverage": X },
    "totalScore": X,
    "strengths": ["..."],
    "weaknesses": ["..."]
  },
  "firecrawl": {
    "scores": { "relevance": X, "freshness": X, "actionability": X, "sourceQuality": X, "coverage": X },
    "totalScore": X,
    "strengths": ["..."],
    "weaknesses": ["..."]
  },
  "exa": {
    "scores": { "relevance": X, "freshness": X, "actionability": X, "sourceQuality": X, "coverage": X },
    "totalScore": X,
    "strengths": ["..."],
    "weaknesses": ["..."]
  },
  "winner": "parallel" | "firecrawl" | "exa" | "tie",
  "recommendation": "Brief recommendation for Lovable.dev based on this query",
  "reasoning": "2-3 sentence explanation of the winner choice"
}`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a technical search quality evaluator. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  
  try {
    // Try to parse the JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (e) {
    return { error: 'Failed to parse judgment', raw: content };
  }
}

async function generateTestSuite(description, count = 10) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = `Generate ${count} realistic search queries that developers using Lovable.dev (an AI app builder) would ask.

Context: ${description || 'Lovable.dev is an AI-powered platform that lets users build full-stack web applications through natural language prompts. Users describe what they want, and Lovable generates the code.'}

The queries should cover scenarios like:
- Looking up React/Next.js/Vue component patterns
- Finding API documentation
- Searching for UI library components (Tailwind, shadcn, etc.)
- Database integration guides
- Authentication implementation
- Deployment and hosting solutions
- Performance optimization techniques
- Error debugging and troubleshooting

Return as JSON array of strings:
["query 1", "query 2", ...]

Make queries specific and realistic - what a developer would actually type.`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '[]';
  
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

module.exports = { judgeResults, generateTestSuite };
