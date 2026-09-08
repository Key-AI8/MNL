// 本地测试用：用 node 内置 fetch 起一个简易服务，模拟 Vercel 三个 API
// 依赖 node >=18（自带 fetch）。运行：node server.js，访问 http://localhost:3000
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function safeUrl(base, u) { try { return u ? new URL(u, base).href : ''; } catch (e) { return ''; } }

async function fetchPage(url, ref) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: ref || url, 'Accept-Language': 'zh-CN' }, timeout: 15000 });
  if (!r.ok) throw new Error('status ' + r.status);
  return r.text();
}

function parseResults(base, pageUrl, html) {
  const out = [], seen = new Set();
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html)) && out.length < 60) {
    const attrs = m[1], inner = m[2];
    const href = (attrs.match(/\shref\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    const img = (inner.match(/<img[^>]*\ssrc\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    let title = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const low = (href + ' ' + title).toLowerCase();
    if (!href || href.startsWith('javascript') || title.length < 2 ||
      !/(show|detail|video|play|info|anime|item|\/d\/|\/v\/|ep|book|post)/.test(low)) continue;
    const full = safeUrl(pageUrl, href);
    if (!full || seen.has(full)) continue;
    seen.add(full);
    out.push({ title: title.slice(0, 60), url: full, img: img ? safeUrl(pageUrl, img) : '' });
  }
  return out;
}

function parseEpisodes(pageUrl, html) {
  const out = [], seen = new Set();
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html)) && out.length < 120) {
    const attrs = m[1], inner = m[2];
    const href = (attrs.match(/\shref\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    let name = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const low = (href + ' ' + inner).toLowerCase();
    if (!href || href.startsWith('javascript')) continue;
    if (/\.(m3u8|mp4|webm)(\?|$)/i.test(href)) {
      const u = safeUrl(pageUrl, href);
      if (u && !seen.has(u)) { seen.add(u); out.push({ name: name || u.split('/').pop(), url: u, type: 'video' }); }
      continue;
    }
    if (/play|ep|video|第.+集|episode|\/v\/|\/d\/|m3u8/.test(low)) {
      const u = safeUrl(pageUrl, href);
      if (u && u.startsWith('http') && !seen.has(u)) { seen.add(u); out.push({ name: name || u, url: u, type: 'page' }); }
    }
  }
  return out;
}

function parseDirect(pageUrl, html) {
  const seen = new Set(), list = [];
  const re = /https?:\/\/[^"'\s<>]+\.(m3u8|mp4|webm)(?:\?[^"'\s<>]*)?/gi; let m;
  while ((m = re.exec(html))) {
    const u = safeUrl(pageUrl, m[0]);
    if (u && !seen.has(u)) { seen.add(u); list.push({ name: m[0].split('/').pop(), url: u, type: 'video' }); }
  }
  return list.slice(0, 20);
}

const server = http.createServer(async (req, res) => {
  const { url, method } = req;
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(data)); };

  try {
    if (url.startsWith('/api/search')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const site = params.get('site'), kw = params.get('kw');
      if (!site || !kw) return send(400, { ok: 0, msg: '需要 site 和 kw' });
      const base = site.replace(/\/+$/, ''), e = encodeURIComponent(kw);
      const routes = [`${base}/search?q=${e}`, `${base}/search?keyword=${e}`, `${base}/s?q=${e}`, `${base}/index.php/search?q=${e}`, `${base}/search/${e}`];
      for (const u of routes) {
        try { const html = await fetchPage(u, base); const items = parseResults(base, u, html); if (items.length) return send(200, { ok: 1, url: u, items }); } catch (e) {}
      }
      return send(200, { ok: 0, msg: '未找到结果' });
    }

    if (url.startsWith('/api/detail')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const target = params.get('url');
      if (!target) return send(400, { ok: 0, msg: '需要 url' });
      const html = await fetchPage(target, new URL(target).origin + '/');
      return send(200, { ok: 1, eps: parseEpisodes(target, html), direct: parseDirect(target, html) });
    }

    if (url.startsWith('/api/proxy')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const target = decodeURIComponent(params.get('url') || ''), ref = params.get('ref') ? decodeURIComponent(params.get('ref')) : new URL(target).origin + '/';
      const upstream = await fetch(target, { headers: { 'User-Agent': UA, Referer: ref } });
      const ctype = upstream.headers.get('content-type') || '';
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': ctype || 'application/octet-stream' });
      const buf = await upstream.arrayBuffer();
      return res.end(Buffer.from(buf));
    }

    // 其他请求返回前端页面
    const html = readFileSync(join(__dirname, 'index.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    send(500, { ok: 0, msg: 'error: ' + err.message });
  }
});

server.listen(3000, () => console.log('本地测试：http://localhost:3000 （改hosts可绑手机IP在手机测）'));
