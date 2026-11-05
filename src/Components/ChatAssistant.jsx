import { useState } from "react";
import { Bot, Loader2, Send, X } from "lucide-react";
import { supabase } from "./supabaseClient";

const initialMessage = {
  role: "assistant",
  content: "Hi! I’m the TrackServ assistant. How can I help you today?",
};

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([initialMessage]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event) {
    event.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setSending(true);

    try {
      const { data, error: functionError } = await supabase.functions.invoke("chat", {
        body: { messages: nextMessages },
      });
      if (functionError) throw functionError;
      if (!data?.message) throw new Error("The assistant returned an empty response.");
      setMessages((current) => [...current, { role: "assistant", content: data.message }]);
    } catch (requestError) {
      setError(requestError.message || "The assistant is unavailable.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close TrackServ assistant" : "Open TrackServ assistant"}
        title="TrackServ assistant"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 10px",
          border: "1px solid #d1fae5",
          borderRadius: 8,
          background: open ? "#ecfdf5" : "#fff",
          color: "#047857",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <Bot size={17} />
        {!isSmallScreen() && "Ask TrackServ"}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            zIndex: 30,
            width: "min(360px, calc(100vw - 24px))",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            boxShadow: "0 16px 40px rgba(17, 24, 39, 0.16)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#ecfdf5", borderBottom: "1px solid #d1fae5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#065f46", fontWeight: 700, fontSize: 13 }}>
              <Bot size={17} /> TrackServ Assistant
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" style={{ border: "none", background: "transparent", color: "#6b7280", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ height: 280, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                style={{
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "86%",
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: message.role === "user" ? "#059669" : "#f3f4f6",
                  color: message.role === "user" ? "#fff" : "#374151",
                  fontSize: 12,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                }}
              >
                {message.content}
              </div>
            ))}
            {sending && <Loader2 size={16} color="#059669" style={{ animation: "spin 1s linear infinite" }} />}
            {error && <div style={{ color: "#b91c1c", fontSize: 11 }}>{error}</div>}
          </div>
          <form onSubmit={sendMessage} style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid #e5e7eb" }}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a question..."
              aria-label="Message TrackServ assistant"
              style={{ minWidth: 0, flex: 1, border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 9px", outline: "none", fontSize: 12 }}
            />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Send message" style={{ display: "grid", placeItems: "center", width: 34, border: "none", borderRadius: 8, background: "#059669", color: "#fff", cursor: "pointer", opacity: sending || !input.trim() ? 0.5 : 1 }}>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function isSmallScreen() {
  return typeof window !== "undefined" && window.innerWidth < 900;
}
