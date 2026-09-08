// api/detail.js —— 详情/选集接口
import { parseDetail, headers } from './parser.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const url = (req.query.url || '').trim();
  if (!url) return res.status(200).json({ ok: 0, msg: '缺少详情页url' });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, { headers: headers(new URL(url).origin), signal: ctrl.signal });
    clearTimeout(timer);
    const html = await r.text();
    const eps = parseDetail(html, url);
    return res.status(200).json({ ok: 1, url, count: eps.length, eps });
  } catch (err) {
    return res.status(200).json({ ok: 0, msg: '详情抓取失败：' + err.message });
  }
}
