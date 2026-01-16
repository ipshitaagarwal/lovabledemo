const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

async function judgeResults(query, parallelResults, firecrawlResults, exaResults) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = `You are an expert evaluator comparing search API results for Canva, the visual design and content creation platform.

Canva helps users create stunning visual content including social media posts, presentations, logos, marketing materials, and more. Their search needs include:
- Design inspiration and trends
- Template recommendations
- Color palettes and typography guides
- Stock photos, illustrations, and graphics
- Brand identity and marketing best practices
- Tutorial content for design techniques
- Print and digital media specifications

**Query:** "${query}"

**Parallel Results:**
${JSON.stringify(parallelResults?.results?.slice(0, 5) || [], null, 2)}

**Firecrawl Results:**
${JSON.stringify(firecrawlResults?.results?.slice(0, 5) || [], null, 2)}

**Exa Results:**
${JSON.stringify(exaResults?.results?.slice(0, 5) || [], null, 2)}

**Evaluation Criteria for Visual Design Context:**
1. **Relevance** (0-10): How well do results match what a designer creating visual content would need?
2. **Freshness** (0-10): Are results up-to-date with latest design trends and practices?
3. **Actionability** (0-10): Can the results directly help create better designs or provide usable assets?
4. **Source Quality** (0-10): Are sources authoritative (design blogs, official brand guides, reputable platforms)?
5. **Coverage** (0-10): Do results cover the topic comprehensively with visual examples?

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
  "recommendation": "Brief recommendation for Canva based on this query",
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

  const prompt = `Generate ${count} realistic search queries that designers using Canva (a visual design platform) would ask.

Context: ${description || 'Canva is a visual design platform that helps users create stunning graphics, presentations, social media posts, marketing materials, logos, and more. Users need inspiration, templates, assets, and design guidance.'}

The queries should cover scenarios like:
- Design inspiration and trends (logos, social media, presentations)
- Template discovery for specific use cases
- Color palette and typography recommendations
- Stock photos, illustrations, and graphic elements
- Brand identity and style guide creation
- Social media dimensions and specifications
- Print design requirements (business cards, flyers, posters)
- Marketing and advertising design best practices

Return as JSON array of strings:
["query 1", "query 2", ...]

Make queries specific and realistic - what a designer would actually type.`;

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
