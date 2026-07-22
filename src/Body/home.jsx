import { useState, useEffect, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell } from "recharts";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Footer from "../Components/footer";
import { supabase } from "../Components/supabaseClient"; // adjust path if your supabaseClient.js lives elsewhere
import {
  Search,
  SquarePen,
  MessageCircle,
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

// Fallback center for the map before any reports with coordinates have loaded.
const DEFAULT_MAP_CENTER = [-25.7461, 28.1881]; // Tshwane / Pretoria, South Africa

const markerColors = {
  resolved: "#059669",
  "in-progress": "#f59e0b",
  unresolved: "#ef4444",
};

const mapFilterOptions = ["all", "resolved", "in-progress", "unresolved"];
const mapFilterLabels = {
  all: "All Issues",
  resolved: "Resolved",
  "in-progress": "In Progress",
  unresolved: "Unresolved",
};

const severityStyles = {
  High: { bg: "#fee2e2", fg: "#b91c1c" },
  Medium: { bg: "#fef3c7", fg: "#b45309" },
  Low: { bg: "#f3f4f6", fg: "#4b5563" },
};

// Visual treatment (icon + color) derived from a category's name, since
// the database only stores category_name/description, not styling.
const CATEGORY_VISUALS = [
  { test: (n) => n.includes("water"), icon: Droplet, color: "#3b82f6" },
  { test: (n) => n.includes("road") || n.includes("infrastructure"), icon: TriangleAlert, color: "#f59e0b" },
  { test: (n) => n.includes("util") || n.includes("sanitation"), icon: Trash2, color: "#059669" },
  { test: (n) => n.includes("safety") || n.includes("light"), icon: MapPin, color: "#ef4444" },
];
const FALLBACK_VISUAL = { icon: Flame, color: "#a855f7" };

function getCategoryVisual(categoryName) {
  const name = (categoryName || "").toLowerCase();
  const match = CATEGORY_VISUALS.find((c) => c.test(name));
  return match || FALLBACK_VISUAL;
}

// Distinct palette for the Top Issue Categories chart/list, so each category
// gets its own color even when several share the same fallback icon color.
const CATEGORY_CHART_PALETTE = [
  "#3b82f6",
  "#f59e0b",
  "#059669",
  "#ef4444",
  "#a855f7",
  "#0ea5e9",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

function timeAgo(dateString) {
  if (!dateString) return "";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isSameMonth(dateString, reference) {
  if (!dateString) return false;
  const d = new Date(dateString);
  return d.getMonth() === reference.getMonth() && d.getFullYear() === reference.getFullYear();
}

// DB status values are open / in_progress / resolved / closed.
function statusLabel(status) {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return "Open";
  }
}

function markerStatus(status) {
  if (status === "resolved" || status === "closed") return "resolved";
  if (status === "in_progress") return "in-progress";
  return "unresolved";
}

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

function StatusBadge({ status }) {
  const isResolved = status === "Resolved" || status === "Closed";
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

function buildMarkerIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: ${color};
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// selectedCategory is expected to be a categories.category_name (string) or "all"
export default function Home({ selectedCategory = "all", onReportClick, onCommunityClick }) {
  const [query, setQuery] = useState("");
  const [mapFilter, setMapFilter] = useState("all");

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [votedReportIds, setVotedReportIds] = useState(() => new Set());

  // Responsive breakpoints — same resize-listener approach as Sidebar.jsx / Profile.jsx
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const narrow1024 = width < 1024;
  const narrow768 = width < 768;
  const narrow480 = width < 480;

  const normalizedQuery = query.trim().toLowerCase();

  // Load reports (joined with their category) plus the current user's votes.
  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user ?? null;
    setCurrentUserId(user?.id ?? null);

    const { data: reportRows, error: reportsError } = await supabase
      .from("reports")
      .select(
        "id, title, description, location, latitude, longitude, status, severity, votes, created_at, updated_at, category_id, categories(id, category_name)"
      )
      .order("created_at", { ascending: false });

    if (reportsError) {
      setError(reportsError.message);
      setReports([]);
      setLoading(false);
      return;
    }

    setReports(reportRows || []);

    if (user && reportRows?.length) {
      const { data: voteRows, error: votesError } = await supabase
        .from("report_votes")
        .select("report_id")
        .eq("user_id", user.id)
        .in(
          "report_id",
          reportRows.map((r) => r.id)
        );

      if (!votesError) {
        setVotedReportIds(new Set((voteRows || []).map((v) => v.report_id)));
      }
    } else {
      setVotedReportIds(new Set());
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleVote = async (reportId) => {
    if (!currentUserId) {
      alert("Please sign in to vote on a report.");
      return;
    }

    // Optimistic update
    const hadVoted = votedReportIds.has(reportId);
    setVotedReportIds((prev) => {
      const next = new Set(prev);
      hadVoted ? next.delete(reportId) : next.add(reportId);
      return next;
    });
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId ? { ...r, votes: (r.votes || 0) + (hadVoted ? -1 : 1) } : r
      )
    );

    const { data, error: voteError } = await supabase.rpc("toggle_report_vote", {
      p_report_id: reportId,
    });

    if (voteError) {
      // Roll back on failure
      setVotedReportIds((prev) => {
        const next = new Set(prev);
        hadVoted ? next.add(reportId) : next.delete(reportId);
        return next;
      });
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, votes: (r.votes || 0) + (hadVoted ? 1 : -1) } : r
        )
      );
      console.error("Vote failed:", voteError.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (result) {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, votes: result.votes } : r))
      );
    }
  };

  const topVotedId = useMemo(() => {
    let leaderId = null;
    let leaderVotes = 0;
    reports.forEach((r) => {
      if ((r.votes || 0) > leaderVotes) {
        leaderVotes = r.votes;
        leaderId = r.id;
      }
    });
    return leaderId;
  }, [reports]);

  // Stats bar — computed from live reports instead of hardcoded numbers.
  const stats = useMemo(() => {
    const now = new Date();
    const total = reports.length;
    const inProgress = reports.filter((r) => r.status === "in_progress").length;
    const resolved = reports.filter((r) => r.status === "resolved" || r.status === "closed").length;
    const communityFixes = reports.filter(
      (r) => (r.status === "resolved" || r.status === "closed") && isSameMonth(r.updated_at, now)
    ).length;

    return [
      { key: "total", label: "Total Reports", sub: "All time", value: total, icon: FileText, bg: "#d1fae5", fg: "#059669" },
      { key: "review", label: "In Progress", sub: "Reports", value: inProgress, icon: Activity, bg: "#dbeafe", fg: "#3b82f6" },
      { key: "resolved", label: "Resolved", sub: "Reports", value: resolved, icon: Clock, bg: "#fef3c7", fg: "#f59e0b" },
      { key: "community", label: "Community Fixes", sub: "This month", value: communityFixes, icon: Users, bg: "#f3e8ff", fg: "#a855f7" },
    ];
  }, [reports]);

  const quickActions = [
    { key: "report", label: "Report an Issue", icon: SquarePen, bg: "#047857" },
    { key: "community", label: "Join Community", icon: MessageCircle, bg: "#3b82f6" },
  ];

  const howItWorks = [
    { key: "discover", step: 1, title: "Discover", sub: "Notice an issue in your area" },
    { key: "report", step: 2, title: "Report", sub: "Submit details in seconds" },
    { key: "track", step: 3, title: "Track", sub: "We review and keep you updated" },
    { key: "resolve", step: 4, title: "Resolve", sub: "We take action and notify you" },
  ];

  // Recent reports list, enriched with icon/color/status label and severity
  // (auto-escalated to High for whichever report currently has the most votes).
  const recentReports = useMemo(() => {
    return reports.slice(0, 8).map((r) => {
      const visual = getCategoryVisual(r.categories?.category_name);
      return {
        key: r.id,
        categoryName: r.categories?.category_name || "Uncategorized",
        title: r.title || r.description?.slice(0, 60) || "Untitled report",
        sub: r.location || "Unknown location",
        time: timeAgo(r.created_at),
        status: statusLabel(r.status),
        icon: visual.icon,
        color: visual.color,
        votes: r.votes || 0,
        severity: r.id === topVotedId && (r.votes || 0) > 0 ? "High" : r.severity || "Low",
      };
    });
  }, [reports, topVotedId]);

  const filteredRecentReports = useMemo(() => {
    return recentReports
      .filter((report) => {
        if (selectedCategory !== "all" && report.categoryName !== selectedCategory) return false;
        if (!normalizedQuery) return true;
        return [report.title, report.sub, report.time, report.status].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 3);
  }, [recentReports, selectedCategory, normalizedQuery]);

  // Map markers — one per report with coordinates, colored by status.
  const mapPoints = useMemo(() => {
    return reports
      .filter((r) => r.latitude != null && r.longitude != null)
      .filter((r) => selectedCategory === "all" || r.categories?.category_name === selectedCategory)
      .map((r) => ({
        id: r.id,
        position: [Number(r.latitude), Number(r.longitude)],
        status: markerStatus(r.status),
        title: r.title || r.description || "Report",
      }));
  }, [reports, selectedCategory]);

  const filteredMapMarkers = useMemo(
    () => (mapFilter === "all" ? mapPoints : mapPoints.filter((m) => m.status === mapFilter)),
    [mapPoints, mapFilter]
  );

  const mapCenter = useMemo(() => {
    if (mapPoints.length === 0) return DEFAULT_MAP_CENTER;
    const [latSum, lngSum] = mapPoints.reduce(
      ([lat, lng], m) => [lat + m.position[0], lng + m.position[1]],
      [0, 0]
    );
    return [latSum / mapPoints.length, lngSum / mapPoints.length];
  }, [mapPoints]);

  const handleMapFilterClick = () => {
    const currentIndex = mapFilterOptions.indexOf(mapFilter);
    const nextIndex = (currentIndex + 1) % mapFilterOptions.length;
    setMapFilter(mapFilterOptions[nextIndex]);
  };

  // Top issue categories — grouped live from the fetched reports.
  const categoryData = useMemo(() => {
    const counts = new Map();
    reports.forEach((r) => {
      const name = r.categories?.category_name || "Uncategorized";
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    const total = reports.length || 1;
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      pct: Math.round((value / total) * 100),
      color: CATEGORY_CHART_PALETTE[i % CATEGORY_CHART_PALETTE.length],
    }));
  }, [reports]);

  return (
    <div className="home-page" style={{ backgroundColor: "#f3f4f6", minHeight: "100vh", paddingTop: 20, paddingBottom: 0, paddingLeft: 10 }}>
      <div className="home-shell" style={{ maxWidth: 1300, margin: "0 10", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Hero */}
        <div
          className="hero-panel"
          style={{
            position: "relative",
            borderRadius: 16,
            overflow: "hidden",
            background: "linear-gradient(90deg, #ecfdf5 0%, rgb(208, 218, 229) 100%)",
            padding: narrow768 ? "22px 18px 20px" : "32px 32px 24px",
          }}
        >
          <div className="hero-content" style={{ maxWidth: 520, position: "relative", zIndex: 2 }}>
            <h1 className="hero-title" style={{ margin: 0, fontSize: narrow480 ? 24 : 32, fontWeight: 700, color: "#111827", lineHeight: 1.25 }}>
              Together, let's build
              <br />
              <span className="hero-title-accent" style={{ color: "#047857" }}>a better community</span>
            </h1>
            <p className="hero-description" style={{ margin: "12px 0 20px", fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>
              Report issues, track progress, and stay updated. Your voice makes a difference.
            </p>

            <div className="hero-actions" style={{ display: "flex", gap: 10 }}>
              <div className="hero-search" style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                <Search size={16} color="#e2e7f0" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
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
            <div className="quick-actions-grid" style={{ display: "grid", gridTemplateColumns: narrow480 ? "1fr" : "repeat(2, 1fr)", gap: 10, maxWidth: 600 }}>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    className="quick-action-button"
                    onClick={
                      action.key === "report"
                        ? onReportClick
                        : action.key === "community"
                        ? onCommunityClick
                        : undefined
                    }
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
        </div>

        {error && (
          <Card style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>
            Couldn't load reports: {error}
          </Card>
        )}

        {/* Stats bar */}
        <Card className="stats-card" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 24, padding: "16px 24px" }}>
          {stats.map((stat) => {
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
                  <p className="stat-value" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
                    {loading ? "…" : stat.value}
                  </p>
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
        <div className="middle-grid" style={{ display: "grid", gridTemplateColumns: narrow1024 ? "1fr" : "1.1fr 1.6fr 1fr", gap: 20, alignItems: "stretch" }}>
          {/* Recent Reports */}
          <Card className="recent-reports-card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>Recent Reports</h3>
              <button className="card-link" type="button" style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                View All
              </button>
            </div>
            <div className="recent-reports-list" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {loading ? (
                <div style={{ padding: "18px 14px", fontSize: 13, color: "#6b7280", textAlign: "center" }}>Loading reports…</div>
              ) : filteredRecentReports.length > 0 ? (
                filteredRecentReports.map((r) => {
                  const Icon = r.icon;
                  const isTopVoted = r.key === topVotedId && r.votes > 0;
                  const hasVoted = votedReportIds.has(r.key);
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
                  style={{
                    padding: "18px 14px",
                    borderRadius: 10,
                    border: "1px dashed #d1d5db",
                    backgroundColor: "#f9fafb",
                    color: "#6b7280",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  {normalizedQuery ? `No issues match "${query.trim()}".` : "No reports yet."}
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

            <div className="map-surface" style={{ position: "relative", flex: 1, minHeight: 220, borderRadius: 10, overflow: "hidden" }}>
              <MapContainer center={mapCenter} zoom={12} scrollWheelZoom={false} style={{ width: "100%", height: "100%", minHeight: 220 }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredMapMarkers.map((m) => (
                  <Marker key={m.id} position={m.position} icon={buildMarkerIcon(markerColors[m.status])}>
                    <Tooltip direction="top" offset={[0, -10]}>
                      {m.title} — {m.status.replace("-", " ")}
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
            {categoryData.length > 0 ? (
              <>
                <div className="categories-chart" style={{ display: "flex", justifyContent: "center", position: "relative", marginBottom: 12 }}>
                  <PieChart width={140} height={140}>
                    <Pie data={categoryData} dataKey="value" innerRadius={45} outerRadius={65} paddingAngle={2} stroke="none">
                      {categoryData.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="categories-total" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                    <p className="categories-total-value" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>{reports.length}</p>
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
              </>
            ) : (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>{loading ? "Loading…" : "No reports yet."}</p>
            )}
          </Card>
        </div>

        {/* Bottom row: how it works + CTA */}
        <div className="bottom-grid" style={{ display: "grid", gridTemplateColumns: narrow768 ? "1fr" : "1.6fr 1fr", gap: 20 }}>
          <Card className="how-it-works-card">
            <h3 className="how-it-works-title" style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 600, color: "#111827" }}>How It Works</h3>
            <div className="how-it-works-steps" style={{ display: "flex", flexDirection: narrow768 ? "column" : "row", alignItems: narrow768 ? "stretch" : "center", gap: narrow768 ? 16 : 0 }}>
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
                  {!narrow768 && i < howItWorks.length - 1 && (
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
              onClick={onReportClick}
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