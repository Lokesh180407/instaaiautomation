import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { provider, api_key, messages, user_message, system_prompt, test } = await req.json();

    if (test) {
      // Test connection
      let testUrl: string;
      let headers: HeadersInit;

      if (provider === 'openai') {
        testUrl = 'https://api.openai.com/v1/models';
        headers = { 'Authorization': `Bearer ${api_key}` };
      } else if (provider === 'anthropic') {
        testUrl = 'https://api.anthropic.com/v1/messages';
        headers = { 
          'x-api-key': api_key,
          'anthropic-version': '2023-06-01'
        };
      } else if (provider === 'gemini') {
        testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${api_key}`;
      } else {
        throw new Error('Invalid provider');
      }

      const response = await fetch(testUrl, { headers });
      
      if (!response.ok) {
        throw new Error('Invalid API key or provider');
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate AI reply
    let reply: string;

    if (provider === 'openai') {
      reply = await generateOpenAIReply(api_key, messages, user_message, system_prompt);
    } else if (provider === 'anthropic') {
      reply = await generateAnthropicReply(api_key, messages, user_message, system_prompt);
    } else if (provider === 'gemini') {
      reply = await generateGeminiReply(api_key, messages, user_message, system_prompt);
    } else {
      throw new Error('Invalid provider');
    }

    return new Response(
      JSON.stringify({ reply }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function generateOpenAIReply(apiKey: string, messages: any[], userMessage: string, systemPrompt: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt || 'You are a helpful Instagram assistant.' },
        ...(messages?.map((m: any) => ({
          role: m.direction === 'incoming' ? 'user' : 'assistant',
          content: m.content
        })) || []),
        { role: 'user', content: userMessage }
      ],
      max_tokens: 500
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
}

async function generateAnthropicReply(apiKey: string, messages: any[], userMessage: string, systemPrompt: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: systemPrompt || 'You are a helpful Instagram assistant.',
      messages: [
        ...(messages?.map((m: any) => ({
          role: m.direction === 'incoming' ? 'user' : 'assistant',
          content: m.content
        })) || []),
        { role: 'user', content: userMessage }
      ]
    })
  });

  const data = await response.json();
  return data.content?.[0]?.text || 'Sorry, I could not generate a response.';
}

async function generateGeminiReply(apiKey: string, messages: any[], userMessage: string, systemPrompt: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt || ''}\n\n${messages?.map((m: any) => `${m.direction === 'incoming' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}\nUser: ${userMessage}` }] }
      ],
      generationConfig: { maxOutputTokens: 500 }
    })
  });

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
}
