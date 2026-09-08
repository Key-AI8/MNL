// api/home.js —— 首页影视列表
import { parseSearch, headers } from './parser.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  const site = (req.query.site || 'https://www.4kcz.com/').replace(/\/+$/, '');

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(site + '/', { headers: headers(site), signal: ctrl.signal });
    clearTimeout(timer);
    const html = await r.text();
    const list = parseSearch(html, site + '/', site);
    return res.status(200).json({ ok: 1, site, count: list.length, list });
  } catch (err) {
    return res.status(200).json({ ok: 0, msg: '首页抓取失败：' + err.message });
  }
}
