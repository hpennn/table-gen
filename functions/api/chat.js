const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SYSTEM_PROMPT = '你是一个专业的表格生成助手。用户会描述他们需要的表格，你将其解析为结构化的JSON数据返回。返回格式为 { "headers": ["列1", "列2"], "rows": [["值1", "值2"]] }。如果用户的描述不够明确，用合理的默认值填充。只返回JSON，不要其他文字。';

export async function onRequestPost({ request, env }) {
  // Check auth
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: '未登录，请先登录' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const token = authHeader.substring(7);
  const sessionStr = await env.PAY_KV.get(`session:${token}`);
  if (!sessionStr) {
    return new Response(JSON.stringify({ error: '登录已过期，请重新登录' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  try {
    const { messages } = await request.json();

    const requestBody = {
      model: 'ep-20260707225043-z7nkm',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: messages || '' }
      ],
      stream: true,
    };

    const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DOUBAO_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: 'AI服务调用失败', detail: errText }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // Stream response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body.getReader();
    const encoder = new TextEncoder();

    (async () => {
      try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += new TextDecoder().decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.substring(6);
            if (data === '[DONE]') {
              await writer.write(encoder.encode('data: [DONE]\n\n'));
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch (e) {
              // Skip malformed JSON chunks
            }
          }
        }
      } catch (e) {
        // Stream error
      } finally {
        try { await writer.close(); } catch (e) {}
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...CORS,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
