# 番剧播放器（Vercel 版）

**填站源 → 搜剧名 → 自动出剧 → 点选集 → 本页播放**

后端用 Vercel Serverless Functions（`/api/search`、`/api/detail`、`/api/proxy`），解决纯前端的跨域 + 防盗链问题。

## 本地测试（先跑通再部署）

```bash
node test.js      # 单元测试：抽取逻辑（应全通过）
node e2e.js       # 端到端测试：搜索→详情→播放（应全通过）
node server.js    # 启动完整服务，访问 http://localhost:3000
```

> `server.js` / `test.js` / `e2e.js` 是本地测试用，已加入 `.vercelignore`，**不会上传到 Vercel**。
> Vercel 只认 `api/*.js`（云函数）和 `index.html`（静态首页）。

## 部署到 Vercel

### 方式一：GitHub 一键导入（推荐）

1. 把这个文件夹推到你的 GitHub 仓库
2. 打开 https://vercel.com → **Import Project** → 选该仓库
3. Framework Preset 选 **Other**，其他默认 → **Deploy**
4. 部署完给的域名（如 `xxx.vercel.app`）就是你的播放器地址

### 方式二：Vercel CLI

```bash
npm i -g vercel
vercel login
vercel        # 按提示，全部回车默认
vercel --prod # 发布生产
```

### 项目结构

```
anime-player/
├── api/
│   ├── search.js   # 搜索：服务端抓搜索页，抽番剧列表
│   ├── detail.js   # 详情：抽选集 + 页面内直链
│   └── proxy.js    # 视频代理：补 Referer，重写 m3u8 分片
├── index.html      # 前端页面
├── server.js       # 本地测试用
├── vercel.json
├── package.json
└── README.md
```

## 使用

1. 打开部署好的网址
2. 顶部填「站源」（`https://www.xxx.com`）+ 「剧名」→ 点搜索
3. 点封面进详情 → 自动出选集 → 点集数播放
4. 遇到防盗链站，「视频走后端代理」保持勾选（默认开）

## 说明

- 搜索/详情用**通用正则**抽 a 标签，覆盖多数「地址写在 HTML 里」的站点
- `api/proxy.js` 会给视频请求补 `Referer`、给 m3u8 重写分片地址，绕过常见防盗链
- **动态 JS 渲染 / 登录 token / DRM 加密**（B站、腾讯等）通用版仍可能失败 —— 把具体站发我，我写专用解析规则

## 环境变量（可选）

若某站需要固定 Referer / Cookie，可在 Vercel 后台 → Settings → Environment Variables 添加，再在 `api/*.js` 里读取 `process.env.XXX` 使用。
