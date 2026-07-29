import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "../Components/supabaseClient";
import Footer from "../Components/footer";
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  MapPin,
  MoreVertical,
  FileText,
  Clock,
  SearchCheck,
  CheckCircle2,
  XCircle,
  Droplet,
  TriangleAlert,
  Zap,
  Leaf,
  Shield,
  Trash2,
  Home,
  Bus,
  HeartPulse,
  GraduationCap,
  Trees,
  CircleHelp,
  ImageOff,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
} from "lucide-react";

const PAGE_SIZE = 5;

// Comprehensive list matching the Sidebar category visuals
const CATEGORY_VISUALS = [
  { test: (n) => /water|sanitation|sewer|pipe|leak/i.test(n), icon: Droplet, color: "#3b82f6", bg: "#dbeafe" },
  { test: (n) => /road|infrastructure|pothole|traffic|bridge/i.test(n), icon: TriangleAlert, color: "#f59e0b", bg: "#fef3c7" },
  { test: (n) => /util|power|electr|light|grid/i.test(n), icon: Zap, color: "#10b981", bg: "#d1fae5" },
  { test: (n) => /environment|pollution|nature|air/i.test(n), icon: Leaf, color: "#16a34a", bg: "#dcfce7" },
  { test: (n) => /safety|security|crime|police/i.test(n), icon: Shield, color: "#a855f7", bg: "#f3e8ff" },
  { test: (n) => /waste|garbage|dump|refuse|litter/i.test(n), icon: Trash2, color: "#ef4444", bg: "#fee2e2" },
  { test: (n) => /housing|building|structure|shelter/i.test(n), icon: Home, color: "#8b5cf6", bg: "#ede9fe" },
  { test: (n) => /transport|bus|transit|vehicle/i.test(n), icon: Bus, color: "#06b6d4", bg: "#cffaff" },
  { test: (n) => /health|clinic|hospital|medical/i.test(n), icon: HeartPulse, color: "#ec4899", bg: "#fce7f3" },
  { test: (n) => /education|school|library/i.test(n), icon: GraduationCap, color: "#6366f1", bg: "#e0e7ff" },
  { test: (n) => /park|recreation|garden|green/i.test(n), icon: Trees, color: "#059669", bg: "#d1fae5" },
];
const OTHER_VISUAL = { icon: CircleHelp, color: "#6b7280", bg: "#f3f4f6" };

function getCategoryVisual(categoryName) {
  const name = (categoryName || "").toLowerCase();
  return CATEGORY_VISUALS.find((c) => c.test(name)) || OTHER_VISUAL;
}

const STATUS_META = {
  open: { label: "Under Review", bg: "#dbeafe", fg: "#2563eb" },
  under_review: { label: "Under Review", bg: "#dbeafe", fg: "#2563eb" },
  in_progress: { label: "In Progress", bg: "#fef3c7", fg: "#b45309" },
  resolved: { label: "Resolved", bg: "#d1fae5", fg: "#047857" },
  closed: { label: "Resolved", bg: "#d1fae5", fg: "#047857" },
  rejected: { label: "Rejected", bg: "#fee2e2", fg: "#b91c1c" },
};

const STATUS_FILTERS = [
  { key: "all", label: "All Status" },
  { key: "in_progress", label: "In Progress" },
  { key: "under_review", label: "Under Review" },
  { key: "resolved", label: "Resolved" },
  { key: "rejected", label: "Rejected" },
];

function matchesStatusFilter(status, filterKey) {
  if (filterKey === "all") return true;
  if (filterKey === "under_review") return status === "under_review" || status === "open";
  if (filterKey === "resolved") return status === "resolved" || status === "closed";
  return status === filterKey;
}

function formatDate(dateString) {
  if (!dateString) return { date: "—", time: "" };
  const d = new Date(dateString);
  return {
    date: d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-ZA", { hour: "numeric", minute: "2-digit" }),
  };
}

function Stat({ icon: Icon, iconBg, iconFg, value, label, sub, loading }) {
  return (
    <div
      name={`statCard-${label}`}
      style={{
        flex: "1 1 160px",
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div
        name={`statIconWrapper-${label}`}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Icon size={17} color={iconFg} />
      </div>
      <p name={`statValue-${label}`} style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#111827" }}>{loading ? "…" : value}</p>
      <p name={`statLabel-${label}`} style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</p>
      <p name={`statSub-${label}`} style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{sub}</p>
    </div>
  );
}

export default function ReportsPage({ selectedCategory = "all", onReportClick, onViewReport }) {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const narrow768 = width < 768;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("reports")
        .select(
          "id, description, additional_information, location, status, created_at, updated_at, category_id, categories(category_name), report_images(image_url, uploaded_at), profiles!reports_user_id_fkey(full_name, username)"
        )
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setReports([]);
      } else {
        setReports(data || []);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortOrder, selectedCategory]);

  const stats = useMemo(() => {
    const total = reports.length;
    const inProgress = reports.filter((r) => r.status === "in_progress").length;
    const underReview = reports.filter((r) => r.status === "under_review" || r.status === "open").length;
    const resolved = reports.filter((r) => r.status === "resolved" || r.status === "closed").length;
    const rejected = reports.filter((r) => r.status === "rejected").length;
    return { total, inProgress, underReview, resolved, rejected };
  }, [reports]);

  const enriched = useMemo(() => {
    return reports.map((r) => {
      const images = [...(r.report_images || [])].sort(
        (a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at)
      );
      const categoryName = r.categories?.category_name || "Uncategorized";
      const visual = getCategoryVisual(categoryName);
      const statusMeta = STATUS_META[r.status] || STATUS_META.open;
      const { date, time } = formatDate(r.created_at);
      const title = r.description?.split(/[.\n]/)[0]?.slice(0, 60) || "Untitled report";
      const reporterName = r.profiles?.full_name || r.profiles?.username || "Anonymous";

      return {
        id: r.id,
        title,
        description: r.additional_information || r.description || "",
        fullDescription: r.description || "",
        additionalInfo: r.additional_information || "",
        categoryName,
        categoryIcon: visual.icon,
        categoryColor: visual.color,
        categoryBg: visual.bg,
        location: r.location || "Unknown location",
        status: r.status,
        statusLabel: statusMeta.label,
        statusBg: statusMeta.bg,
        statusFg: statusMeta.fg,
        date,
        time,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        thumbnail: images[0]?.image_url || null,
        images: images.map((img) => img.image_url).filter(Boolean),
        reporterName,
      };
    });
  }, [reports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = enriched.filter((r) => {
      if (selectedCategory !== "all" && r.categoryName !== selectedCategory) return false;
      if (!matchesStatusFilter(r.status, statusFilter)) return false;
      if (!q) return true;
      return [r.title, r.description, r.location, r.categoryName, r.reporterName].some((v) =>
        v.toLowerCase().includes(q)
      );
    });
    list = list.sort((a, b) =>
      sortOrder === "newest"
        ? new Date(b.createdAt) - new Date(a.createdAt)
        : new Date(a.createdAt) - new Date(b.createdAt)
    );
    return list;
  }, [enriched, selectedCategory, statusFilter, query, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectStyle = {
    padding: "8px 12px",
    fontSize: 13,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    backgroundColor: "#fff",
    color: "#374151",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div name="pageContainer" style={{backgroundColor: "#f3f4f6", minHeight: "100vh", paddingTop: 20, paddingBottom: 0, paddingLeft: narrow768 ? 12 : 23, paddingRight: narrow768 ? 12 : 0 }}>
      <div name="contentWrapper" style={{ maxWidth: 1300, margin: "0 10", display: "flex", flexDirection: "column", gap: 20  }}>
        {/* Heading */}
        <div name="headingRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div name="titleBlock">
            <h1 name="pageTitle" style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#111827" }}>Reports</h1>
            <p name="pageSubtitle" style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
              Track the status of issues reported across the community.
            </p>
          </div>
          <button
            name="reportNewIssueButton"
            onClick={onReportClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              backgroundColor: "#047857",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={15} /> Report New Issue
          </button>
        </div>

        {error && (
          <div name="errorBanner" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Stats */}
        <div name="statsRow" style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <Stat icon={FileText} iconBg="#dbeafe" iconFg="#3b82f6" value={stats.total} label="Total Reports" sub="All time" loading={loading} />
          <Stat icon={Clock} iconBg="#fef3c7" iconFg="#f59e0b" value={stats.inProgress} label="In Progress" sub="View details" loading={loading} />
          <Stat icon={SearchCheck} iconBg="#dbeafe" iconFg="#3b82f6" value={stats.underReview} label="Under Review" sub="View details" loading={loading} />
          <Stat icon={CheckCircle2} iconBg="#d1fae5" iconFg="#059669" value={stats.resolved} label="Resolved" sub="View details" loading={loading} />
          <Stat icon={XCircle} iconBg="#fee2e2" iconFg="#ef4444" value={stats.rejected} label="Rejected" sub="View details" loading={loading} />
        </div>

        {/* Search + filters */}
        <div name="searchFilterRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div name="searchWrapper" style={{ position: "relative", flex: "1 1 280px", maxWidth: 380 }}>
            <Search size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              name="reportsSearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all reports..."
              style={{
                width: "100%",
                padding: "9px 12px 9px 34px",
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                backgroundColor: "#fff",
                outline: "none",
              }}
            />
          </div>

          <div name="filtersWrapper" style={{ display: "flex", gap: 10 }}>
            <div name="statusFilterGroup" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={14} color="#9ca3af" />
              <select name="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
                {STATUS_FILTERS.map((s) => (
                  <option key={s.key} name={`statusOption-${s.key}`} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div name="sortFilterGroup" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowUpDown size={14} color="#9ca3af" />
              <select name="sortOrder" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={selectStyle}>
                <option name="sortOptionNewest" value="newest">Newest First</option>
                <option name="sortOptionOldest" value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div name="tableCard" style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div name="tableScrollWrapper" style={{ overflowX: "auto" }}>
            <table name="reportsTable" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead name="tableHead">
                <tr name="tableHeadRow" style={{ backgroundColor: "#f9fafb" }}>
                  {(narrow768 ? ["Issue", "Actions"] : ["Issue", "Category", "Reported By", "Location", "Status", "Date Reported", "Actions"]).map((h) => (
                    <th
                      key={h}
                      name={`headerCell-${h}`}
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody name="tableBody">
                {loading ? (
                  <tr name="loadingRow">
                    <td name="loadingCell" colSpan={narrow768 ? 2 : 7} style={{ padding: 28, textAlign: "center", color: "#9ca3af" }}>
                      Loading reports…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr name="emptyRow">
                    <td name="emptyCell" colSpan={narrow768 ? 2 : 7} style={{ padding: 28, textAlign: "center", color: "#9ca3af" }}>
                      {query || statusFilter !== "all" ? "No reports match your filters." : "No reports have been submitted yet."}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const CategoryIcon = r.categoryIcon;
                    const isExpanded = expandedId === r.id;
                    return (
                      <Fragment key={r.id}>
                      <tr name={`reportRow-${r.id}`} style={{ borderBottom: isExpanded ? "none" : "1px solid #f3f4f6" }}>
                        <td name={`issueCell-${r.id}`} style={{ padding: "14px 16px", maxWidth: 260 }}>
                          <div name={`issueWrapper-${r.id}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <div
                              name={`thumbnailBox-${r.id}`}
                              style={{
                                width: 52,
                                height: 52,
                                borderRadius: 8,
                                backgroundColor: "#f3f4f6",
                                flexShrink: 0,
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {r.thumbnail ? (
                                <img name={`thumbnailImg-${r.id}`} src={r.thumbnail} alt={r.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <ImageOff size={18} color="#d1d5db" />
                              )}
                            </div>
                            <div name={`issueTextBlock-${r.id}`} style={{ minWidth: 0 }}>
                              <p name={`issueTitle-${r.id}`} style={{ margin: 0, fontWeight: 600, color: "#111827" }}>{r.title}</p>
                              <p
                                name={`issueDescription-${r.id}`}
                                style={{
                                  margin: "2px 0 0",
                                  color: "#9ca3af",
                                  fontSize: 12,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                }}
                              >
                                {r.description}
                              </p>
                            </div>
                          </div>
                        </td>
                        {/* CATEGORY COLUMN WITH DYNAMIC ICON */}
                        {!narrow768 && (
                        <td name={`categoryCell-${r.id}`} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <div name={`categoryWrapper-${r.id}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#374151", fontWeight: 500 }}>
                            <div
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                backgroundColor: r.categoryBg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <CategoryIcon size={14} color={r.categoryColor} />
                            </div>
                            <span>{r.categoryName}</span>
                          </div>
                        </td>
                        )}
                        {!narrow768 && (
                        <td name={`reporterCell-${r.id}`} style={{ padding: "14px 16px", whiteSpace: "nowrap", color: "#374151" }}>
                          {r.reporterName}
                        </td>
                        )}
                        {!narrow768 && (
                        <td name={`locationCell-${r.id}`} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <div name={`locationWrapper-${r.id}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#374151" }}>
                            <MapPin size={14} color="#9ca3af" />
                            {r.location}
                          </div>
                        </td>
                        )}
                        {!narrow768 && (
                        <td name={`statusCell-${r.id}`} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <span
                            name={`statusBadge-${r.id}`}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "4px 10px",
                              borderRadius: 9999,
                              backgroundColor: r.statusBg,
                              color: r.statusFg,
                            }}
                          >
                            {r.statusLabel}
                          </span>
                        </td>
                        )}
                        {!narrow768 && (
                        <td name={`dateCell-${r.id}`} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <p name={`dateText-${r.id}`} style={{ margin: 0, color: "#374151" }}>{r.date}</p>
                          <p name={`timeText-${r.id}`} style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{r.time}</p>
                        </td>
                        )}
                        <td name={`actionsCell-${r.id}`} style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <div name={`actionsWrapper-${r.id}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button
                              name={`viewDetails-${r.id}`}
                              onClick={() => setExpandedId((prev) => (prev === r.id ? null : r.id))}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "6px 12px",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#047857",
                                backgroundColor: expandedId === r.id ? "#ecfdf5" : "#fff",
                                border: "1px solid #d1fae5",
                                borderRadius: 6,
                                cursor: "pointer",
                              }}
                            >
                              {expandedId === r.id ? "Hide Details" : "View Details"}
                              {expandedId === r.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                            <button
                              name={`moreActions-${r.id}`}
                              aria-label="More actions"
                              style={{ display: narrow768 ? "none" : "inline-flex", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr name={`expandedRow-${r.id}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td name={`expandedCell-${r.id}`} colSpan={narrow768 ? 2 : 7} style={{ padding: 0, backgroundColor: "#f9fafb" }}>
                            <div name={`expandedPanel-${r.id}`} style={{ padding: narrow768 ? "14px 16px" : "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                              {narrow768 && (
                                <div name={`expandedMobileSummaryRow-${r.id}`} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                  <div
                                    name={`expandedMobileCategoryChip-${r.id}`}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "4px 10px",
                                      borderRadius: 9999,
                                      backgroundColor: r.categoryBg,
                                      color: r.categoryColor,
                                      fontSize: 12,
                                      fontWeight: 600,
                                    }}
                                  >
                                    <CategoryIcon size={13} color={r.categoryColor} />
                                    {r.categoryName}
                                  </div>
                                  <span
                                    name={`expandedMobileStatusBadge-${r.id}`}
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      padding: "4px 10px",
                                      borderRadius: 9999,
                                      backgroundColor: r.statusBg,
                                      color: r.statusFg,
                                    }}
                                  >
                                    {r.statusLabel}
                                  </span>
                                </div>
                              )}

                              {narrow768 && (
                                <div name={`expandedMobileLocationRow-${r.id}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
                                  <MapPin size={13} color="#9ca3af" />
                                  {r.location}
                                </div>
                              )}

                              <div name={`expandedDescriptionBlock-${r.id}`}>
                                <p name={`expandedDescriptionLabel-${r.id}`} style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  Description
                                </p>
                                <p name={`expandedDescriptionText-${r.id}`} style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                                  {r.fullDescription || "No description provided."}
                                </p>
                              </div>

                              {r.additionalInfo && (
                                <div name={`expandedAdditionalInfoBlock-${r.id}`}>
                                  <p name={`expandedAdditionalInfoLabel-${r.id}`} style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Additional Information
                                  </p>
                                  <p name={`expandedAdditionalInfoText-${r.id}`} style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                                    {r.additionalInfo}
                                  </p>
                                </div>
                              )}

                              <div name={`expandedMetaRow-${r.id}`} style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                                <div name={`expandedReporterMeta-${r.id}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
                                  <User size={13} color="#9ca3af" />
                                  Reported by {r.reporterName}
                                </div>
                                <div name={`expandedCreatedMeta-${r.id}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
                                  <Calendar size={13} color="#9ca3af" />
                                  Submitted {r.date} at {r.time}
                                </div>
                                {r.updatedAt && (
                                  <div name={`expandedUpdatedMeta-${r.id}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
                                    <Clock size={13} color="#9ca3af" />
                                    Last updated {formatDate(r.updatedAt).date}
                                  </div>
                                )}
                              </div>

                              {r.images.length > 0 && (
                                <div name={`expandedImagesBlock-${r.id}`}>
                                  <p name={`expandedImagesLabel-${r.id}`} style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Photos ({r.images.length})
                                  </p>
                                  <div name={`expandedImagesGallery-${r.id}`} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {r.images.map((url, i) => (
                                      <img
                                        key={url}
                                        name={`expandedImage-${r.id}-${i}`}
                                        src={url}
                                        alt={`${r.title} photo ${i + 1}`}
                                        style={{ width: 84, height: 84, borderRadius: 8, objectFit: "cover", border: "1px solid #e5e7eb" }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div name="paginationRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <p name="paginationSummary" style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Showing {pageStart} to {pageEnd} of {filtered.length} reports
            </p>
            <div name="paginationButtons" style={{ display: "flex", gap: 6 }}>
              <button
                name="prevPage"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={pagerButtonStyle(false, currentPage === 1)}
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} name={`page-${n}`} onClick={() => setPage(n)} style={pagerButtonStyle(n === currentPage, false)}>
                  {n}
                </button>
              ))}
              <button
                name="nextPage"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={pagerButtonStyle(false, currentPage === totalPages)}
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function pagerButtonStyle(active, disabled) {
  return {
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid #e5e7eb",
    backgroundColor: active ? "#047857" : "#fff",
    color: active ? "#fff" : disabled ? "#d1d5db" : "#374151",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}