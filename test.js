// test.js —— 端到端测试（用真实 4kcz 结构片段模拟 fetch）
import { parseSearch, parseDetail, parseVideo, headers } from './api/parser.js';

// 模拟 4kcz 搜索结果页的真实 HTML 结构
const SEARCH_HTML = `
<!DOCTYPE html>
<html><body>
  <div class="vod-list">
    <a href="/vod/detail/id/8848.html" title="进击的巨人"><img data-src="https://img.4kcz.com/cover/8848.jpg"><span class="title">进击的巨人</span></a>
    <a href="/vod/detail/id/8849.html" title="葬送的芙莉莲"><img data-src="https://img.4kcz.com/cover/8849.jpg"><span class="title">葬送的芙莉莲</span></a>
    <a href="/vod/detail/id/8850.html" title="咒术回战"><img data-src="https://img.4kcz.com/cover/8850.jpg"><span class="title">咒术回战</span></a>
  </div>
  主演:李知恩,朴宝剑
</body></html>
`;

// 模拟详情页
const DETAIL_HTML = `
<!DOCTYPE html>
<html><body>
  <a href="/vod/detail/id/8848.html" title="进击的巨人">进击的巨人</a>
  <div class="play-list">
    <a href="/vod/play/id/8848/sid/1/nid/1.html" title="第1集">第1集</a>
    <a href="/vod/play/id/8848/sid/1/nid/2.html" title="第2集">第2集</a>
    <a href="/vod/play/id/8848/sid/1/nid/3.html" title="第3集">第3集</a>
  </div>
  <script>var player_aaaa = {"url":"https://video.4kcz.com/2024/8848/playlist.m3u8?token=xyz123&expires=9999"};</script>
  主演:宋威龙,鞠婧祎
</body></html>
`;

let pass = 0, fail = 0;
function assert(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

console.log('== 测试 1: 搜索页解析 ==');
const list = parseSearch(SEARCH_HTML, 'https://www.4kcz.com/search', 'https://www.4kcz.com');
assert(Array.isArray(list), '返回数组');
assert(list.length === 3, `找到3部 (实际${list.length})`);
assert(list[0].title === '进击的巨人', '标题正确: ' + list[0].title);
assert(list[0].url.startsWith('https://www.4kcz.com/vod/detail/'), '详情URL绝对化');
assert(list[0].cover.startsWith('https://img.4kcz.com/'), '封面绝对化: ' + list[0].cover);
assert(list.every(x => x.title !== '主演:李知恩'), '过滤掉"主演"文本误当标题');

console.log('== 测试 2: 详情/选集解析 ==');
const eps = parseDetail(DETAIL_HTML, 'https://www.4kcz.com/vod/detail/id/8848.html');
assert(Array.isArray(eps), '返回数组');
assert(eps.some(e => e.direct && /\.m3u8/.test(e.url)), '抽到直链 m3u8');
assert(eps.some(e => e.name === '第1集'), '抽到"第1集"按钮');
assert(eps.some(e => /\/vod\/play\//.test(e.url)), '选集播放链接');
assert(eps.filter(e => e.direct).length === 1, '直链去重');

console.log('== 测试 3: 直链视频抽取 ==');
const v = parseVideo(DETAIL_HTML, 'https://www.4kcz.com/');
assert(/\.m3u8/.test(v), '抽出 m3u8: ' + v);

console.log('== 测试 4: headers ==');
const h = headers('https://www.4kcz.com/');
assert(h['User-Agent'].includes('Chrome'), '带 UA');
assert(h['Referer'] === 'https://www.4kcz.com/', '带 Referer');

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);
