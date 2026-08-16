// 管理员接口 - 列出所有注册用户
// GET /api/admin/users

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestGet({ request, env }) {
  try {
    // Optional admin auth check
    const adminSecret = env.ADMIN_SECRET;
    if (adminSecret) {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || '';
      if (token !== adminSecret) {
        return new Response(JSON.stringify({ error: '未授权' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
      }
    }

    if (!env.PAY_KV) {
      return new Response(JSON.stringify({ error: '存储服务未配置' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // List all user keys from KV
    const users = [];
    let cursor;
    do {
      const listResult = await env.PAY_KV.list({ prefix: 'user:', limit: 100, cursor });
      for (const key of listResult.keys) {
        const data = await env.PAY_KV.get(key.name);
        if (data) {
          try {
            const user = JSON.parse(data);
            users.push({
              account: user.account,
              nickname: user.nickname || '',
              isPhone: user.isPhone || false,
              createdAt: user.createdAt,
            });
          } catch (e) {}
        }
      }
      cursor = listResult.list_complete ? undefined : listResult.cursor;
    } while (cursor);

    // Sort by creation time desc
    users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return new Response(JSON.stringify({
      total: users.length,
      users,
      trend: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (e) {
    return new Response(JSON.stringify({ error: '查询失败' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
