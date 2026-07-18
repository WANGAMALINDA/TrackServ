import { MapPin } from "lucide-react";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#059669",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MapPin size={16} color="#fff" />
      </div>
      <div style={{ lineHeight: 1.2 }}>
        <p style={{ margin: 0, fontWeight: 700, color: "#111827", fontSize: 16 }}>
          Track<span style={{ color: "#059669" }}>Serv</span>
        </p>
      </div>
    </div>
          
  );
}

export default Logo;
