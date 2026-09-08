# 4kcz 影视搜索播放器（Vercel 版）

填站源 → 输剧名 → 自动搜出剧 → 点剧出选集 → 点集本页播放。

## 目录结构
```
vercel-project/
├── api/
│   ├── home.js      首页列表
│   ├── search.js    搜索（/api/search?site=...&kw=...）
│   ├── detail.js    选集（/api/detail?url=...）
│   ├── proxy.js     视频代理，补 Referer + 重写 m3u8（/api/proxy?url=...&ref=...）
│   └── parser.js    4kcz 专用解析（maccms 体系）
├── index.html       前端
├── test.js          端到端测试
└── package.json
```

## 本地测试
```bash
node test.js        # 跑解析测试（用真实结构片段，无需联网）
node api/parser.js  # 单独看解析自检
```
> 说明：沙盒可能连不上 4kcz 外网，但解析逻辑用真实片段已验证。部署到 Vercel 后即可真实抓取。

## 部署到 Vercel
1. 把整个 `vercel-project/` 推到 GitHub 仓库
2. vercel.com → Import Project → 选该仓库 → **Root Directory 留空**（默认根目录）
3. Framework Preset 选 `Other` → Deploy
4. 部署完访问 `xxx.vercel.app` 即可

Vercel 会自动识别 `api/` 为云函数、`index.html` 为静态页，无需额外配置。

## 使用
1. 打开网页，默认站源 `https://www.4kcz.com`，自动加载首页
2. 搜索框输剧名 → 点搜索 → 出封面列表
3. 点某部 → 自动解析选集 → 点集数播放（m3u8 走 hls.js，mp4 直播）

## 说明
- 本站为苹果CMS(maccms)：搜索 `/vod/search/wd/{kw}.html`，详情 `/vod/detail/id/{id}.html`
- 若 4kcz 改版（路由/选择器变了），只改 `api/parser.js` 三个函数即可
- 视频若 403/跨域，统一走 `/api/proxy` 补 Referer；m3u8 分片地址会被重写为绝对地址
- 换别的 maccms 站点：改 `parser.js` 里的 URL 特征即可复用
