# Canva Search API Comparison

Compare search API providers for Canva: **Parallel vs Firecrawl vs Exa**

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with your API keys:
```
PARALLEL_API_KEY=your_parallel_key
FIRECRAWL_API_KEY=your_firecrawl_key
EXA_API_KEY=your_exa_key
OPENAI_API_KEY=your_openai_key
PORT=3001
```

3. Build client:
```bash
npm run build
```

4. Start server:
```bash
npm start
```

## Features

- **Single Query**: Compare all three providers side-by-side for a single search
- **Test Suite**: Run multiple queries and see aggregate performance
- **GPT-4o Judging**: AI-powered evaluation of search result quality for design contexts
- **Shareable Links**: Share results with others

## Use Cases for Canva

This demo evaluates search providers for design-focused queries such as:
- Design inspiration and trends
- Template recommendations
- Color palettes and typography
- Stock photos and illustrations
- Brand identity guidelines
- Social media specifications
- Print design requirements

## API Keys

- **Parallel**: https://parallel.ai
- **Firecrawl**: https://firecrawl.dev
- **Exa**: https://exa.ai
- **OpenAI**: https://openai.com (for judging)
