import { useState, useMemo } from "react";
import { PieChart, Pie, Cell } from "recharts";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Footer from "../Components/footer";
import heroBg from "../Assets/background.jpg";
import {Search,
  SquarePen,
  MessageCircle,
  Siren,
  ArrowRight,
  FileText,
  Activity,
  Clock,
  Users,
  Droplet,
  TriangleAlert,
  Trash2,
  MapPin,
  ChevronDown,
  ArrowBigUp,
  Flame,
} from "lucide-react";

const quickActions = [
  { key: "report", label: "Report an Issue", icon: SquarePen, bg: "#047857" },
  { key: "community", label: "Join Community", icon: MessageCircle, bg: "#3b82f6" },
  { key: "stats", label: "Statistics", icon: Siren, bg: "#a855f7" },
];

const stats = [
  { key: "total", label: "Total Reports", sub: "All time", value: 154, icon: FileText, bg: "#d1fae5", fg: "#059669" },
  { key: "review", label: "In Progress", sub: "Reports", value: 23, icon: Activity, bg: "#dbeafe", fg: "#3b82f6" },
  { key: "resolved", label: "Resolved", sub: "Reports", value: 131, icon: Clock, bg: "#fef3c7", fg: "#f59e0b" },
  { key: "community", label: "Community Fixes", sub: "This month", value: 14, icon: Users, bg: "#f3e8ff", fg: "#a855f7" },
];

const recentReports = [
  { key: "water", category: "water", title: "Water Leak", sub: "Tshwane", time: "2h ago", status: "In Progress", icon: Droplet, color: "#3b82f6", votes: 9, severity: "Medium" },
  { key: "road", category: "roads", title: "Road Damage", sub: "Tshwane", time: "1d ago", status: "Resolved", icon: TriangleAlert, color: "#f59e0b", votes: 4, severity: "Low" },
  { key: "sanitation", category: "utilities", title: "Sanitation Issue", sub: "Tshwane", time: "2d ago", status: "Resolved", icon: Trash2, color: "#059669", votes: 2, severity: "Low" },
  { key: "streetlight", category: "safety", title: "Street Light Out", sub: "Tshwane", time: "3d ago", status: "In Progress", icon: MapPin, color: "#ef4444", votes: 6, severity: "Medium" },
];

const severityStyles = {
  High: { bg: "#fee2e2", fg: "#b91c1c" },
  Medium: { bg: "#fef3c7", fg: "#b45309" },
  Low: { bg: "#f3f4f6", fg: "#4b5563" },
};

function SeverityBadge({ severity, prioritized }) {
  const colors = severityStyles[severity] || severityStyles.Low;
  return (
    <span
      className="severity-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 9999,
        backgroundColor: colors.bg,
        color: colors.fg,
        whiteSpace: "nowrap",
      }}
    >
      {prioritized && <Flame size={11} />}
      {severity} priority
    </span>
  );
}

const mapCenter = [-25.7461, 28.1881]; // Tshwane / Pretoria, South Africa

const mapMarkers = [
  { count: 5, category: "water", status: "resolved", position: [-25.72, 28.16] },
  { count: 2, category: "roads", status: "unresolved", position: [-25.755, 28.155] },
  { count: 2, category: "utilities", status: "in-progress", position: [-25.72, 28.2] },
  { count: 3, category: "roads", status: "unresolved", position: [-25.74, 28.2] },
  { count: 6, category: "utilities", status: "unresolved", position: [-25.73, 28.225] },
  { count: 3, category: "water", status: "resolved", position: [-25.758, 28.225] },
  { count: 3, category: "environment", status: "resolved", position: [-25.775, 28.19] },
  { count: 3, category: "safety", status: "unresolved", position: [-25.727, 28.245] },
  { count: 4, category: "safety", status: "in-progress", position: [-25.765, 28.25] },
];

const markerColors = {
  resolved: "#059669",
  "in-progress": "#f59e0b",
  unresolved: "#ef4444",
};

function buildMarkerIcon(count, color) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: ${color};
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      font-family: sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    ">${count}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const categoryData = [
  { name: "Water & Sanitation", value: 46, pct: 30, color: "#3b82f6" },
  { name: "Roads & Infrastructure", value: 39, pct: 25, color: "#ef4444" },
  { name: "Public Utilities", value: 32, pct: 21, color: "#059669" },
  { name: "Other", value: 37, pct: 24, color: "#a855f7" },
];

const howItWorks = [
  { key: "discover", step: 1, title: "Discover", sub: "Notice an issue in your area" },
  { key: "report", step: 2, title: "Report", sub: "Submit details in seconds" },
  { key: "track", step: 3, title: "Track", sub: "We review and keep you updated" },
  { key: "resolve", step: 4, title: "Resolve", sub: "We take action and notify you" },
];

function StatusBadge({ status }) {
  const isResolved = status === "Resolved";
  return (
    <span
      className="status-badge"
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 9999,
        backgroundColor: isResolved ? "#d1fae5" : "#fef3c7",
        color: isResolved ? "#047857" : "#b45309",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function Card({ children, style, className = "" }) {
  return (
    <div
      className={`card ${className}`.trim()}
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function Home({ selectedCategory = "all", onReportClick }) {
  const [query, setQuery] = useState("");
  const [mapFilter, setMapFilter] = useState("all");
  const normalizedQuery = query.trim().toLowerCase();

  // Votes cast by the current user, keyed by report key.
  // A key can only ever be in here once, so one user = one vote per report.
  const [votedKeys, setVotedKeys] = useState(() => new Set());
  const [votes, setVotes] = useState(() =>
    Object.fromEntries(recentReports.map((r) => [r.key, r.votes]))
  );

  const handleVote = (key) => {
    setVotedKeys((prevVoted) => {
      const alreadyVoted = prevVoted.has(key);
      const nextVoted = new Set(prevVoted);

      setVotes((prevVotes) => ({
        ...prevVotes,
        [key]: prevVotes[key] + (alreadyVoted ? -1 : 1),
      }));

      if (alreadyVoted) {
        nextVoted.delete(key);
      } else {
        nextVoted.add(key);
      }
      return nextVoted;
    });
  };

  // The report with the most votes is auto-escalated to High severity
  // so it surfaces as the top priority for the team to act on.
  const topVotedKey = useMemo(() => {
    let leaderKey = null;
    let leaderVotes = -Infinity;
    Object.entries(votes).forEach(([key, count]) => {
      if (count > leaderVotes) {
        leaderVotes = count;
        leaderKey = key;
      }
    });
    return leaderVotes > 0 ? leaderKey : null;
  }, [votes]);

  const reportsWithSeverity = recentReports.map((r) => ({
    ...r,
    votes: votes[r.key],
    severity: r.key === topVotedKey ? "High" : r.severity,
  }));

  const mapFilterOptions = ["all", "resolved", "in-progress", "unresolved"];
  const mapFilterLabels = {
    all: "All Issues",
    resolved: "Resolved",
    "in-progress": "In Progress",
    unresolved: "Unresolved",
  };

  const filteredMapMarkers =
    (mapFilter === "all" ? mapMarkers : mapMarkers.filter((marker) => marker.status === mapFilter)).filter(
      (marker) => selectedCategory === "all" || marker.category === selectedCategory
    );

  const filteredRecentReports = normalizedQuery
    ? reportsWithSeverity.filter((report) => {
        if (selectedCategory !== "all" && report.category !== selectedCategory) {
          return false;
        }
        return [report.title, report.sub, report.time, report.status].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        );
      })
    : reportsWithSeverity.filter((report) => selectedCategory === "all" || report.category === selectedCategory);

  const handleMapFilterClick = () => {
    const currentIndex = mapFilterOptions.indexOf(mapFilter);
    const nextIndex = (currentIndex + 1) % mapFilterOptions.length;
    setMapFilter(mapFilterOptions[nextIndex]);
  };

  return (
    <div className="home-page" style={{ backgroundColor: "#f3f4f6", minHeight: "100vh", paddingTop: 20, paddingBottom: 0, paddingLeft: 10}}>
      <div className="home-shell" style={{ maxWidth: 1300, margin: "0 10", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Hero */}
        <div
          className="hero-panel"
          style={{
            position: "relative",
            borderRadius: 16,
            overflow: "hidden",
            background: "linear-gradient(90deg, #ecfdf5 0%, rgb(208, 218, 229) 100%)",
            padding: "32px 32px 24px",
          }}
        >
          {/* background image, faded from solid (left) to visible (right) */}
          <div
            className="hero-bg-image"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${heroBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              zIndex: 0,
            }}
          />
          <div
            className="hero-bg-fade"
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, #ecfdf5 0%, #ecfdf5 35%, rgba(236,253,245,0) 100%)",
              zIndex: 1,
            }}
          />

          <div className="hero-content" style={{ maxWidth: 520, position: "relative", zIndex: 2 }}>
            <h1 className="hero-title" style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "#111827", lineHeight: 1.25 }}>
              Together, let's build
              <br />
              <span className="hero-title-accent" style={{ color: "#047857" }}>a better community</span>
            </h1>
            <p className="hero-description" style={{ margin: "12px 0 20px", fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>
              Report issues, track progress, and stay updated. Your voice makes a difference.
            </p>

            <div className="hero-actions" style={{ display: "flex", gap: 10 }}>
              <div className="hero-search" style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                <Search
                  size={16}
                  color="#e2e7f0"
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  className="hero-search-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search issues in your area..."
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 36px",
                    fontSize: 14,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#fff",
                    outline: "none",
                  }}
                />
              </div>

            </div>

            <p className="quick-actions-label" style={{ margin: "20px 0 10px", fontSize: 12, fontWeight: 600, color: "#374151" }}>
              Quick Actions
            </p>
            <div className="quick-actions-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 600 }}>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    className="quick-action-button"
                    onClick={action.key === "report" ? onReportClick : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div
                      className="quick-action-icon"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: action.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} color="#fff" />
                    </div>
                    <span className="quick-action-text" style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {action.label}
                    </span>
                    <ArrowRight size={14} color="#9ca3af" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* decorative illustration placeholder */}

        </div>

        {/* Stats bar */}
          <Card className="stats-card" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 24, padding: "16px 24px" }}>
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
                <div key={stat.key} className="stat-item" style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 160px" }}>
                <div
                    className="stat-icon"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: stat.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={stat.fg} />
                </div>
                <div className="stat-text">
                  <p className="stat-value" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>{stat.value}</p>
                  <p className="stat-label" style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                    {stat.label}
                    <br />
                    {stat.sub}
                  </p>
                </div>
              </div>
            );
          })}
            
        </Card>

        {/* Middle row: recent reports, map, categories */}
        <div className="middle-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.6fr 1fr", gap: 20, alignItems: "stretch" }}>
          {/* Recent Reports */}
          <Card className="recent-reports-card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>Recent Reports</h3>
              <button className="card-link" type="button" style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                View All
              </button>
            </div>
            <div className="recent-reports-list" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {filteredRecentReports.length > 0 ? (
                filteredRecentReports.map((r) => {
                  const Icon = r.icon;
                  const isTopVoted = r.key === topVotedKey;
                  const hasVoted = votedKeys.has(r.key);
                  return (
                    <div
                      key={r.key}
                      className="recent-report-item"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: 8,
                        borderRadius: 10,
                        backgroundColor: isTopVoted ? "#fef2f2" : "transparent",
                        border: isTopVoted ? "1px solid #fecaca" : "1px solid transparent",
                      }}
                    >
                      <button
                        className="vote-button"
                        onClick={() => handleVote(r.key)}
                        aria-label={hasVoted ? `Remove your vote from ${r.title}` : `Upvote ${r.title}`}
                        title={hasVoted ? "You've voted for this issue — click to remove your vote" : "Vote to prioritize this issue"}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 2,
                          width: 40,
                          padding: "6px 0",
                          borderRadius: 8,
                          border: hasVoted ? "1px solid #b91c1c" : "1px solid #e5e7eb",
                          backgroundColor: hasVoted ? "#fef2f2" : "#fff",
                          color: hasVoted ? "#b91c1c" : "#374151",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        <ArrowBigUp size={16} fill={hasVoted ? "#b91c1c" : "none"} />
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{r.votes}</span>
                      </button>
                      <Icon size={18} color={r.color} style={{ flexShrink: 0 }} />
                      <div className="recent-report-copy" style={{ flex: 1, minWidth: 0 }}>
                        <p className="recent-report-title" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{r.title}</p>
                        <p className="recent-report-subtitle" style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{r.sub}</p>
                        <div style={{ marginTop: 4 }}>
                          <SeverityBadge severity={r.severity} prioritized={isTopVoted} />
                        </div>
                      </div>
                      <div className="recent-report-meta" style={{ textAlign: "right", flexShrink: 0 }}>
                        <p className="recent-report-time" style={{ margin: "0 0 4px", fontSize: 11, color: "#9ca3af" }}>{r.time}</p>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  className="recent-reports-empty"
                  style={{padding: "18px 14px",
                    borderRadius: 10,
                    border: "1px dashed #d1d5db",
                    backgroundColor: "#f9fafb",
                    color: "#6b7280",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  No issues match "{query.trim()}".
                </div>
              )}
            </div>
          </Card>

          {/* Report Map Overview */}
          <Card className="map-card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="map-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 className="map-card-title" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>Report Map Overview</h3>
              <button
                className="map-filter-button"
                onClick={handleMapFilterClick}
                aria-label={`Show ${mapFilterLabels[mapFilter]} on map`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: "#374151",
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                {mapFilterLabels[mapFilter]} <ChevronDown size={12} />
              </button>
            </div>

            <div
              className="map-surface"
              style={{
                position: "relative",
                flex: 1,
                minHeight: 220,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <MapContainer
                center={mapCenter}
                zoom={12}
                scrollWheelZoom={false}
                style={{ width: "100%", height: "100%", minHeight: 220 }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredMapMarkers.map((m, i) => (
                  <Marker
                    key={i}
                    position={m.position}
                    icon={buildMarkerIcon(m.count, markerColors[m.status])}
                  >
                    <Tooltip direction="top" offset={[0, -10]}>
                      {m.count} {m.status.replace("-", " ")} report{m.count > 1 ? "s" : ""}
                    </Tooltip>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <div className="map-legend" style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "#4b5563" }}>
              {Object.entries(markerColors).map(([key, color]) => (
                <div key={key} className="map-legend-item" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="map-legend-swatch" style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color }} />
                  {key === "in-progress" ? "In Progress" : key.charAt(0).toUpperCase() + key.slice(1)}
                </div>
              ))}
            </div>
          </Card>

          {/* Top Issue Categories */}
          <Card className="categories-card">
            <h3 className="categories-title" style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "#111827" }}>
              Top Issue Categories
            </h3>
            <div className="categories-chart" style={{ display: "flex", justifyContent: "center", position: "relative", marginBottom: 12 }}>
              <PieChart width={140} height={140}>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={2}
                  stroke="none"
                >
                  {categoryData.map((c) => (
                    <Cell key={c.name} fill={c.color} />
                  ))}
                </Pie>
              </PieChart>
              <div
                className="categories-total"
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  textAlign: "center",
                }}
              >
                <p className="categories-total-value" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>154</p>
                <p className="categories-total-label" style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Total</p>
              </div>
            </div>
            <div className="categories-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {categoryData.map((c) => (
                <div key={c.name} className="category-item" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span className="category-swatch" style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c.color, flexShrink: 0 }} />
                  <span className="category-name" style={{ flex: 1, color: "#374151" }}>{c.name}</span>
                  <span className="category-value" style={{ color: "#111827", fontWeight: 600 }}>
                    {c.value} <span className="category-pct" style={{ color: "#9ca3af", fontWeight: 400 }}>({c.pct}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Bottom row: how it works + CTA */}
        <div className="bottom-grid" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
          <Card className="how-it-works-card">
            <h3 className="how-it-works-title" style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 600, color: "#111827" }}>How It Works</h3>
            <div className="how-it-works-steps" style={{ display: "flex", alignItems: "center" }}>
              {howItWorks.map((s, i) => (
                <div key={s.key} className="how-it-works-step" style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <div className="how-it-works-step-copy" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      className="step-number"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        backgroundColor: i % 2 === 0 ? "#059669" : "#a855f7",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {s.step}
                    </div>
                    <div className="step-copy">
                      <p className="step-title" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.title}</p>
                      <p className="step-subtitle" style={{ margin: 0, fontSize: 11, color: "#9ca3af", maxWidth: 110 }}>{s.sub}</p>
                    </div>
                  </div>
                  {i < howItWorks.length - 1 && (
                    <ArrowRight size={16} color="#d1d5db" style={{ margin: "0 12px", flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div
            className="cta-panel"
            style={{
              borderRadius: 12,
              background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <h3 className="cta-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>Be part of the change</h3>
            <p className="cta-text" style={{ margin: 0, fontSize: 13, color: "#d1fae5" }}>
              Join thousands of citizens making our community better every day.
            </p>
            <button
              className="cta-button"
              style={{
                alignSelf: "flex-start",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                backgroundColor: "#fff",
                color: "#047857",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Report an Issue <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}