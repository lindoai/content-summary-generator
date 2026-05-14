# Content Summary Generator

Summarize a public page into concise narrative points and bullets.

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lindoai/content-summary-generator)

## Features

- extracts readable page text
- returns summary sentences and bullet points
- supports Workers AI when `AI` binding is present
- falls back to deterministic extraction when AI is unavailable

## Local development

```bash
npm install
npm run dev
npm run typecheck
```

## Deploy

```bash
npm run deploy
```

## Production env

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

Optional binding:

- `AI`

## API

### GET `/api/summarize?url=https://example.com`

Returns JSON summary output.
