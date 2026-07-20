import Footer from '../Components/footer.jsx'
import {
  Play,
  Target,
  Eye,
  FileText,
  CircleCheckBig,
  Users,
  Building2,
  ShieldCheck,
  Handshake,
  HeartHandshake,
  Leaf,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Globe,
  Info,
} from "lucide-react";

const stats = [
  { key: "reports", label: "Reports Submitted", value: "10+", icon: FileText, bg: "#d1fae5", fg: "#059669" },
  { key: "resolved", label: "Issues Resolved", value: "0", icon: CircleCheckBig, bg: "#fef3c7", fg: "#f59e0b" },
  { key: "citizens", label: "Active Citizens", value: "15+", icon: Users, bg: "#dbeafe", fg: "#3b82f6" },
  { key: "authorities", label: "Partner Authorities", value: "16", icon: Building2, bg: "#f3e8ff", fg: "#a855f7" },
];

const values = [
  {
    key: "transparency",
    title: "Transparency",
    text: "We believe in openness and accountability in everything we do.",
    icon: ShieldCheck,
    color: "#059669",
  },
  {
    key: "community",
    title: "Community",
    text: "We bring people together to solve problems and create impact.",
    icon: Users,
    color: "#3b82f6",
  },
  {
    key: "collaboration",
    title: "Collaboration",
    text: "We work with citizens and authorities to find better solutions.",
    icon: Handshake,
    color: "#f59e0b",
  },
  {
    key: "integrity",
    title: "Integrity",
    text: "We are honest, reliable, and committed to doing what is right.",
    icon: HeartHandshake,
    color: "#a855f7",
  },
  {
    key: "sustainability",
    title: "Sustainability",
    text: "We care about our environment and the future of our communities.",
    icon: Leaf,
    color: "#059669",
  },
];

function Card({ children, className = "", style }) {
  return (
    <div
      className={`card ${className}`.trim()}
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function About() {
  return (
    <div className="about-page" style={{ backgroundColor: "#f3f4f6", minHeight: "100%", padding: 20 }}>
      <div className="about-shell" style={{ maxWidth: 1300, margin: "0 10", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Hero */}
        <div
          className="about-hero"
          style={{
            position: "relative",
            borderRadius: 16,
            overflow: "hidden",
            background: "linear-gradient(135deg, #ecfdf5 0%, #dbeafe 100%)",
            padding: "32px 32px 28px",
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div className="about-hero-content" style={{ maxWidth: 480, position: "relative", zIndex: 2, flex: "1 1 320px" }}>
            <p
              className="about-hero-eyebrow"
              style={{
                margin: "0 0 10px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#059669",
                textTransform: "uppercase",
              }}
            >
              About TrackSev
            </p>
            <h1 className="about-hero-title" style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "#111827", lineHeight: 1.25 }}>
              Empowering citizens.
              <br />
              <span className="about-hero-title-accent" style={{ color: "#047857" }}>
                Building better communities.
              </span>
            </h1>
            <p className="about-hero-description" style={{ margin: "14px 0 20px", fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>
              TrackSev is a unified platform that connects citizens, authorities, and communities to
              identify issues, track progress, and drive meaningful change together.
            </p>
            <button
              className="watch-video-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: 600,
                color: "#047857",
                backgroundColor: "#fff",
                border: "1px solid #a7f3d0",
                borderRadius: 9999,
                cursor: "pointer",
              }}
            >
              <span
                className="watch-video-icon"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: "#047857",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Play size={10} color="#fff" fill="#fff" />
              </span>
              Watch Video
            </button>
          </div>

        </div>

        {/* Mission / Vision / Numbers */}
        <Card className="mission-vision-card" style={{ padding: 0 }}>
          <div
            className="mission-vision-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 2fr",
              gap: 0,
            }}
          >
            <div className="mission-block" style={{ padding: 24, borderRight: "1px solid #e5e7eb" }}>
              <div
                className="mission-icon"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: "#d1fae5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <Target size={16} color="#059669" />
              </div>
              <h3 className="mission-title" style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "#111827" }}>
                Our Mission
              </h3>
              <p className="mission-text" style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                To create a transparent, efficient, and inclusive platform where every citizen's voice
                is heard and every issue gets the attention it deserves.
              </p>
            </div>

            <div className="vision-block" style={{ padding: 24, borderRight: "1px solid #e5e7eb" }}>
              <div
                className="vision-icon"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: "#dbeafe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <Eye size={16} color="#3b82f6" />
              </div>
              <h3 className="vision-title" style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "#111827" }}>
                Our Vision
              </h3>
              <p className="vision-text" style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                A future where communities and authorities work hand in hand to build safer, cleaner,
                and smarter cities for everyone.
              </p>
            </div>

            <div className="numbers-block" style={{ padding: 24 }}>
              <h3 className="numbers-title" style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#111827" }}>
                TrackSev in Numbers
              </h3>
              <div
                className="numbers-grid"
                style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}
              >
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.key} className="stat-item" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        className="stat-icon"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          backgroundColor: stat.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={16} color={stat.fg} />
                      </div>
                      <div className="stat-text">
                        <p className="stat-value" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
                          {stat.value}
                        </p>
                        <p className="stat-label" style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>
                          {stat.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Our Values */}
        <Card className="values-card">
          <h3 className="values-title" style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600, color: "#111827" }}>
            Our Values
          </h3>
          <div
            className="values-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 20 }}
          >
            {values.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.key} className="value-item" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div
                    className="value-icon"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      backgroundColor: `${v.color}1a`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={16} color={v.color} />
                  </div>
                  <p className="value-title" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    {v.title}
                  </p>
                  <p className="value-text" style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    {v.text}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* CTA + Contact */}
        <div className="bottom-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
          <div
            className="cta-panel"
            style={{
              borderRadius: 12,
              background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
              padding: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div className="cta-copy" style={{ flex: "1 1 240px" }}>
              <h3 className="cta-title" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#fff" }}>
                Be Part of the Change
              </h3>
              <p className="cta-text" style={{ margin: "8px 0 0", fontSize: 13, color: "#d1fae5", lineHeight: 1.5 }}>
                Your voice can make a difference. Together, we can build a better tomorrow.
              </p>
            </div>
            <button
              className="cta-button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                backgroundColor: "#fff",
                color: "#047857",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Report an Issue <ArrowRight size={14} />
            </button>
          </div>

          <Card className="contact-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div className="contact-details" style={{ flex: 1 }}>
              <h3 className="contact-title" style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600, color: "#111827" }}>
                Contact Us
              </h3>
              <div className="contact-list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="contact-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Mail size={14} color="#6b7280" />
                  <span className="contact-item-text" style={{ fontSize: 12, color: "#374151" }}>info@tracksev.co.za</span>
                </div>
                <div className="contact-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Phone size={14} color="#6b7280" />
                  <span className="contact-item-text" style={{ fontSize: 12, color: "#374151" }}>012 345 6789</span>
                </div>
                <div className="contact-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MapPin size={14} color="#6b7280" />
                  <span className="contact-item-text" style={{ fontSize: 12, color: "#374151" }}>Pretoria, South Africa</span>
                </div>
                <div className="contact-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Globe size={14} color="#6b7280" />
                  <span className="contact-item-text" style={{ fontSize: 12, color: "#374151" }}>www.tracksev.co.za</span>
                </div>
              </div>
            </div>
            <div
              className="contact-illustration"
              style={{
                width: 84,
                height: 84,
                borderRadius: 12,
                background: "linear-gradient(135deg, #d1fae5 0%, #dbeafe 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <Mail size={30} color="#059669" />
              <div
                className="contact-illustration-badge"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  backgroundColor: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #fff",
                }}
              >
                <Info size={11} color="#fff" />
              </div>
            </div>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}