const fs = require("fs");
const http = require("http");
const path = require("path");

loadEnvFile(path.join(__dirname, ".env.local"));

const port = Number(process.env.CHAT_SERVER_PORT || 8787);
const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.error("Missing GROQ_API_KEY. Add it to Users/TrackServ/.env.local before starting the chat server.");
  process.exit(1);
}

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/chat") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const body = await readBody(request);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      sendJson(response, 400, { error: "At least one message is required." });
      return;
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
          { role: "system", content: "You are the helpful TrackServ citizen support assistant. Keep answers concise and practical." },
          ...messages.slice(-12),
        ],
        temperature: 0.3,
      }),
    });

    const result = await groqResponse.json();
    if (!groqResponse.ok) {
      sendJson(response, groqResponse.status, { error: result.error?.message || "Groq could not process the request." });
      return;
    }

    sendJson(response, 200, { message: result.choices?.[0]?.message?.content || "I could not generate a response." });
  } catch (error) {
    console.error("Chat request failed:", error);
    sendJson(response, 500, { error: "The local chat server could not process the request." });
  }
});

server.listen(port, () => {
  console.log(`TrackServ chat server listening on http://localhost:${port}`);
});

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => { raw += chunk; });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Invalid JSON request."));
      }
    });
    request.on("error", reject);
  });
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}
