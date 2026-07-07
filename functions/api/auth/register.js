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
    const { account, password, nickname } = await request.json();

    // Validate account
    if (!account || typeof account !== 'string') {
      return new Response(JSON.stringify({ error: '请输入账号' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    const trimmedAccount = account.trim();
    const usernameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_]{2,20}$/;
    const phoneRegex = /^1[3-9]\d{9}$/;

    if (!usernameRegex.test(trimmedAccount) && !phoneRegex.test(trimmedAccount)) {
      return new Response(JSON.stringify({ error: '账号格式不正确，需为2-20位中英文、数字、下划线或手机号' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // Validate password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return new Response(JSON.stringify({ error: '密码至少6位' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // Check if user already exists
    const existingUser = await env.PAY_KV.get(`user:${trimmedAccount}`);
    if (existingUser) {
      return new Response(JSON.stringify({ error: '该账号已注册' }), { status: 409, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // Generate salt and hash password
    const salt = crypto.randomUUID().replace(/-/g, '');
    const hashedPassword = await hashPassword(password, salt);

    // Store user data
    const userData = {
      account: trimmedAccount,
      nickname: nickname && nickname.trim() ? nickname.trim() : trimmedAccount,
      hashedPassword,
      salt,
      createdAt: new Date().toISOString(),
    };

    await env.PAY_KV.put(`user:${trimmedAccount}`, JSON.stringify(userData));

    return new Response(JSON.stringify({ success: true, message: '注册成功', user: { account: userData.account, nickname: userData.nickname } }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (e) {
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
