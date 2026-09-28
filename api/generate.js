// ============================================
// AI Generation API
// Backend: Groq only (our key)
// BYOK: Groq, Gemini, OpenAI, Grok, Anthropic, OpenRouter
// Priority: User's key first → Backend Groq key
// ============================================

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, userApiKeys, taskType } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt required" });
  }

  // ============================================
  // BUILD PROVIDER LIST — Priority Order
  // ============================================
  const providers = [];

  // 1. User's Groq key (BYOK)
  if (userApiKeys?.groq && userApiKeys.groq.startsWith("gsk_")) {
    providers.push({ name: "groq-user", key: userApiKeys.groq, type: "groq" });
  }

  // 2. User's Gemini key (BYOK)
  if (userApiKeys?.gemini && userApiKeys.gemini.startsWith("AIza")) {
    providers.push({ name: "gemini-user", key: userApiKeys.gemini, type: "gemini" });
  }

  // 3. User's OpenAI key (BYOK)
  if (userApiKeys?.openai && userApiKeys.openai.startsWith("sk-") && !userApiKeys.openai.startsWith("sk-ant-")) {
    providers.push({ name: "openai-user", key: userApiKeys.openai, type: "openai" });
  }

  // 4. User's Grok key (BYOK)
  if (userApiKeys?.grok && userApiKeys.grok.startsWith("xai-")) {
    providers.push({ name: "grok-user", key: userApiKeys.grok, type: "grok" });
  }

  // 5. User's Anthropic key (BYOK)
  if (userApiKeys?.anthropic && userApiKeys.anthropic.startsWith("sk-ant-")) {
    providers.push({ name: "anthropic-user", key: userApiKeys.anthropic, type: "anthropic" });
  }

  // 6. User's OpenRouter key (BYOK)
  if (userApiKeys?.openrouter && userApiKeys.openrouter.startsWith("sk-or-")) {
    providers.push({ name: "openrouter-user", key: userApiKeys.openrouter, type: "openrouter" });
  }

  // 7. Backend Groq key — FALLBACK (our key, for credits users)
  if (process.env.GROQ_API_KEY) {
    providers.push({ name: "groq-backend", key: process.env.GROQ_API_KEY, type: "groq" });
  }

  // Agar koi provider nahi mila
  if (providers.length === 0) {
    return res.status(503).json({
      error: "no_provider",
      message: "No AI provider available. Please add your API key in settings, or buy credits to use our Groq key.",
    });
  }

  // ============================================
  // TRY EACH PROVIDER IN ORDER
  // ============================================
  let lastError = null;

  for (const provider of providers) {
    try {
      let result;

      if (provider.type === "groq") {
        result = await callGroq(provider.key, prompt);
      } else if (provider.type === "gemini") {
        result = await callGemini(provider.key, prompt);
      } else if (provider.type === "openai") {
        result = await callOpenAI(provider.key, prompt);
      } else if (provider.type === "grok") {
        result = await callGrok(provider.key, prompt);
      } else if (provider.type === "anthropic") {
        result = await callAnthropic(provider.key, prompt);
      } else if (provider.type === "openrouter") {
        result = await callOpenRouter(provider.key, prompt);
      }

      if (result.success) {
        return res.status(200).json({
          success: true,
          text: result.text,
          provider: provider.name,
        });
      } else {
        lastError = result.error;
        console.warn(`Provider ${provider.name} failed:`, result.error);
      }
    } catch (err) {
      lastError = err.message;
      console.warn(`Provider ${provider.name} threw:`, err.message);
    }
  }

  // Sab fail ho gaye
  return res.status(500).json({
    error: lastError || "All AI providers failed",
  });
}

// ============================================
// GROQ — Backend + BYOK
// ============================================
async function callGroq(apiKey, prompt) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Groq ${response.status}: ${errText.slice(0, 100)}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { success: false, error: "Empty Groq response" };

    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// GEMINI — BYOK only
// ============================================
async function callGemini(apiKey, prompt) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `Gemini ${response.status}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { success: false, error: "Empty Gemini response" };

    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// OPENAI — BYOK only
// ============================================
async function callOpenAI(apiKey, prompt) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `OpenAI ${response.status}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { success: false, error: "Empty OpenAI response" };

    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// GROK (xAI) — BYOK only
// ============================================
async function callGrok(apiKey, prompt) {
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-2-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Grok ${response.status}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { success: false, error: "Empty Grok response" };

    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// ANTHROPIC (Claude) — BYOK only
// ============================================
async function callAnthropic(apiKey, prompt) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Claude ${response.status}` };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) return { success: false, error: "Empty Claude response" };

    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// OPENROUTER — BYOK only
// ============================================
async function callOpenRouter(apiKey, prompt) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `OpenRouter ${response.status}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { success: false, error: "Empty OpenRouter response" };

    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}