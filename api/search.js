// api/search.js —— 4kcz.com 专用搜索接口
import { parseSearch, headers } from './parser.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const site = (req.query.site || 'https://www.4kcz.com/').replace(/\/+$/, '');
  const kw = (req.query.kw || '').trim();
  if (!kw) return res.status(200).json({ ok: 0, msg: '请输入剧名' });

  // 4kcz 为 maccms：搜索路由 /vod/search/wd/{kw}.html
  const e = encodeURIComponent(kw);
  const searchUrl = `${site}/vod/search/wd/${e}.html`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(searchUrl, { headers: headers(site), signal: ctrl.signal });
    clearTimeout(timer);
    const html = await r.text();
    const list = parseSearch(html, searchUrl, site);
    return res.status(200).json({ ok: 1, site, kw, searchUrl, count: list.length, list });
  } catch (err) {
    return res.status(200).json({ ok: 0, msg: '搜索抓取失败：' + err.message, searchUrl });
  }
}
