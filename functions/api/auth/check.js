const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestGet({ request, env }) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ loggedIn: false }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    const token = authHeader.substring(7);
    const sessionStr = await env.PAY_KV.get(`session:${token}`);

    if (!sessionStr) {
      return new Response(JSON.stringify({ loggedIn: false }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    const session = JSON.parse(sessionStr);
    return new Response(JSON.stringify({ loggedIn: true, user: { account: session.account, nickname: session.nickname } }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (e) {
    return new Response(JSON.stringify({ loggedIn: false }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
