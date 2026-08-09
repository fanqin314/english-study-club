// Cloudflare Worker - API 代理（魔搭社区）
// 部署后在前端设置中填入 Worker 域名作为代理地址
// 直接请求时浏览器会带上 github.io 的 Origin，魔搭 API 可能限制
// 通过 Worker 代理后，Origin 变为 Cloudflare IP，避免被限制

const TARGET_BASE = 'https://api-inference.modelscope.cn/v1';
const DAILY_LIMIT = 500; // 每个 IP 每天最多 500 次

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // OPTIONS 预检请求必须最先处理
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 只允许 POST
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // IP 速率限制
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const today = new Date().toISOString().slice(0, 10);
    const rateKey = `rate:${ip}:${today}`;

    if (!globalThis._rateCache) globalThis._rateCache = {};
    const count = (globalThis._rateCache[rateKey] || 0) + 1;
    globalThis._rateCache[rateKey] = count;

    if (count > DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: '今日请求次数已达上限，请明天再试' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const body = await request.json();
      // 转发客户端的 Authorization 头到魔搭 API
      const authHeader = request.headers.get('Authorization') || '';

      const resp = await fetch(`${TARGET_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(body),
      });

      const data = await resp.text();

      return new Response(data, {
        status: resp.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(Math.max(0, DAILY_LIMIT - count)),
        },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: '代理服务异常，请稍后重试' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};