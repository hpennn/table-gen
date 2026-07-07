const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  try {
    const { account, password } = await request.json();

    if (!account || !password) {
      return new Response(JSON.stringify({ error: '请输入账号和密码' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    const trimmedAccount = account.trim();

    // Find user
    const userStr = await env.PAY_KV.get(`user:${trimmedAccount}`);
    if (!userStr) {
      return new Response(JSON.stringify({ error: '账号不存在' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    const user = JSON.parse(userStr);

    // Verify password
    const hashedPassword = await hashPassword(password, user.salt);
    if (hashedPassword !== user.hashedPassword) {
      return new Response(JSON.stringify({ error: '密码错误' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // Generate session token
    const token = crypto.randomUUID();

    // Store session with 7 day expiry (604800 seconds)
    const sessionData = {
      account: user.account,
      nickname: user.nickname,
      createdAt: new Date().toISOString(),
    };
    await env.PAY_KV.put(`session:${token}`, JSON.stringify(sessionData), { expirationTtl: 604800 });

    return new Response(JSON.stringify({ success: true, token, user: { account: user.account, nickname: user.nickname } }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (e) {
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
