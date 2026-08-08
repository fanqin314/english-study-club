// Cloudflare Worker - API 代理
// 部署后替换下面的 DEEPSEEK_API_KEY 为你的真实 Key
// 然后将前端 API 地址改为你的 Worker 域名

const DEEPSEEK_API_KEY = 'sk-你的DeepSeek-API-Key填这里';
const DEEPSEEK_BASE = 'https://api.deepseek.com';
const DAILY_LIMIT = 20; // 每个 IP 每天最多 20 次（硬限制，防滥用）

export default {
  async fetch(request, env, ctx) {
    // 只允许 POST
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // IP 速率限制
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const today = new Date().toISOString().slice(0, 10);
    const rateKey = `rate:${ip}:${today}`;

    // 使用简单的内存计数（生产环境建议用 KV）
    // 这里用全局变量，Worker 重启会清零，对于免费场景足够
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

      const resp = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
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