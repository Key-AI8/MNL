// api/proxy.js —— Vercel Serverless Function
// 视频/直播流代理：补 Referer，m3u8 自动重写分片回本代理，解决跨域 + 防盗链
export default async function handler(req, res) {
  const { url, ref } = req.query;
  if (!url) return res.status(400).send('need url');

  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

  const target = decodeURIComponent(String(url));
  const referer = ref ? decodeURIComponent(String(ref)) : new URL(target).origin + '/';

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': UA, Referer: referer },
    });
    if (!upstream.ok) return res.status(upstream.status).send('upstream ' + upstream.status);

    const ctype = upstream.headers.get('content-type') || '';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // m3u8：重写里面的相对分片地址，让分片也走本代理
    if (/\.m3u8/i.test(target) || ctype.includes('mpegurl') || ctype.includes('vnd.apple')) {
      let text = await upstream.text();
      const baseUrl = target;
      text = text.replace(/^(?!#)(.+)$/gm, (line, seg) => {
        if (seg.startsWith('http') || seg.startsWith('/api/')) return seg;
        try {
          return new URL(seg, baseUrl).href;
        } catch (e) {
          return seg;
        }
      });
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(text);
    }

    // ts / mp4 等二进制：流式转发
    res.setHeader('Content-Type', ctype || 'application/octet-stream');
    const buf = await upstream.arrayBuffer();
    return res.send(Buffer.from(buf));
  } catch (err) {
    return res.status(500).send('proxy error: ' + err);
  }
}
