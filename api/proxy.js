// api/proxy.js —— 视频代理（补 Referer、重写 m3u8 分片地址）
export default async function handler(req, res) {
  const target = (req.query.url || '').trim();
  const ref = (req.query.ref || 'https://www.4kcz.com/').trim();
  if (!target) return res.status(400).json({ ok: 0, msg: '缺少 url' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: ref,
    Origin: new URL(ref).origin,
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(target, { headers, signal: ctrl.signal });
    clearTimeout(timer);
    const ct = r.headers.get('content-type') || '';

    // m3u8：重写分片相对地址为绝对地址，前端走代理播放
    if (/\.m3u8/i.test(target) || /mpegurl|vnd\.apple/.test(ct)) {
      const text = await r.text();
      const base = new URL(target);
      const rewritten = text.replace(/^(?!#)(.+)$/gm, (line) => {
        if (line.startsWith('#') || /https?:\/\//.test(line)) return line;
        return new URL(line, base).toString();
      });
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(rewritten);
    }

    // mp4 / ts 等：流式透传
    res.setHeader('Content-Type', ct || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return r.body.pipe ? r.body : res.status(200).send(await r.arrayBuffer());
  } catch (err) {
    return res.status(200).json({ ok: 0, msg: '代理失败：' + err.message });
  }
}
