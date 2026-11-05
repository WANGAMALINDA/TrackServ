const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  if (!groqApiKey) {
    return jsonResponse({ error: "The chat service is not configured." }, 500);
  }

  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      return jsonResponse({ error: "At least one message is required." }, 400);
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are the helpful TrackServ citizen support assistant. Keep answers concise and practical.",
          },
          ...messages.slice(-12),
        ],
        temperature: 0.3,
      }),
    });

    const result = await groqResponse.json();
    if (!groqResponse.ok) {
      return jsonResponse(
        { error: result.error?.message || "The AI provider could not process the request." },
        groqResponse.status
      );
    }

    return jsonResponse({
      message: result.choices?.[0]?.message?.content || "I could not generate a response.",
    });
  } catch (error) {
    console.error("Chat request failed:", error);
    return jsonResponse({ error: "The chat service could not process the request." }, 500);
  }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
