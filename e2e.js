// e2e 测试：mock 一个目标站 + 本地服务，跑通 搜索→详情→proxy 全流程
import http from 'node:http';
import { spawn } from 'node:child_process';

// --- mock 目标站（被爬的番剧站）---
const targetHtml = `<html><body>
  <a href="/show/123"><img src="/c.jpg"><span>测试番剧A</span></a>
  <a href="/show/456"><img src="/c2.jpg"><span>测试番剧B</span></a>
  <a href="/ads">广告</a>
</body></html>`;
const detailHtml = `<html><body>
  <video src="https://cdn.example.com/intro.mp4"></video>
  <a href="https://cdn.example.com/ep1.m3u8">第1集</a>
  <a href="/play/2" class="ep-btn">第2集</a>
  <script>var src="https://hidden.example.com/master.m3u8?t=1";</script>
</body></html>`;
const target = http.createServer((q, s) => {
  if (q.url.startsWith('/show/123')) return s.end(detailHtml);
  s.end(targetHtml);
});
target.listen(9999);

// --- 启动本项目服务（fork server.js）---
const child = spawn('node', ['server.js'], { cwd: process.cwd(), stdio: 'pipe' });

function request(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

await new Promise((r) => setTimeout(r, 1500)); // 等服务启动

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

try {
  console.log('=== 测试1: 前端页面 ===');
  const home = await request('http://localhost:3000/');
  assert(home.status === 200, '首页 200');
  assert(home.data.includes('番剧播放器'), '页面含标题');
  assert(home.data.includes('/api/search'), '页面调用 search API');

  console.log('=== 测试2: 搜索接口 ===');
  const searchRes = await request('http://localhost:3000/api/search?site=http://localhost:9999&kw=测试');
  const searchJson = JSON.parse(searchRes.data);
  assert(searchRes.status === 200, 'search 200');
  assert(searchJson.ok === 1, 'ok=1');
  assert(searchJson.items.length === 2, `抽到2个结果(实际${searchJson.items.length})`);
  assert(searchJson.items[0].url === 'http://localhost:9999/show/123', '链接绝对化');
  assert(searchJson.items[0].img === 'http://localhost:9999/c.jpg', '封面绝对化');
  assert(!searchJson.items.find(i => i.title.includes('广告')), '过滤了广告/无关链接');

  console.log('=== 测试3: 详情接口 ===');
  const detailRes = await request('http://localhost:3000/api/detail?url=http://localhost:9999/show/123');
  const detailJson = JSON.parse(detailRes.data);
  assert(detailRes.status === 200, 'detail 200');
  assert(detailJson.ok === 1, 'ok=1');
  assert(detailJson.direct.some(d => d.url.includes('intro.mp4')), '直链抽到 mp4');
  assert(detailJson.direct.some(d => d.url.includes('master.m3u8')), '直链抽到 JS 里的 m3u8');
  assert(detailJson.eps.some(e => e.url.includes('ep1.m3u8')), '选集抽到 m3u8 直链');
  assert(detailJson.eps.some(e => e.url === 'http://localhost:9999/play/2'), '选集抽到 page 链接');

  console.log('=== 测试4: 缺少参数 ===');
  const bad = await request('http://localhost:3000/api/search?site=xxx');
  const badJson = JSON.parse(bad.data);
  assert(badJson.ok === 0, '缺少kw返回ok=0');

  console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
  process.exit(fail ? 1 : 0);
} catch (err) {
  console.error('测试异常:', err);
  process.exit(2);
} finally {
  child.kill(); target.close();
}
