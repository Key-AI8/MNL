// api/parser.js —— 4kcz.com 专用解析（maccms 体系）
// 搜索：/vod/search/wd/{kw}.html  详情：/vod/detail/id/{id}.html  播放：/vod/play/...

export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const headers = (ref) => ({ 'User-Agent': UA, 'Referer': ref || 'https://www.4kcz.com/' });

export function abs(base, u) {
  if (!u) return '';
  try { return new URL(u, base).href; } catch (e) { return u; }
}
export function clean(s) { return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

export function extractLinks(html) {
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const out = []; let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1], inner = m[2];
    const href = (attrs.match(/\bhref\s*=\s*"([^"]*)"/i) || [])[1] || '';
    const titleAttr = (attrs.match(/\btitle\s*=\s*"([^"]*)"/i) || [])[1] || '';
    const img = inner.match(/<img\b[^>]*\b(?:data-src|src)\s*=\s*"([^"]*)"/i);
    const cover = img ? img[1] : '';
    const text = clean(inner) || titleAttr;
    out.push({ href, text, cover });
  }
  return out;
}

// 搜索结果 -> 影视卡片列表
export function parseSearch(html, pageUrl, site) {
  const seen = new Set(); const list = [];
  for (const { href, text, cover } of extractLinks(html)) {
    if (!/\/vod\/(detail|show)\b/i.test(href) && !/detail.*\.html/i.test(href)) continue;
    if (text.length < 2) continue;
    const full = abs(pageUrl, href);
    if (!full.startsWith('http') || seen.has(full)) continue;
    seen.add(full);
    list.push({ title: text.slice(0, 60), url: full, cover: abs(pageUrl, cover) });
    if (list.length >= 40) break;
  }
  return list;
}

// 详情页 -> 选集
export function parseDetail(html, pageUrl) {
  const seen = new Set(); const eps = [];
  const direct = html.match(/https?:\/\/[^"'\s<>\$]+?\.(m3u8|mp4|webm)(?:\?[^"'\s<>\$]*)?/gi) || [];
  for (const u of direct) {
    const url = abs(pageUrl, u);
    if (seen.has(url)) continue;
    seen.add(url);
    eps.push({ name: '直链 ' + url.split('/').pop().slice(0, 30), url, direct: true });
  }
  for (const { href, text } of extractLinks(html)) {
    const low = (href + ' ' + text).toLowerCase();
    if (!/play|ep|第.+集|episode|\$/.test(low) && !/\.(m3u8|mp4)/i.test(href)) continue;
    if (!href || href.startsWith('javascript')) continue;
    const url = abs(pageUrl, href);
    if (!url.startsWith('http') || seen.has(url)) continue;
    seen.add(url);
    eps.push({ name: text.slice(0, 30) || url.split('/').pop(), url });
    if (eps.length >= 100) break;
  }
  return eps;
}

export function parseVideo(html, pageUrl) {
  const m = html.match(/https?:\/\/[^"'\s<>\$]+?\.(m3u8|mp4|webm)(?:\?[^"'\s<>\$]*)?/i);
  return m ? abs(pageUrl, m[0]) : '';
}
