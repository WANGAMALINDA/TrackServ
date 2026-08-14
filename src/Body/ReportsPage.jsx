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
  User,
  Calendar,
  X,
  MessageSquare,
  CheckCheck,
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
  
  // State for controlling the Pop-up Modal details view
  const [modalReport, setModalReport] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // Query pulling fields directly from the reports table based on your schema definition
      const { data, error: fetchError } = await supabase
        .from("reports")
        .select(
          `id, description, additional_information, location, status, created_at, updated_at, category_id, 
           assigned_to, assigned_at, proof_image_url, resolution_notes,
           categories(category_name), 
           report_images(image_url, uploaded_at), 
           profiles!reports_user_id_fkey(full_name, username)`
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
      const title = r.title || r.description?.split(/[.\n]/)[0]?.slice(0, 60) || "Untitled report";
      const reporterName = r.profiles?.full_name || r.profiles?.username || "Anonymous";

      // Mapping fields to the reports table columns
      const attendedBy = r.assigned_to || "Unassigned";
      const attendedAtRaw = r.assigned_at ? formatDate(r.assigned_at) : null;
      const fixedImageUrl = r.proof_image_url || null;
      const resolutionNote = r.resolution_notes || "";

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
        attendedBy,
        attendedAt: attendedAtRaw ? `${attendedAtRaw.date} at ${attendedAtRaw.time}` : "Not recorded",
        fixedImageUrl,
        resolutionNote,
      };
    });
  }, [reports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = enriched.filter((r) => {
      if (selectedCategory !== "all" && r.categoryName !== selectedCategory) return false;
      if (!matchesStatusFilter(r.status, statusFilter)) return false;
      if (!q) return true;
      return [r.title, r.description, r.location, r.categoryName, r.reporterName, r.attendedBy].some((v) =>
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
                    return (
                      <tr key={r.id} name={`reportRow-${r.id}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
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
                              name={`viewDetailsPopup-${r.id}`}
                              onClick={() => setModalReport(r)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "6px 12px",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#047857",
                                backgroundColor: "#fff",
                                border: "1px solid #d1fae5",
                                borderRadius: 6,
                                cursor: "pointer",
                              }}
                            >
                              View Details
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

      {/* POP-UP MODAL FOR REPORT DETAILS */}
      {modalReport && (
        <div
          name="reportDetailsModalOverlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            name="reportDetailsModalContent"
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              maxWidth: 650,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              name="modalHeader"
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "sticky",
                top: 0,
                backgroundColor: "#fff",
                zIndex: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 9999,
                    backgroundColor: modalReport.statusBg,
                    color: modalReport.statusFg,
                  }}
                >
                  {modalReport.statusLabel}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>{modalReport.categoryName}</span>
              </div>
              <button
                name="closeModalButton"
                onClick={() => setModalReport(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div name="modalBody" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 700, color: "#111827" }}>{modalReport.title}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280" }}>
                  <MapPin size={14} color="#9ca3af" />
                  {modalReport.location}
                </div>
              </div>

              {/* Issue Description */}
              <div style={{ backgroundColor: "#f9fafb", padding: 14, borderRadius: 10, border: "1px solid #f3f4f6" }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Description & Information
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                  {modalReport.fullDescription || "No description provided."}
                </p>
                {modalReport.additionalInfo && (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                    <strong>Additional info:</strong> {modalReport.additionalInfo}
                  </p>
                )}
              </div>

              {/* Reporter & Submission Details */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "#6b7280" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <User size={13} color="#9ca3af" />
                  Reported by <strong>{modalReport.reporterName}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={13} color="#9ca3af" />
                  {modalReport.date} at {modalReport.time}
                </div>
              </div>

              {/* Original Images Gallery */}
              {modalReport.images.length > 0 && (
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Report Photos ({modalReport.images.length})
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {modalReport.images.map((url, i) => (
                      <img
                        key={url}
                        src={url}
                        alt={`Report photo ${i + 1}`}
                        style={{ width: 90, height: 90, borderRadius: 8, objectFit: "cover", border: "1px solid #e5e7eb" }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "4px 0" }} />

              {/* Resolution / Assigned Details Section */}
              <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #d1fae5", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#065f46", fontWeight: 600, fontSize: 14 }}>
                  <CheckCheck size={16} /> Resolution Details
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                  <div>
                    <span style={{ color: "#6b7280", fontSize: 11, display: "block", textTransform: "uppercase", fontWeight: 600 }}>Assigned To</span>
                    <strong style={{ color: "#1f2937" }}>{modalReport.attendedBy}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#6b7280", fontSize: 11, display: "block", textTransform: "uppercase", fontWeight: 600 }}>Assigned / Resolved Date</span>
                    <strong style={{ color: "#1f2937" }}>{modalReport.attendedAt}</strong>
                  </div>
                </div>

                {/* Optional Note / Comment */}
                {modalReport.resolutionNote && (
                  <div>
                    <span style={{ color: "#6b7280", fontSize: 11, display: "block", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Resolution Note</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", backgroundColor: "#fff", padding: 10, borderRadius: 6, border: "1px solid #e6f4ea", fontSize: 13, color: "#374151" }}>
                      <MessageSquare size={14} color="#059669" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>{modalReport.resolutionNote}</span>
                    </div>
                  </div>
                )}

                {/* Proof Image / Fixed Issue Preview Picture */}
                {modalReport.fixedImageUrl ? (
                  <div>
                    <span style={{ color: "#6b7280", fontSize: 11, display: "block", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Proof of Resolution Preview</span>
                    <img
                      src={modalReport.fixedImageUrl}
                      alt="Proof of resolution preview"
                      style={{ width: "100%", maxHeight: 240, borderRadius: 8, objectFit: "cover", border: "1px solid #cbd5e1" }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                    No proof image provided for this issue yet.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              name="modalFooter"
              style={{
                padding: "12px 24px",
                borderTop: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setModalReport(null)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#047857",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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