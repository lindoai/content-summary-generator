import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseHTML } from 'linkedom';
import { readTurnstileTokenFromUrl, verifyTurnstileToken } from '../../_shared/turnstile';
import { renderTextToolPage, turnstileSiteKeyFromEnv } from '../../_shared/tool-page';

type Env = { Bindings: { AI?: Ai; TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string } };

const app = new Hono<Env>();
app.use('/api/*', cors());
app.get('/', (c) => c.html(renderTextToolPage({ title: 'Content Summary Generator', description: 'Summarize a public page into concise bullets and short narrative sentences.', endpoint: '/api/summarize', sample: '{ "summary": ["..."], "bullets": ["..."] }', siteKey: turnstileSiteKeyFromEnv(c.env), buttonLabel: 'Summarize', toolSlug: 'content-summary-generator' })));
app.get('/health', (c) => c.json({ ok: true }));
app.get('/api/summarize', async (c) => {
  const captcha = await verifyTurnstileToken(c.env, readTurnstileTokenFromUrl(c.req.url), c.req.header('CF-Connecting-IP'));
  if (!captcha.ok) return c.json({ error: captcha.error }, 403);
  const normalized = normalizeUrl(c.req.query('url') ?? '');
  if (!normalized) return c.json({ error: 'A valid http(s) URL is required.' }, 400);
  const html = await fetchHtml(normalized);
  if (!html) return c.json({ error: 'Failed to fetch page.' }, 502);
  const { document } = parseHTML(html);
  document.querySelectorAll('script, style, noscript').forEach((el: any) => el.remove());
  const root = document.querySelector('article, main, [role="main"]') ?? document.body;
  const text = (root?.textContent || '').replace(/\s+/g, ' ').trim();
  const headings = [...document.querySelectorAll('h1,h2,h3')].map((el: any) => (el.textContent || '').trim()).filter(Boolean).slice(0, 8);
  const fallback = heuristicSummary(text, headings);
  const aiSummary = c.env.AI ? await summarizeWithWorkersAI(c.env.AI, document.title || '', text, headings).catch(() => null) : null;
  return c.json({ url: normalized, title: document.title || '', wordCount: text ? text.split(/\s+/).length : 0, summary: aiSummary?.summary ?? fallback.summary, bullets: aiSummary?.bullets ?? fallback.bullets, headings, usedAI: Boolean(aiSummary) });
});

async function summarizeWithWorkersAI(ai: Ai, title: string, text: string, headings: string[]) {
  const prompt = `Summarize this webpage. Return strict JSON with shape {"summary":[string,string,string],"bullets":[string,string,string,string,string]}. Keep it concise and factual.\n\nTitle: ${title}\nHeadings: ${headings.join(' | ')}\n\nContent:\n${text.slice(0, 10000)}`;
  const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', { prompt }) as { response?: string };
  const match = result.response?.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]) as { summary?: string[]; bullets?: string[] };
  return { summary: (parsed.summary ?? []).slice(0, 3), bullets: (parsed.bullets ?? []).slice(0, 5) };
}

function heuristicSummary(text: string, headings: string[]) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s: string) => s.length > 60).slice(0, 5);
  return { summary: sentences.slice(0, 3), bullets: headings.slice(0, 5) };
}

async function fetchHtml(url: string) { const r = await fetch(url, { headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Lindo Free Tools/1.0 (+https://lindo.ai/tools)' } }).catch(() => null); return r?.ok ? r.text() : null; }
function normalizeUrl(value: string): string | null { try { return new URL(value.startsWith('http') ? value : `https://${value}`).toString(); } catch { return null; } }
export default app;
