// 测试抽取逻辑：复用 api 里的正则解析，用模拟 HTML 验证
import { readFileSync } from 'node:fs';

// --- 从 search.js / detail.js 抽出可复用的纯函数（逻辑对齐）---
function safeUrl(base, u) { try { return u ? new URL(u, base).href : ''; } catch (e) { return ''; } }

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

// --- 模拟 HTML 用例 ---
const base = 'https://www.example.com';

const searchHtml = `
  <div class="list">
    <a href="/show/123" class="item">
      <img src="/uploads/cover.jpg">
      <span class="title">进击的巨人 最终季</span>
    </a>
    <a href="/show/456" class="item">
      <img src="/uploads/cover2.jpg">
      <span class="title">咒术回战</span>
    </a>
    <a href="/page/about">关于我们</a>
    <a href="javascript:void(0)">广告</a>
  </div>
`;

const detailHtml = `
  <div class="player"><video src="https://cdn.example.com/intro.mp4"></video></div>
  <div class="ep-list">
    <a href="https://cdn.example.com/ep1.m3u8">第1集</a>
    <a href="/play/2">第2集</a>
    <a href="/play/3" class="ep">第3集 EP03</a>
    <a href="https://cdn.example.com/ep4.mp4">第4集</a>
  </div>
  <script>var src = "https://hidden.example.com/master.m3u8?token=abc";</script>
`;

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } }

console.log('测试搜索页抽取...');
const items = parseResults(base, base + '/search?q=test', searchHtml);
assert(items.length === 2, `应抽到2个番剧，实际 ${items.length}`);
assert(items[0].title.includes('进击的巨人'), '标题应含进击的巨人');
assert(items[0].url === 'https://www.example.com/show/123', '链接应补全绝对地址');
assert(items[0].img === 'https://www.example.com/uploads/cover.jpg', '封面应补全绝对地址');
assert(items.every(i => i.url.startsWith('http')), '所有链接应为绝对地址');

console.log('测试详情页抽取...');
const eps = parseEpisodes(base + '/detail/123', detailHtml);
assert(eps.length === 4, `应抽到4个选集，实际 ${eps.length}`);
assert(eps.filter(e => e.type === 'video').length === 2, '应识别出2个直链(video)');
assert(eps.find(e => e.name.includes('第2集') && e.type === 'page'), '第2集应为page类型');
assert(eps.find(e => e.url === 'https://cdn.example.com/ep1.m3u8'), '应保留m3u8直链');

console.log('测试直链抽取...');
const direct = parseDirect(base + '/detail/123', detailHtml);
assert(direct.some(d => d.url.includes('intro.mp4')), '应抽到video标签的mp4');
assert(direct.some(d => d.url.includes('master.m3u8')), '应抽到JS里的m3u8');

console.log(`\n结果：${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
