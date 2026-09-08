// api/search.js —— Vercel Serverless Function
// 接收 ?site=站源&kw=剧名，在服务端用浏览器头抓取搜索结果页，抽取番剧列表
export default async function handler(req, res) {
  const { site, kw } = req.query;
  if (!site || !kw) return res.json({ ok: 0, msg: '需要 site 和 kw 参数' });

  const base = String(site).replace(/\/+$/, '');
  const e = encodeURIComponent(String(kw));
  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

  // 常见搜索路由，逐个尝试
  const routes = [
    `${base}/search?q=${e}`,
    `${base}/search?keyword=${e}`,
    `${base}/s?q=${e}`,
    `${base}/index.php/search?q=${e}`,
    `${base}/search/${e}`,
  ];

  for (const url of routes) {
    try {
      const html = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: base + '/', 'Accept-Language': 'zh-CN' },
      }).then((r) => (r.ok ? r.text() : Promise.reject('status ' + r.status)));

      const items = parseResults(base, url, html);
      if (items.length) {
        return res.json({ ok: 1, url, items });
      }
    } catch (err) {
      // 换下一个路由
    }
  }
  return res.json({ ok: 0, msg: '未找到结果，可手动填入详情页/播放页链接' });
}

// 用正则从 HTML 里抽 a 标签结果（标题 + 链接 + 封面）
function parseResults(base, pageUrl, html) {
  const out = [];
  const seen = new Set();
  // 匹配 <a ... href="...">...</a>，捕获 href 和标签内文本
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 60) {
    const attrs = m[1];
    const inner = m[2];
    const href = (attrs.match(/\shref\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    const img = (inner.match(/<img[^>]*\ssrc\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    let title = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const low = (href + ' ' + title).toLowerCase();
    if (
      !href ||
      href.startsWith('javascript') ||
      title.length < 2 ||
      !/(show|detail|video|play|info|anime|item|\/d\/|\/v\/|ep|book|post)/.test(low)
    )
      continue;
    const full = safeUrl(pageUrl, href);
    if (!full || seen.has(full)) continue;
    seen.add(full);
    out.push({ title: title.slice(0, 60), url: full, img: img ? safeUrl(pageUrl, img) : '' });
  }
  return out;
}

function safeUrl(base, u) {
  try {
    if (!u) return '';
    return new URL(u, base).href;
  } catch (e) {
    return '';
  }
}
