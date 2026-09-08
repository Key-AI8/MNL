// api/detail.js —— Vercel Serverless Function
// 接收 ?url=详情页链接，抓取并抽取选集列表 + 页面内直链视频
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.json({ ok: 0, msg: '需要 url 参数' });

  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

  let html;
  try {
    html = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: new URL(url).origin + '/', 'Accept-Language': 'zh-CN' },
    }).then((r) => (r.ok ? r.text() : Promise.reject('status ' + r.status)));
  } catch (err) {
    return res.json({ ok: 0, msg: '抓取失败：' + err });
  }

  const eps = parseEpisodes(url, html);
  const direct = parseDirect(url, html);

  return res.json({ ok: 1, eps, direct });
}

// 抽取选集：a 标签里含 .m3u8/.mp4 直链，或带 play/ep/episode/第N集 的链接
function parseEpisodes(pageUrl, html) {
  const out = [];
  const seen = new Set();
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 120) {
    const attrs = m[1];
    const inner = m[2];
    const href = (attrs.match(/\shref\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    const low = (href + ' ' + inner).toLowerCase();
    let name = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!href || href.startsWith('javascript')) continue;

    // 直链：.m3u8/.mp4/.webm
    if (/\.(m3u8|mp4|webm)(\?|$)/i.test(href)) {
      const u = safeUrl(pageUrl, href);
      if (u && !seen.has(u)) {
        seen.add(u);
        out.push({ name: name || u.split('/').pop(), url: u, type: 'video' });
      }
      continue;
    }
    // 选集链接
    if (/play|ep|video|第.+集|episode|\/v\/|\/d\/|m3u8/.test(low)) {
      const u = safeUrl(pageUrl, href);
      if (u && u.startsWith('http') && !seen.has(u)) {
        seen.add(u);
        out.push({ name: name || u, url: u, type: 'page' });
      }
    }
  }
  return out;
}

// 页面内直接出现的 video/source/JS 里的视频地址
function parseDirect(pageUrl, html) {
  const list = [];
  const seen = new Set();
  const re = /https?:\/\/[^"'\s<>]+\.(m3u8|mp4|webm)(?:\?[^"'\s<>]*)?/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = safeUrl(pageUrl, m[0]);
    if (u && !seen.has(u)) {
      seen.add(u);
      list.push({ name: m[0].split('/').pop(), url: u, type: 'video' });
    }
  }
  return list.slice(0, 20);
}

function safeUrl(base, u) {
  try {
    if (!u) return '';
    return new URL(u, base).href;
  } catch (e) {
    return '';
  }
}
