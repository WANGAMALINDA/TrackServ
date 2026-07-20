import { useState, useRef, useEffect, useMemo } from "react";
import Footer from '../Components/footer'
import { supabase } from "../Components/supabaseClient";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  MapPin,
  Calendar,
  Mail,
  Phone,
  Pencil,
  Camera,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Users,
  Star,
  Leaf,
  Flame,
  Shield,
  Flag,
  Moon,
  ChevronRight,
  Award,
} from "lucide-react";

/* ---------- Design tokens (was :root CSS variables) ---------- */
const C = {
  green900: "#0f3d2b",
  green700: "#1a6b45",
  green600: "#1f8354",
  green500: "#2ea36b",
  green100: "#e4f5ec",
  green050: "#f2faf6",
  amber500: "#e8a33d",
  amber100: "#fdf1de",
  blue500: "#3b82c4",
  blue100: "#e5f1fb",
  purple500: "#8b5fbf",
  purple100: "#f0e9f9",
  ink900: "#152420",
  ink700: "#3d4a45",
  ink500: "#6b7a74",
  ink300: "#a4b0ac",
  bg: "#eef1ef",
  card: "#ffffff",
  border: "#e6eae7",
};
const RADIUS = { lg: 18, md: 12, sm: 8 };
const SHADOW_CARD = "0 1px 2px rgba(15,61,43,0.04), 0 8px 24px -12px rgba(15,61,43,0.12)";
const FONT_DISPLAY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const cardStyle = {
  background: C.card,
  borderRadius: RADIUS.lg,
  boxShadow: SHADOW_CARD,
  border: `1px solid ${C.border}`,
};

/* ---------- Default (empty) shapes — real values are loaded from Supabase ---------- */
const defaultProfile = {
  name: "",
  location: "",
  email: "",
  phone: "",
  about: "",
  since: "",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=citizen&backgroundColor=b6e3f4",
  emailNotif: true,
  publicProfile: true,
  role: "citizen",
};

const badgeIcons = { users: Users, star: Star, leaf: Leaf, check: CheckCircle2, flame: Flame, shield: Shield, flag: Flag, moon: Moon };

// profiles.role is one of 'citizen' | 'moderator' | 'admin'
const roleLabels = { citizen: "Active Citizen", moderator: "Moderator", admin: "Administrator" };
function roleLabel(role) {
  return roleLabels[role] || roleLabels.citizen;
}

const statusMeta = {
  open: { label: "Open", Icon: FileText, bg: C.green100, fg: C.green600 },
  in_progress: { label: "In Progress", Icon: Clock, bg: C.amber100, fg: C.amber500 },
  resolved: { label: "Resolved", Icon: CheckCircle2, bg: C.blue100, fg: C.blue500 },
  closed: { label: "Closed", Icon: XCircle, bg: C.purple100, fg: C.purple500 },
};

/* ---------- Small formatting helpers ---------- */
function formatMonthYear(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatRelative(dateStr) {
  if (!dateStr) return "";
  const then = new Date(dateStr).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}


const TABS = [
  { key: "overview", label: "Overview" },
  { key: "activity", label: "Activity" },
  { key: "reports", label: "My Reports" },
  { key: "notifications", label: "Notifications" },
  { key: "settings", label: "Settings" },
];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

/* ---------- Small reusable pieces ---------- */

function Btn({ variant = "outline", children, style, ...rest }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    padding: "9px 16px",
    borderRadius: 999,
    border: "1px solid transparent",
    cursor: "pointer",
    fontFamily: "inherit",
  };
  const variants = {
    outline: { background: C.card, borderColor: C.border, color: C.ink900 },
    primary: { background: C.green700, color: "#fff" },
    ghost: { background: "transparent", color: C.ink500, borderColor: C.border },
  };
  return (
    <button className="btn" style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}

function ReportRow({ report }) {
  const meta = statusMeta[report.status];
  const Icon = meta.Icon;
  return (
    <div
      className="report-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        border: `1px solid ${C.border}`,
        borderRadius: RADIUS.md,
        padding: "12px 14px",
      }}
    >
      <span
        className="report-row__icon"
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: meta.bg,
          color: meta.fg,
        }}
      >
        <Icon size={18} />
      </span>
      <div className="report-row__body" style={{ flex: 1, minWidth: 0 }}>
        <p className="report-row__title" style={{ fontWeight: 600, fontSize: 14, margin: "0 0 2px" }}>{report.title}</p>
        <p className="report-row__meta" style={{ fontSize: 12, color: C.ink500, margin: 0 }}>
          {report.category} · {report.date}
        </p>
      </div>
      <span
        className="report-row__status"
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: "4px 10px",
          borderRadius: 999,
          whiteSpace: "nowrap",
          background: meta.bg,
          color: meta.fg,
        }}
      >
        {meta.label}
      </span>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      className="toggle"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        width: 42,
        height: 24,
        flexShrink: 0,
        border: "none",
        borderRadius: 999,
        background: checked ? C.green600 : "#ccd6d0",
        padding: 0,
        cursor: "pointer",
        transition: "background .2s",
      }}
    >
      <span
        className="toggle__thumb"
        style={{
          position: "absolute",
          height: 18,
          width: 18,
          left: checked ? 21 : 3,
          top: 3,
          background: "#fff",
          borderRadius: "50%",
          transition: "left .2s",
          boxShadow: "0 1px 2px rgba(0,0,0,.2)",
        }}
      />
    </button>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${C.border}`,
  borderRadius: RADIUS.sm,
  fontSize: 14,
  fontFamily: "inherit",
  background: C.bg,
  outline: "none",
};

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: C.ink700 };

/* ---------- Main component ---------- */

export default function Profile() {
  const [userId, setUserId] = useState(null);
  const [profile, setProfile] = useState(defaultProfile);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [reportFilter, setReportFilter] = useState("all");
  const [notifs, setNotifs] = useState([]);
  const [badges, setBadges] = useState([]);
  const [toast, setToast] = useState({ message: "", visible: false });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState(defaultProfile);
  const [settingsDraft, setSettingsDraft] = useState(defaultProfile);

  const toastTimer = useRef(null);
  const avatarInputRef = useRef(null);

  // Responsive breakpoints — same resize-listener approach as Sidebar.jsx
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const narrow980 = width < 980;
  const narrow640 = width < 640;

  function showToast(message) {
    clearTimeout(toastTimer.current);
    setToast({ message, visible: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2400);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape" && modalOpen) setModalOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  // Load the signed-in user's profile + reports from Supabase
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setLoadError("You need to be logged in to view your profile.");
          setLoading(false);
        }
        return;
      }

      let { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        setLoadError(profileError.message);
        setLoading(false);
        return;
      }

      // No profiles row yet for this account (e.g. sign-up never created one) — create a minimal one now.
      if (!profileRow) {
        const emailUsername = (user.email || "user").split("@")[0];

        const { data: created, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || "",
            username: emailUsername,
            location: "Tshwane Municipality",
          })
          .select("*")
          .single();

        if (createError) {
          setLoadError(createError.message);
          setLoading(false);
          return;
        }
        profileRow = created;
      }

      const { data: reportRows, error: reportsError } = await supabase
        .from("reports")
        .select("id, description, status, created_at, categories(category_name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      setUserId(user.id);
      const loadedProfile = {
        name: profileRow?.full_name || "",
        location: profileRow?.location || "",
        email: profileRow?.email || user.email || "",
        phone: profileRow?.phone || "",
        about: profileRow?.about || "",
        since: formatMonthYear(profileRow?.created_at),
        avatar: profileRow?.profile_picture || defaultProfile.avatar,
        emailNotif: profileRow?.email_notifications ?? true,
        publicProfile: profileRow?.public_profile ?? true,
        role: profileRow?.role || "citizen",
      };
      setProfile(loadedProfile);
      setSettingsDraft(loadedProfile);

      if (!reportsError && reportRows) {
        setReports(
          reportRows.map((r) => ({
            id: r.id,
            title: r.description,
            category: r.categories?.category_name || "General",
            date: formatRelative(r.created_at),
            status: r.status,
            createdAt: r.created_at,
          }))
        );
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAvatarChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !userId) return;

    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("Profile")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      showToast("Couldn't upload photo — try again.");
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("Profile").getPublicUrl(path);
    const avatarUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ profile_picture: avatarUrl })
      .eq("id", userId);

    if (updateError) {
      showToast("Photo uploaded but profile update failed.");
      return;
    }

    setProfile((p) => ({ ...p, avatar: avatarUrl }));
    showToast("Profile photo updated.");
  }

  async function persistProfile(fields) {
    if (!userId) return false;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fields.name,
        location: fields.location,
        email: fields.email,
        phone: fields.phone,
        about: fields.about,
        email_notifications: fields.emailNotif,
        public_profile: fields.publicProfile,
      })
      .eq("id", userId);
    return !error;
  }

  async function handleSettingsSubmit(e) {
    e.preventDefault();
    const ok = await persistProfile(settingsDraft);
    if (ok) {
      setProfile((p) => ({ ...p, ...settingsDraft }));
      showToast("Settings saved.");
    } else {
      showToast("Couldn't save settings — try again.");
    }
  }
  function handleSettingsReset() {
    setSettingsDraft(profile);
    showToast("Changes discarded.");
  }

  function openEditModal() {
    setModalDraft(profile);
    setModalOpen(true);
  }
  async function handleModalSubmit(e) {
    e.preventDefault();
    const nextProfile = { ...profile, ...modalDraft, name: modalDraft.name.trim() || profile.name };
    const ok = await persistProfile(nextProfile);
    if (ok) {
      setProfile(nextProfile);
      setModalOpen(false);
      showToast("Profile updated.");
    } else {
      showToast("Couldn't update profile — try again.");
    }
  }

  function markAllRead() {
    setNotifs((list) => list.map((n) => ({ ...n, read: true })));
  }

  const filteredReports = reportFilter === "all" ? reports : reports.filter((r) => r.status === reportFilter);
  const stats = {
    submitted: reports.length,
    progress: reports.filter((r) => r.status === "in_progress").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    rejected: reports.filter((r) => r.status === "closed").length,
  };

  // Derived from real reports — no dedicated activity-log table in the schema
  const activityData = useMemo(
    () =>
      [...reports]
        .slice(0, 6)
        .map((r) => ({
          title:
            r.status === "resolved"
              ? `Report resolved: ${r.title}`
              : `Submitted report: ${r.title}`,
          meta: formatRelative(r.createdAt),
        })),
    [reports]
  );

  // Derived from real reports — no dedicated monthly-impact table in the schema
  const impactData = useMemo(() => {
    const buckets = {};
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets[d.toLocaleDateString("en-US", { month: "short" })] = 0;
    }
    reports.forEach((r) => {
      if (!r.createdAt) return;
      const label = new Date(r.createdAt).toLocaleDateString("en-US", { month: "short" });
      if (label in buckets) buckets[label] += 1;
    });
    return Object.entries(buckets).map(([month, value]) => ({ month, value }));
  }, [reports]);

  if (loading) {
    return (
      <div className="profile-page" style={{ background: C.bg, color: C.ink900, minHeight: "100%", padding: "40px 20px", textAlign: "center" }}>
        <p style={{ color: C.ink500 }}>Loading your profile...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="profile-page" style={{ background: C.bg, color: C.ink900, minHeight: "100%", padding: "40px 20px", textAlign: "center" }}>
        <p style={{ color: C.ink500 }}>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="profile-page" style={{ background: C.bg, color: C.ink900, minHeight: "100%", padding: "15px 20px" }}>
      <div className="profile-page__container" style={{ maxWidth: 1300, padding: "0 20", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Page head */}
        <div className="profile-page__head" style={{ marginBottom: 18 }}>
          <h1 className="profile-page__title" style={{ fontFamily: FONT_DISPLAY, fontSize: "1.7rem", margin: "0 0 4px", color: C.ink900 }}>
            My Profile
          </h1>
          <nav className="breadcrumb" aria-label="Breadcrumb" style={{ fontSize: 13, color: C.ink500 }}>
            <a className="breadcrumb__link" href="#" style={{ color: "inherit", textDecoration: "none" }}>
              Home
            </a>
            <span className="breadcrumb__sep" style={{ margin: "0 6px", color: C.ink300 }}>›</span>
            <span className="breadcrumb__current" aria-current="page">My Profile</span>
          </nav>
        </div>

        <div
          className="profile-page__grid"
          style={{
            display: "grid",
            gridTemplateColumns: narrow980 ? "1fr" : "minmax(0,1fr) 340px",
            gap: 22,
            alignItems: "start",
          }}
        >
          {/* MAIN COLUMN */}
          <main className="profile-main">
            <section className="profile-card" style={{ ...cardStyle, overflow: "hidden" }}>
              <div
                className="profile-card__banner"
                style={{
                  height: 112,
                  background: `linear-gradient(160deg, ${C.green700}, ${C.green900} 75%)`,
                  position: "relative",
                }}
              >
                <svg
                  className="profile-card__banner-art"
                  viewBox="0 0 700 90"
                  preserveAspectRatio="none"
                  style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "60%", fill: "rgba(255,255,255,.08)" }}
                >
                  <rect x="0" y="40" width="26" height="50" />
                  <rect x="30" y="20" width="18" height="70" />
                  <rect x="52" y="50" width="22" height="40" />
                  <rect x="120" y="35" width="20" height="55" />
                  <rect x="145" y="15" width="16" height="75" />
                  <rect x="550" y="45" width="24" height="45" />
                  <rect x="580" y="25" width="18" height="65" />
                  <rect x="605" y="55" width="20" height="35" />
                  <rect x="650" y="10" width="18" height="80" />
                </svg>
              </div>

              <div
                className="profile-card__identity"
                style={{
                  display: "flex",
                  flexDirection: narrow640 ? "column" : "row",
                  alignItems: narrow640 ? "flex-start" : "flex-end",
                  gap: 18,
                  padding: "0 28px 18px",
                  marginTop: narrow640 ? -40 : -46,
                }}
              >
                <div className="profile-avatar" style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    className="profile-avatar__img"
                    src={profile.avatar}
                    alt={`Profile photo of ${profile.name}`}
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: "50%",
                      border: `4px solid ${C.card}`,
                      objectFit: "cover",
                      background: C.green100,
                      display: "block",
                    }}
                  />
                  <button
                    className="profile-avatar__edit-btn"
                    aria-label="Change photo"
                    onClick={() => avatarInputRef.current?.click()}
                    style={{
                      position: "absolute",
                      bottom: 2,
                      right: 2,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: C.ink900,
                      color: "#fff",
                      border: `2px solid ${C.card}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <Camera size={13} />
                  </button>
                  <input
                    name="avatarUpload"
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    hidden
                    onChange={handleAvatarChange}
                  />
                </div>

                <div className="profile-identity__info" style={{ flex: 1, paddingTop: 52, minWidth: 0 }}>
                  <h2 className="profile-identity__name" style={{ margin: "0 0 4px", fontFamily: FONT_DISPLAY, fontSize: "1.35rem" }}>{profile.name}</h2>
                  <span
                    className="profile-identity__badge"
                    style={{
                      display: "inline-block",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 999,
                      marginBottom: 8,
                      background: C.green100,
                      color: C.green700,
                    }}
                  >
                    {roleLabel(profile.role)}
                  </span>
                  <div className="profile-identity__meta" style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, color: C.ink500 }}>
                    <span className="profile-identity__meta-item" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <MapPin size={14} />
                      <span>{profile.location}</span>
                    </span>
                    <span className="profile-identity__meta-item" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Calendar size={14} />
                      Member since <span>{profile.since}</span>
                    </span>
                  </div>
                </div>

                <Btn variant="outline" className="profile-identity__edit-btn" onClick={openEditModal} style={{ marginTop: narrow640 ? 10 : 52, whiteSpace: "nowrap" }}>
                  <Pencil size={15} />
                  Edit Profile
                </Btn>
              </div>

              {/* Tabs */}
              <nav
                className="profile-tabs"
                style={{
                  display: "flex",
                  gap: narrow640 ? 14 : 22,
                  padding: "0 28px",
                  borderBottom: `1px solid ${C.border}`,
                  overflowX: "auto",
                }}
              >
                {TABS.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      className="profile-tabs__tab"
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: "12px 2px 14px",
                        fontSize: 14,
                        fontWeight: 600,
                        color: active ? C.green700 : C.ink500,
                        borderBottom: `2px solid ${active ? C.green700 : "transparent"}`,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              <div className="profile-tabpanel" style={{ padding: "22px 28px 26px" }}>
                {/* OVERVIEW */}
                {activeTab === "overview" && (
                  <section className="overview-panel">
                    <div className="overview-panel__grid" style={{ display: "grid", gridTemplateColumns: narrow640 ? "1fr" : "1fr 200px", gap: 24 }}>
                      <div className="overview-panel__about">
                        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontFamily: FONT_DISPLAY }}>About Me</h3>
                        <p style={{ color: C.ink700, lineHeight: 1.55, fontSize: 14, margin: "0 0 16px" }}>{profile.about}</p>
                        <ul className="contact-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                          {[
                            [Mail, profile.email],
                            [Phone, profile.phone],
                            [MapPin, profile.location],
                          ].map(([Icon, text], i) => (
                            <li key={i} className="contact-list__item" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: C.ink700 }}>
                              <Icon size={18} color={C.green600} />
                              <span>{text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div
                        className="level-card"
                        style={{
                          background: C.green050,
                          border: `1px solid ${C.green100}`,
                          borderRadius: RADIUS.md,
                          padding: "20px 16px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                        }}
                      >
                        <div
                          className="level-card__icon"
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background: `linear-gradient(160deg, ${C.green500}, ${C.green700})`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            marginBottom: 10,
                          }}
                        >
                          <Award size={28} />
                        </div>
                        <h4 className="level-card__title" style={{ margin: "0 0 2px", fontFamily: FONT_DISPLAY, fontSize: "1.05rem" }}>Level 3</h4>
                        <span className="level-card__subtitle" style={{ fontSize: 12, color: C.ink500, marginBottom: 12 }}>Community Contributor</span>
                        <div className="level-card__bar" style={{ width: "100%", height: 6, borderRadius: 999, background: "#dfe9e3", overflow: "hidden" }}>
                          <div className="level-card__bar-fill" style={{ height: "100%", width: "64%", background: `linear-gradient(90deg, ${C.green500}, ${C.green700})`, borderRadius: 999 }} />
                        </div>
                        <span className="level-card__xp" style={{ fontSize: 11, color: C.ink500, marginTop: 6 }}>320 / 500 XP</span>
                      </div>
                    </div>
                  </section>
                )}

                {/* ACTIVITY */}
                {activeTab === "activity" && (
                  <section className="activity-panel">
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, fontFamily: FONT_DISPLAY }}>Recent Activity</h3>
                    <ul className="activity-timeline" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
                      {activityData.length === 0 && (
                        <p style={{ color: C.ink500, fontSize: 14 }}>No activity yet — submit a report to get started.</p>
                      )}
                      {activityData.map((a, i) => {
                        const last = i === activityData.length - 1;
                        return (
                          <li
                            key={i}
                            className="activity-timeline__item"
                            style={{
                              position: "relative",
                              padding: last ? "0 0 0 26px" : "0 0 20px 26px",
                              fontSize: 14,
                              borderLeft: `2px solid ${last ? "transparent" : C.border}`,
                              marginLeft: 5,
                            }}
                          >
                            <span
                              className="activity-timeline__dot"
                              style={{
                                position: "absolute",
                                left: -6,
                                top: 1,
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: C.green500,
                                border: "2px solid #fff",
                                boxShadow: `0 0 0 1px ${C.green500}`,
                              }}
                            />
                            <span className="activity-timeline__title" style={{ fontWeight: 600, color: C.ink900, display: "block" }}>{a.title}</span>
                            <span className="activity-timeline__meta" style={{ color: C.ink500, fontSize: 12 }}>{a.meta}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* MY REPORTS */}
                {activeTab === "reports" && (
                  <section className="reports-panel">
                    <div className="reports-panel__head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontFamily: FONT_DISPLAY }}>My Reports</h3>
                      <div className="reports-panel__filters" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {FILTERS.map((f) => {
                          const active = reportFilter === f.key;
                          return (
                            <button
                              key={f.key}
                              className="reports-panel__filter-btn"
                              onClick={() => setReportFilter(f.key)}
                              style={{
                                border: `1px solid ${active ? C.green700 : C.border}`,
                                background: active ? C.green700 : C.card,
                                color: active ? "#fff" : C.ink500,
                                padding: "6px 14px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              {f.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="reports-panel__list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {filteredReports.length ? (
                        filteredReports.map((r) => <ReportRow key={r.id} report={r} />)
                      ) : (
                        <p style={{ color: C.ink500, fontSize: 14 }}>No reports match this filter yet.</p>
                      )}
                    </div>
                  </section>
                )}


                {/* NOTIFICATIONS */}
                {activeTab === "notifications" && (
                  <section className="notifications-panel">
                    <div className="notifications-panel__head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontFamily: FONT_DISPLAY }}>Notifications</h3>
                      {notifs.length > 0 && (
                      <button
                        className="notifications-panel__mark-read"
                        onClick={markAllRead}
                        style={{ background: "none", border: "none", color: C.green700, fontWeight: 600, fontSize: 13, padding: 0, cursor: "pointer" }}
                      >
                        Mark all as read
                      </button>
                      )}
                    </div>
                    <ul className="notification-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                      {notifs.length === 0 && (
                        <p style={{ color: C.ink500, fontSize: 14 }}>You're all caught up — no notifications.</p>
                      )}
                      {notifs.map((n, i) => {
                        const last = i === notifs.length - 1;
                        return (
                          <li
                            key={i}
                            className="notification-list__item"
                            style={{
                              display: "flex",
                              gap: 12,
                              alignItems: "flex-start",
                              padding: "12px 4px",
                              borderBottom: last ? "none" : `1px solid ${C.border}`,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: n.read ? C.ink300 : C.green500,
                                marginTop: 6,
                                flexShrink: 0,
                              }}
                            />
                            <div className="notification-list__body">
                              <p className="notification-list__text" style={{ fontSize: 14, color: n.read ? C.ink500 : C.ink900, margin: 0 }}>{n.text}</p>
                              <p className="notification-list__time" style={{ fontSize: 11, color: C.ink500, marginTop: 2, marginBottom: 0 }}>{n.time}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* SETTINGS */}
                {activeTab === "settings" && (
                  <section className="settings-panel">
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, fontFamily: FONT_DISPLAY }}>Account Settings</h3>
                    <form className="settings-form" onSubmit={handleSettingsSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
                      <div className="settings-form__field">
                        <label style={labelStyle} htmlFor="fldName">
                          Full name
                        </label>
                        <input
                          id="fldName"
                          name="name"
                          type="text"
                          required
                          value={settingsDraft.name}
                          onChange={(e) => setSettingsDraft((d) => ({ ...d, name: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                      <div className="settings-form__row" style={{ display: "grid", gridTemplateColumns: narrow640 ? "1fr" : "1fr 1fr", gap: 14 }}>
                        <div className="settings-form__field">
                          <label style={labelStyle} htmlFor="fldEmail">
                            Email
                          </label>
                          <input
                            id="fldEmail"
                            name="email"
                            type="email"
                            required
                            value={settingsDraft.email}
                            onChange={(e) => setSettingsDraft((d) => ({ ...d, email: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>
                        <div className="settings-form__field">
                          <label style={labelStyle} htmlFor="fldPhone">
                            Phone
                          </label>
                          <input
                            id="fldPhone"
                            name="phone"
                            type="tel"
                            value={settingsDraft.phone}
                            onChange={(e) => setSettingsDraft((d) => ({ ...d, phone: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                      <div className="settings-form__field">
                        <label style={labelStyle} htmlFor="fldLocation">
                          Location
                        </label>
                        <input
                          id="fldLocation"
                          name="location"
                          type="text"
                          value={settingsDraft.location}
                          onChange={(e) => setSettingsDraft((d) => ({ ...d, location: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                      <div className="settings-form__field">
                        <label style={labelStyle} htmlFor="fldAbout">
                          About me
                        </label>
                        <textarea
                          id="fldAbout"
                          name="about"
                          rows={3}
                          value={settingsDraft.about}
                          onChange={(e) => setSettingsDraft((d) => ({ ...d, about: e.target.value }))}
                          style={{ ...inputStyle, resize: "vertical" }}
                        />
                      </div>

                      {[
                        ["emailNotif", "Email notifications", "Get updates when your reports change status."],
                        ["publicProfile", "Public profile", "Let other citizens see your contributor badges."],
                      ].map(([key, title, desc]) => (
                        <div
                          key={key}
                          className="settings-form__toggle-row"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 16,
                            padding: "12px 14px",
                            background: C.bg,
                            borderRadius: RADIUS.md,
                          }}
                        >
                          <div className="settings-form__toggle-copy">
                            <strong style={{ fontSize: 14 }}>{title}</strong>
                            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.ink500 }}>{desc}</p>
                          </div>
                          <Toggle
                            checked={settingsDraft[key]}
                            onChange={(val) => setSettingsDraft((d) => ({ ...d, [key]: val }))}
                          />
                        </div>
                      ))}

                      <div className="settings-form__actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                        <Btn type="button" variant="ghost" onClick={handleSettingsReset}>
                          Reset
                        </Btn>
                        <Btn type="submit" variant="primary">
                          Save changes
                        </Btn>
                      </div>
                    </form>
                  </section>
                )}
              </div>
            </section>

            {/* Impact card */}
            <section className="impact-card" style={{ ...cardStyle, marginTop: 22, padding: "22px 28px" }}>
              <h3 style={{ margin: "0 0 2px", fontFamily: FONT_DISPLAY, fontSize: "1rem" }}>Community Impact</h3>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: C.ink500 }}>
                How your reports have helped your neighborhood this year.
              </p>
              <div className="impact-card__chart" style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={impactData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="28%">
                    <defs>
                      <linearGradient id="impactBarFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.green500} />
                        <stop offset="100%" stopColor={C.green700} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={C.border} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: C.ink500 }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: C.ink500 }} width={28} />
                    <Tooltip
                      cursor={{ fill: C.green050 }}
                      contentStyle={{
                        border: `1px solid ${C.border}`,
                        borderRadius: RADIUS.sm,
                        fontSize: 12,
                        boxShadow: SHADOW_CARD,
                      }}
                      labelStyle={{ color: C.ink900, fontWeight: 600, marginBottom: 2 }}
                      formatter={(value) => [value, "Reports"]}
                    />
                    <Bar dataKey="value" fill="url(#impactBarFill)" radius={[8, 8, 3, 3]} maxBarSize={34}>
                      {impactData.map((entry) => (
                        <Cell key={entry.month} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </main>

          {/* SIDEBAR */}
          <aside className="profile-sidebar" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <section className="stats-card" style={{ ...cardStyle, padding: "20px 20px 18px" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontFamily: FONT_DISPLAY }}>My Stats</h3>
              <div className="stats-card__grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[
                  { label: "Reports Submitted", value: stats.submitted, Icon: FileText, bg: C.green050, fg: C.green600 },
                  { label: "In Progress", value: stats.progress, Icon: Clock, bg: C.amber100, fg: C.amber500 },
                  { label: "Resolved", value: stats.resolved, Icon: CheckCircle2, bg: C.blue100, fg: C.blue500 },
                  { label: "Closed", value: stats.rejected, Icon: XCircle, bg: C.purple100, fg: C.purple500 },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="stats-card__tile"
                    style={{ borderRadius: RADIUS.md, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 8, background: s.bg }}
                  >
                    <span
                      className="stats-card__tile-icon"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        background: "rgba(255,255,255,.65)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: s.fg,
                      }}
                    >
                      <s.Icon size={16} />
                    </span>
                    <span className="stats-card__tile-value" style={{ fontSize: "1.4rem", fontWeight: 700, lineHeight: 1, fontFamily: FONT_DISPLAY }}>{s.value}</span>
                    <span className="stats-card__tile-label" style={{ fontSize: 11, color: C.ink500 }}>{s.label}</span>
                  </div>
                ))}
              </div>
              <button
                className="stats-card__view-all"
                onClick={() => setActiveTab("reports")}
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  background: "none",
                  border: "none",
                  color: C.green700,
                  fontWeight: 600,
                  fontSize: 13,
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                View all my reports <ChevronRight size={14} aria-hidden="true" />
              </button>
            </section>

            <section className="badges-card" style={{ ...cardStyle, padding: "20px 20px 18px" }}>
              <div className="badges-card__head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontFamily: FONT_DISPLAY }}>Badges</h3>
                {badges.length > 0 && (
                  <button
                    className="badges-card__view-all"
                    onClick={() => showToast("Full badge collection coming soon.")}
                    style={{ background: "none", border: "none", color: C.green700, fontWeight: 600, fontSize: 13, padding: 0, cursor: "pointer" }}
                  >
                    View all
                  </button>
                )}
              </div>
              {badges.length === 0 ? (
                <p style={{ color: C.ink500, fontSize: 13, margin: 0 }}>No badges earned yet.</p>
              ) : (
              <div className="badges-card__grid" style={{ display: "grid", gridTemplateColumns: narrow640 ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10 }}>
                {badges.map((b) => {
                  const Icon = badgeIcons[b.icon] || CheckCircle2;
                  return (
                    <div key={b.name} className="badge-item" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
                      <span
                        className="badge-item__icon"
                        style={{
                          width: 52,
                          height: 52,
                          clipPath: "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          background: b.earned ? b.color : "#dfe4e1",
                        }}
                      >
                        <Icon size={22} color="#fff" />
                      </span>
                      <span className="badge-item__name" style={{ fontSize: 11, fontWeight: 600, color: b.earned ? C.ink700 : C.ink300, lineHeight: 1.2 }}>{b.name}</span>
                    </div>
                  );
                })}
              </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      {/* Toast */}
      <div
        role="status"
        aria-live="polite"
        className="toast"
        style={{
          position: "fixed",
          left: "50%",
          bottom: 26,
          transform: toast.visible ? "translate(-50%,0)" : "translate(-50%,20px)",
          background: C.ink900,
          color: "#fff",
          padding: "12px 20px",
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 600,
          opacity: toast.visible ? 1 : 0,
          pointerEvents: "none",
          transition: "opacity .25s ease, transform .25s ease",
          zIndex: 100,
          boxShadow: "0 10px 30px -8px rgba(0,0,0,.4)",
        }}
      >
        {toast.message}
      </div>

      {/* Edit Profile modal */}
      <div
        className="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false);
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,36,25,.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: modalOpen ? 1 : 0,
          pointerEvents: modalOpen ? "auto" : "none",
          transition: "opacity .2s ease",
          zIndex: 90,
          padding: 20,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="editModalTitle"
          className="modal"
          style={{
            background: "#fff",
            borderRadius: RADIUS.lg,
            width: "100%",
            maxWidth: 460,
            maxHeight: "88vh",
            overflowY: "auto",
            boxShadow: "0 30px 60px -20px rgba(0,0,0,.35)",
            transform: modalOpen ? "translateY(0)" : "translateY(10px)",
            transition: "transform .2s ease",
          }}
        >
          <div className="modal__header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
            <h3 id="editModalTitle" style={{ margin: 0, fontFamily: FONT_DISPLAY }}>
              Edit Profile
            </h3>
            <button
              aria-label="Close"
              className="modal__close-btn"
              onClick={() => setModalOpen(false)}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: `1px solid ${C.border}`,
                background: C.card,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.ink700,
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
          </div>
          <form className="modal__form" onSubmit={handleModalSubmit} style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="modal__field">
              <label style={labelStyle} htmlFor="modalName">
                Full name
              </label>
              <input
                id="modalName"
                name="name"
                type="text"
                required
                value={modalDraft.name}
                onChange={(e) => setModalDraft((d) => ({ ...d, name: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div className="modal__field">
              <label style={labelStyle} htmlFor="modalLocation">
                Location
              </label>
              <input
                id="modalLocation"
                name="location"
                type="text"
                value={modalDraft.location}
                onChange={(e) => setModalDraft((d) => ({ ...d, location: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div className="modal__field">
              <label style={labelStyle} htmlFor="modalEmail">
                Email
              </label>
              <input
                id="modalEmail"
                name="email"
                type="email"
                value={modalDraft.email}
                onChange={(e) => setModalDraft((d) => ({ ...d, email: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div className="modal__field">
              <label style={labelStyle} htmlFor="modalPhone">
                Phone
              </label>
              <input
                id="modalPhone"
                name="phone"
                type="tel"
                value={modalDraft.phone}
                onChange={(e) => setModalDraft((d) => ({ ...d, phone: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div className="modal__field">
              <label style={labelStyle} htmlFor="modalAbout">
                About me
              </label>
              <textarea
                id="modalAbout"
                name="about"
                rows={3}
                value={modalDraft.about}
                onChange={(e) => setModalDraft((d) => ({ ...d, about: e.target.value }))}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
            <div className="modal__actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <Btn type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary">
                Save changes
              </Btn>
            </div>
          </form>
        </div>
      </div>
      <Footer/>
    </div>
  );
}