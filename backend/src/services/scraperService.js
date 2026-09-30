import * as cheerio from 'cheerio';
import { generateJson } from '../utils/geminiClient.js';

const MAX_BYTES = 1_500_000;
const forbiddenIp = (host) => /^(localhost|127\.|0\.0\.0\.0|::1$|fc|fd|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host);

export function validateCompanyUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Company URL must be an absolute HTTP(S) URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Company URL must use HTTP or HTTPS.');
  }

  if (process.env.NODE_ENV === 'production' && forbiddenIp(url.hostname)) {
    throw new Error('Private and loopback URLs are not allowed in production.');
  }

  return url;
}

async function fetchPage(url, signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'InterviewPrepKit/1.0 (+research for interview preparation)',
        accept: 'text/html,application/xhtml+xml'
      }
    });

    const type = response.headers.get('content-type') || '';
    const length = Number(response.headers.get('content-length') || 0);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!/text\/html|application\/xhtml\+xml/i.test(type) || length > MAX_BYTES) {
      throw new Error('Unsupported or oversized response.');
    }

    const html = await response.text();
    if (Buffer.byteLength(html) > MAX_BYTES) {
      throw new Error('Oversized response.');
    }

    return html;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

function textFromHtml(html) {
  const $= cheerio.load(html);$('script,style,svg,nav,footer,header,noscript,iframe').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);
}

async function allowedByRobots(base, path, signal) {
  try {
    const response = await fetch(new URL('/robots.txt', base), {
      signal,
      headers: { 'user-agent': 'InterviewPrepKit/1.0' }
    });

    if (!response.ok) return true;

    const text = await response.text();
    let applies = false;
    const rules = [];

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*/, '').trim();
      const match = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
      if (!match) continue;

      const key = match[1].toLowerCase();
      const value = match[2].trim();

      if (key === 'user-agent') {
        applies = value === '*' || /InterviewPrepKit/i.test(value);
        continue;
      }

      if (applies && value) rules.push({ type: key, value });
    }

    const matching = rules
      .filter((rule) => path.startsWith(rule.value))
      .sort((a, b) => b.value.length - a.value.length)[0];

    return !matching || matching.type !== 'disallow';
  } catch {
    return true;
  }
}

const linkSelectionSchema = {
  type: 'OBJECT',
  properties: {
    urls: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    }
  },
  required: ['urls']
};

export async function crawlCompanySite(companyUrl, signal) {
  const result = { homepage: '', pages: [], pages_used: [], errors: [] };
  let base;

  try {
    base = validateCompanyUrl(companyUrl);

    if (!(await allowedByRobots(base, base.pathname, signal))) {
      throw new Error('Homepage disallowed by robots.txt.');
    }

    const homeHtml = await fetchPage(base, signal);
    result.homepage = textFromHtml(homeHtml);
    result.pages_used.push(base.toString());

    const $ = cheerio.load(homeHtml);
    const allLinks = $('a[href]')
      .map((_, el) => {
        try {
          const url = new URL($(el).attr('href'), base);
          return { url: url.toString(), text: $(el).text().trim().replace(/\s+/g, ' ') };
        } catch {
          return null;
        }
      })
      .get()
      .filter(Boolean)
      .filter(
        (link) =>
          link.url.startsWith(base.origin) &&
          link.url !== base.toString() &&
          link.text.length > 2
      );

    const uniqueLinks = [...new Map(allLinks.map((link) => [link.url, link])).values()].slice(0, 150);

    let aiSelectedUrls = [];
    if (uniqueLinks.length > 0) {
      try {
        const aiResponse = await generateJson({
          signal,
          schema: linkSelectionSchema,
          prompt: `Review the following links extracted from a company's homepage.
Identify up to 2 URLs that are most likely to contain valuable information for an interview candidate, such as company culture, core values, team structure, engineering practices, careers, or the hiring process.
Return ONLY the exact URLs as they appear in the list.

LINKS:
${JSON.stringify(uniqueLinks)}`
        });

        aiSelectedUrls = (aiResponse.urls || [])
          .filter((url) => uniqueLinks.some((l) => l.url === url))
          .slice(0, 2);
      } catch (error) {
        result.errors.push(`AI link selection failed: ${error.message}`);
      }
    }

    for (const url of aiSelectedUrls) {
      try {
        if (!(await allowedByRobots(base, new URL(url).pathname, signal))) {
          result.errors.push(`${url}: disallowed by robots.txt`);
          continue;
        }

        const html = await fetchPage(url, signal);
        result.pages.push({ url, text: textFromHtml(html) });
        result.pages_used.push(url);
      } catch (error) {
        result.errors.push(`${url}: ${error.message}`);
      }
    }
  } catch (error) {
    result.errors.push(error.message);
  }

  return result;
}