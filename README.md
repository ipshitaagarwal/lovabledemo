# Notion CRM Enrichment Worker — powered by Parallel

A demo showing Parallel's Task API enriching a Notion CRM database. Users add a
row with just a company name; the Worker calls Parallel to research the
company (funding stage, headcount, recent news, key people, ICP fit) and writes
structured fields back into the row.

## What it shows

- **Parallel Task API** with a constrained JSON output schema, so every run
  produces fields that map 1:1 to Notion database columns.
- **Notion API** schema provisioning (idempotent), database scanning, and
  per-page updates.
- A **Worker loop** (`server/worker.js`) for production use, plus an interactive
  **demo UI** for showing live enrichment to prospects.

## Setup

1. Install:
   ```bash
   npm install
   npm run build
   ```

2. Create `.env`:
   ```
   PARALLEL_API_KEY=...        # https://platform.parallel.ai
   NOTION_TOKEN=secret_...     # https://www.notion.so/profile/integrations
   NOTION_DATABASE_ID=...      # optional default; can be set per request in UI
   PORT=3001
   WORKER_INTERVAL_MS=30000    # used by `npm run worker`
   ```

3. Create a Notion database (any title), then **share it with your integration**
   (… menu → Connections → add). Copy the 32-char database ID from the URL.

4. Start the server:
   ```bash
   npm start
   ```
   Open http://localhost:3001.

5. In the UI:
   - Paste the database ID.
   - Click **Provision schema** — adds any missing columns to the DB.
   - Add a row to the DB with a company name (Status = New).
   - Click **Scan & enrich** to run the Worker once.

## Endpoints

- `POST /api/enrich` `{ company, icp? }` — preview enrichment (no Notion write).
- `POST /api/enrich-page` `{ page_id, icp? }` — enrich a specific Notion page.
- `POST /api/setup` `{ database_id }` — provision required properties.
- `POST /api/scan` `{ database_id, icp? }` — scan DB for new rows and enrich.
- `GET /api/schema` — the JSON schema Parallel is constrained to.
- `GET /api/jobs` — recent worker activity (in-memory).

## Production

- Always-on polling: `npm run worker`.
- Or wire a Notion **automation** to POST `{ page_id }` to `/api/enrich-page`
  when a row's Status flips to *New*.

## Notion property schema

The Worker provisions (and writes to) these properties:

| Property            | Type       |
|---------------------|------------|
| Company             | title      |
| Status              | status     |
| Website             | url        |
| Description         | rich_text  |
| Industry            | select     |
| HQ                  | rich_text  |
| Headcount           | select     |
| Funding Stage       | select     |
| Total Funding (USD) | number ($) |
| ICP Score           | number     |
| ICP Rationale       | rich_text  |
| Recent News         | rich_text  |
| Key People          | rich_text  |
| Parallel Run        | url        |
| Enriched At         | date       |
