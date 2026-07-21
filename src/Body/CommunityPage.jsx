import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "../Components/supabaseClient"; 
import Footer from "../Components/footer";
import {
  Plus,
  Image as ImageIcon,
  BarChart3,
  Calendar,
  Flag,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Globe2,
  X,
  Loader2,
  MapPin,
  AlertTriangle,
} from "lucide-react";

const TABS = [
  { key: "all", label: "All Posts" },
  { key: "mine", label: "My Posts" },
  { key: "saved", label: "Saved" },
];

const ROLE_LABELS = { citizen: "Active Citizen", moderator: "Moderator", admin: "Admin" };

const URGENCY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

// Every composer mode maps to a post_type value and drives which extra
// fields the composer shows.
const COMPOSER_MODES = {
  standard: { postType: "standard", label: "Share an update" },
  photo: { postType: "photo", label: "Add a photo" },
  poll: { postType: "poll", label: "Create a poll" },
  event: { postType: "event", label: "Plan an event" },
  report: { postType: "report", label: "Report an update" },
};

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function timeAgo(value) {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;
  return new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

// Structured post types (poll/event/report) keep their extra data as JSON
// inside `content`, since the schema only has a single text column for it.
function parseStructuredContent(post) {
  if (post.post_type !== "poll" && post.post_type !== "event" && post.post_type !== "report") return null;
  if (!post.content) return null;
  try {
    return JSON.parse(post.content);
  } catch {
    return null;
  }
}

const textareaStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #e7edf7",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 14,
  fontFamily: "inherit",
  color: "#11233f",
  outline: "none",
  resize: "vertical",
  minHeight: 70,
};

const fieldInputStyle = { ...textareaStyle, minHeight: "auto" };
const fieldLabelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 };

export default function CommunityPage() {
  // Responsive breakpoints — same resize-listener approach as Sidebar.jsx / Profile.jsx
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const narrow1200 = width < 1200;
  const narrow900 = width < 900;

  const [currentUser, setCurrentUser] = useState(null);
  const [profilesById, setProfilesById] = useState({});
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [likesByPost, setLikesByPost] = useState({}); // post_id -> Set(user_id)
  const [savedByPost, setSavedByPost] = useState({}); // post_id -> Set(user_id)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [composerMode, setComposerMode] = useState(null); // null = closed, otherwise a COMPOSER_MODES key

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUser(user || null);

    const [{ data: postRows, error: postsError }, { data: categoryRows, error: catError }, { data: likeRows, error: likesError }, { data: savedRows, error: savedError }] =
      await Promise.all([
        supabase
          .from("community_posts")
          .select("id, created_at, user_id, category_id, title, content, image_url, post_type, visibility, status")
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name, color, icon"),
        supabase.from("likes").select("id, post_id, user_id"),
        supabase.from("saved_posts").select("id, post_id, user_id"),
      ]);

    if (postsError || catError || likesError || savedError) {
      setError(postsError?.message || catError?.message || likesError?.message || savedError?.message);
      setLoading(false);
      return;
    }

    setCategories(categoryRows || []);
    setPosts(postRows || []);

    const likeMap = {};
    for (const l of likeRows || []) {
      if (!likeMap[l.post_id]) likeMap[l.post_id] = new Set();
      likeMap[l.post_id].add(l.user_id);
    }
    setLikesByPost(likeMap);

    const savedMap = {};
    for (const s of savedRows || []) {
      if (!savedMap[s.post_id]) savedMap[s.post_id] = new Set();
      savedMap[s.post_id].add(s.user_id);
    }
    setSavedByPost(savedMap);

    const userIds = [...new Set((postRows || []).map((p) => p.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, username, profile_picture, role")
        .in("id", userIds);
      if (!profileError) {
        const map = {};
        for (const p of profileRows || []) map[p.id] = p;
        setProfilesById(map);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Always make sure the logged-in user's own profile is loaded, even before
  // they've posted anything (so the composer/left rail can show their info).
  useEffect(() => {
    if (!currentUser || profilesById[currentUser.id]) return;
    supabase
      .from("profiles")
      .select("id, full_name, username, profile_picture, role")
      .eq("id", currentUser.id)
      .single()
      .then(({ data }) => {
        if (data) setProfilesById((prev) => ({ ...prev, [data.id]: data }));
      });
  }, [currentUser, profilesById]);

  const enrichedPosts = useMemo(() => {
    return posts.map((post) => {
      const profile = profilesById[post.user_id];
      const likeSet = likesByPost[post.id] || new Set();
      const savedSet = savedByPost[post.id] || new Set();
      return {
        ...post,
        author: profile,
        likesCount: likeSet.size,
        likedByMe: currentUser ? likeSet.has(currentUser.id) : false,
        savedByMe: currentUser ? savedSet.has(currentUser.id) : false,
      };
    });
  }, [posts, profilesById, likesByPost, savedByPost, currentUser]);

  const filteredPosts = useMemo(() => {
    if (activeTab === "mine") return enrichedPosts.filter((p) => currentUser && p.user_id === currentUser.id);
    if (activeTab === "saved") return enrichedPosts.filter((p) => p.savedByMe);
    return enrichedPosts;
  }, [enrichedPosts, activeTab, currentUser]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const postsThisWeek = enrichedPosts.filter((p) => new Date(p.created_at).getTime() >= weekAgo).length;
    const savedCount = enrichedPosts.filter((p) => p.savedByMe).length;
    const authorCount = new Set(enrichedPosts.map((p) => p.user_id)).size;
    return { postsThisWeek, savedCount, authorCount };
  }, [enrichedPosts]);

  const activeMembers = useMemo(() => {
    const counts = new Map();
    for (const p of posts) counts.set(p.user_id, (counts.get(p.user_id) || 0) + 1);
    return [...counts.entries()]
      .map(([userId, count]) => ({ profile: profilesById[userId], count }))
      .filter((m) => m.profile)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [posts, profilesById]);

  async function toggleLike(post) {
    if (!currentUser) return;
    const alreadyLiked = post.likedByMe;

    setLikesByPost((prev) => {
      const next = { ...prev };
      const set = new Set(next[post.id] || []);
      if (alreadyLiked) set.delete(currentUser.id);
      else set.add(currentUser.id);
      next[post.id] = set;
      return next;
    });

    if (alreadyLiked) {
      const { error: delError } = await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", currentUser.id);
      if (delError) loadAll();
    } else {
      const { error: insError } = await supabase.from("likes").insert({ post_id: post.id, user_id: currentUser.id });
      if (insError) loadAll();
    }
  }

  async function toggleSave(post) {
    if (!currentUser) return;
    const alreadySaved = post.savedByMe;

    setSavedByPost((prev) => {
      const next = { ...prev };
      const set = new Set(next[post.id] || []);
      if (alreadySaved) set.delete(currentUser.id);
      else set.add(currentUser.id);
      next[post.id] = set;
      return next;
    });

    if (alreadySaved) {
      const { error: delError } = await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", currentUser.id);
      if (delError) loadAll();
    } else {
      const { error: insError } = await supabase.from("saved_posts").insert({ post_id: post.id, user_id: currentUser.id });
      if (insError) loadAll();
    }
  }

  function handlePostCreated(newPost) {
    setPosts((prev) => [newPost, ...prev]);
    setComposerMode(null);
  }

  const myProfile = currentUser ? profilesById[currentUser.id] : null;
  const myDisplayName = myProfile?.full_name || myProfile?.username || "You";

  return (
    <div name="communityPageContainer" style={{ backgroundColor: "#f0f2f5", minHeight: "100%" }}>
      {/* Sticky top bar — full width, Facebook-style */}
      <header
        name="communityTopbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          width: "100%",
          backgroundColor: "#fff",
          borderBottom: "1px solid #e7edf7",
          padding: narrow900 ? "10px 12px" : "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div name="communityTitleBlock" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div name="communityLogoBadge" style={{ width: 36, height: 36, borderRadius: "50%", background: "#2563eb", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
            C
          </div>
          <div name="communityTitleText" style={{ minWidth: 0 }}>
            <h1 name="communityPageTitle" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#11233f" }}>Community</h1>
            {!narrow900 && (
              <p name="communityPageSubtitle" style={{ margin: 0, fontSize: 11, color: "#5f728f" }}>Connect, share and make our community better together</p>
            )}
          </div>
        </div>
        <button
          name="communityNewPostButton"
          onClick={() => setComposerMode("standard")}
          style={{
            border: "none",
            borderRadius: 999,
            background: "#2563eb",
            color: "#fff",
            padding: "9px 16px",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <Plus size={15} /> New post
        </button>
      </header>

      {/* 3-column body */}
      <div
        name="communityContentWrapper"
        style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: narrow900 ? 0 : 20, padding: narrow900 ? "12px" : "20px", maxWidth: 1600, margin: "0 auto" }}
      >
        {/* Left rail */}
        {!narrow900 && (
        <aside name="communityLeftRail" style={{ width: narrow1200 ? 220 : 260, flexShrink: 0, position: "sticky", top: 76, display: "flex", flexDirection: "column", gap: 4 }}>
          <div name="communityProfileSummary" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10 }}>
            <Avatar name="communityProfileAvatar" displayName={myDisplayName} src={myProfile?.profile_picture} size={32} />
            <span name="communityProfileName" style={{ fontSize: 14, fontWeight: 600, color: "#11233f" }}>{myDisplayName}</span>
          </div>
          {TABS.map((t) => (
            <button
              key={t.key}
              name={`communityTab-${t.key}`}
              onClick={() => setActiveTab(t.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "none",
                background: activeTab === t.key ? "#e7f0ff" : "transparent",
                color: activeTab === t.key ? "#2563eb" : "#11233f",
                padding: "10px 12px",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                textAlign: "left",
              }}
            >
              {t.label}
            </button>
          ))}
          <div name="communityStatsBlock" style={{ marginTop: 10, paddingTop: 14, borderTop: "1px solid #e7edf7", display: "flex", flexDirection: "column", gap: 10 }}>
            <StatRow name="communityStatPostsThisWeek" value={stats.postsThisWeek} label="Posts this week" />
            <StatRow name="communityStatMembers" value={stats.authorCount} label="Members posting" />
            <StatRow name="communityStatSaved" value={stats.savedCount} label="Saved by you" />
          </div>
        </aside>
        )}

        {/* Center feed */}
        <main name="communityMainColumn" style={{ flex: "1 1 0%", minWidth: 0, maxWidth: narrow900 ? "100%" : 590, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {narrow900 && (
            <div name="communityMobileTabRow" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  name={`communityMobileTab-${t.key}`}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    flexShrink: 0,
                    border: "none",
                    background: activeTab === t.key ? "#e7f0ff" : "#fff",
                    color: activeTab === t.key ? "#2563eb" : "#11233f",
                    padding: "8px 14px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {error && (
            <div name="communityErrorBanner" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 12, padding: "12px 16px", fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Composer trigger (inline) */}
          <section
            name="communityComposerPreview"
            style={{ border: "1px solid #e7edf7", borderRadius: 12, padding: 16, background: "#fff", boxShadow: "0 1px 2px rgba(17,35,63,0.04)" }}
          >
            <div name="communityComposerPreviewTop" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <Avatar name="communityComposerAvatar" displayName={myDisplayName} src={myProfile?.profile_picture} />
              <button
                name="communityComposerPromptButton"
                onClick={() => setComposerMode("standard")}
                style={{
                  flex: 1,
                  background: "#f0f2f5",
                  border: "none",
                  borderRadius: 999,
                  padding: "10px 16px",
                  color: "#5f728f",
                  fontSize: 14,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                What's happening in your community?
              </button>
            </div>
            <div name="communityComposerChipRow" style={{ display: "flex", flexWrap: "wrap", gap: 8, borderTop: "1px solid #e7edf7", paddingTop: 12 }}>
              <Chip name="communityChipPhoto" icon={ImageIcon} label="Photo / Video" onClick={() => setComposerMode("photo")} />
              <Chip name="communityChipPoll" icon={BarChart3} label="Poll" onClick={() => setComposerMode("poll")} />
              <Chip name="communityChipEvent" icon={Calendar} label="Event" onClick={() => setComposerMode("event")} />
              <Chip name="communityChipReport" icon={Flag} label="Report Update" onClick={() => setComposerMode("report")} />
            </div>
          </section>

          {/* Feed */}
          <section name="communityFeed" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {loading ? (
              <div name="communityLoadingState" style={{ padding: 40, textAlign: "center", color: "#5f728f", fontSize: 13 }}>
                Loading community feed…
              </div>
            ) : filteredPosts.length === 0 ? (
              <div name="communityEmptyState" style={{ border: "1px dashed #e7edf7", borderRadius: 12, padding: 24, textAlign: "center", color: "#5f728f", background: "#fff" }}>
                No posts match this view yet. Try another filter.
              </div>
            ) : (
              filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onToggleLike={toggleLike}
                  onToggleSave={toggleSave}
                  canInteract={Boolean(currentUser)}
                />
              ))
            )}
          </section>
        </main>

        {/* Right rail */}
        {!narrow900 && (
        <aside name="communitySidebar" style={{ width: narrow1200 ? 260 : 300, flexShrink: 0, position: "sticky", top: 76, display: "flex", flexDirection: "column", gap: 16 }}>
          <SidebarCard name="communityActiveMembersCard" title="Active Members">
            {activeMembers.length === 0 ? (
              <p name="communityActiveMembersEmpty" style={{ margin: 0, fontSize: 12, color: "#5f728f" }}>No activity yet.</p>
            ) : (
              <div name="communityActiveMembersList" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {activeMembers.map((m) => (
                  <div key={m.profile.id} name={`communityActiveMemberRow-${m.profile.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div name={`communityActiveMemberInfo-${m.profile.id}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={`communityActiveMemberAvatar-${m.profile.id}`} displayName={m.profile.full_name || m.profile.username} src={m.profile.profile_picture} size={32} />
                      <div name={`communityActiveMemberText-${m.profile.id}`}>
                        <p name={`communityActiveMemberName-${m.profile.id}`} style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#11233f" }}>{m.profile.full_name || m.profile.username}</p>
                        <p name={`communityActiveMemberRole-${m.profile.id}`} style={{ margin: 0, fontSize: 11, color: "#16a34a" }}>{ROLE_LABELS[m.profile.role] || m.profile.role}</p>
                      </div>
                    </div>
                    <span name={`communityActiveMemberCount-${m.profile.id}`} style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", backgroundColor: "#dbeafe", padding: "3px 8px", borderRadius: 999 }}>
                      {m.count} posts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SidebarCard>

          <SidebarCard name="communityGuidelinesCard" title="Community Guidelines">
            <div name="communityGuidelinesList" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["Be respectful and kind to others", "Stay on topic and keep it relevant", "No spam or self-promotion", "Report inappropriate content"].map((g) => (
                <div key={g} name={`communityGuidelineRow-${g.replace(/\s+/g, "-").toLowerCase()}`} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#374151" }}>
                  <span name={`communityGuidelineCheck-${g.replace(/\s+/g, "-").toLowerCase()}`} style={{ color: "#16a34a", fontWeight: 700 }}>✓</span>
                  {g}
                </div>
              ))}
            </div>
          </SidebarCard>
        </aside>
        )}
      </div>

      {composerMode && (
        <ComposerModal
          mode={composerMode}
          categories={categories}
          currentUser={currentUser}
          myDisplayName={myDisplayName}
          myProfile={myProfile}
          onClose={() => setComposerMode(null)}
          onCreated={handlePostCreated}
        />
      )}
    </div>
  );
}

function StatRow({ name, value, label }) {
  return (
    <div name={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 10px" }}>
      <span name={`${name}-label`} style={{ fontSize: 13, color: "#5f728f" }}>{label}</span>
      <span name={`${name}-value`} style={{ fontSize: 13, fontWeight: 700, color: "#11233f" }}>{value}</span>
    </div>
  );
}

function Chip({ name, icon: Icon, label, onClick }) {
  return (
    <button
      name={name}
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid #e7edf7",
        background: "#fff",
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 13,
        color: "#11233f",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
      }}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function Avatar({ name, displayName, src, size = 44 }) {
  if (src) {
    return <img name={name} src={src} alt={displayName || "User"} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div
      name={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: size <= 32 ? 12 : 14,
        background: "#dbeafe",
        color: "#2563eb",
        flexShrink: 0,
      }}
    >
      {initials(displayName)}
    </div>
  );
}

function SidebarCard({ name, title, children }) {
  return (
    <div name={name} style={{ backgroundColor: "#fff", border: "1px solid #e7edf7", borderRadius: 18, padding: 18 }}>
      <div name={`${name}-header`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p name={`${name}-title`} style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#11233f" }}>{title}</p>
      </div>
      {children}
    </div>
  );
}

function PostCard({ post, onToggleLike, onToggleSave, canInteract }) {
  const author = post.author;
  const structured = parseStructuredContent(post);

  return (
    <article name={`postCard-${post.id}`} style={{ border: "1px solid #e7edf7", borderRadius: 18, padding: 16, background: "#fff" }}>
      <div name={`postCardHeader-${post.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
        <div name={`postCardAuthorRow-${post.id}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={`postCardAvatar-${post.id}`} displayName={author?.full_name || author?.username} src={author?.profile_picture} />
          <div name={`postCardAuthorText-${post.id}`}>
            <div name={`postCardAuthorNameRow-${post.id}`} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
              <h3 name={`postCardAuthorName-${post.id}`} style={{ fontSize: "0.98rem", margin: 0, color: "#11233f" }}>{author?.full_name || author?.username || "Unknown"}</h3>
              {author?.role && (
                <span name={`postCardAuthorRole-${post.id}`} style={{ fontSize: "0.74rem", padding: "3px 8px", borderRadius: 999, background: "#dbeafe", color: "#2563eb", fontWeight: 700 }}>
                  {ROLE_LABELS[author.role] || author.role}
                </span>
              )}
            </div>
            <div name={`postCardMeta-${post.id}`} style={{ color: "#5f728f", fontSize: "0.84rem", display: "flex", alignItems: "center", gap: 5 }}>
              {timeAgo(post.created_at)}
              {post.visibility === "public" && <Globe2 size={12} />}
            </div>
          </div>
        </div>
        <MoreHorizontal name={`postCardMoreIcon-${post.id}`} size={18} color="#6b7f9e" />
      </div>

      {post.title && <p name={`postCardTitle-${post.id}`} style={{ fontWeight: 700, color: "#11233f", marginBottom: 6, fontSize: 14 }}>{post.title}</p>}

      {/* Standard / photo / fallback text content */}
      {!structured && post.content && (
        <p name={`postCardContent-${post.id}`} style={{ lineHeight: 1.55, color: "#23374e", marginBottom: 12, fontSize: 14 }}>
          {post.content}
        </p>
      )}

      {/* Poll */}
      {post.post_type === "poll" && structured?.options?.length > 0 && (
        <div name={`postCardPoll-${post.id}`} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {structured.options.map((opt, i) => (
            <div
              key={i}
              name={`postCardPollOption-${post.id}-${i}`}
              style={{ border: "1px solid #e7edf7", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#11233f", background: "#f8fbff" }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}

      {/* Event */}
      {post.post_type === "event" && structured && (
        <div name={`postCardEvent-${post.id}`} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, border: "1px solid #e7edf7", borderRadius: 10, padding: 12, background: "#f8fbff" }}>
          {structured.description && (
            <p name={`postCardEventDescription-${post.id}`} style={{ margin: 0, fontSize: 14, color: "#23374e", lineHeight: 1.55 }}>
              {structured.description}
            </p>
          )}
          <div name={`postCardEventDetails-${post.id}`} style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: "#5f728f" }}>
            {structured.date && (
              <span name={`postCardEventDate-${post.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Calendar size={13} /> {new Date(structured.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            {structured.location && (
              <span name={`postCardEventLocation-${post.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <MapPin size={13} /> {structured.location}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Report */}
      {post.post_type === "report" && structured && (
        <div name={`postCardReport-${post.id}`} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, border: "1px solid #fde68a", borderRadius: 10, padding: 12, background: "#fffbeb" }}>
          {structured.urgency && (
            <span
              name={`postCardReportUrgency-${post.id}`}
              style={{
                alignSelf: "flex-start",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 999,
                color: structured.urgency === "high" ? "#b91c1c" : structured.urgency === "medium" ? "#b45309" : "#374151",
                background: structured.urgency === "high" ? "#fee2e2" : structured.urgency === "medium" ? "#fef3c7" : "#e5e7eb",
              }}
            >
              <AlertTriangle size={12} /> {URGENCY_OPTIONS.find((u) => u.value === structured.urgency)?.label || structured.urgency} urgency
            </span>
          )}
          {structured.description && (
            <p name={`postCardReportDescription-${post.id}`} style={{ margin: 0, fontSize: 14, color: "#23374e", lineHeight: 1.55 }}>
              {structured.description}
            </p>
          )}
        </div>
      )}

      {post.image_url && (
        <div name={`postCardImageWrapper-${post.id}`} style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", backgroundColor: "#f3f6fb" }}>
          <img name={`postCardImage-${post.id}`} src={post.image_url} alt={post.title || "Post image"} style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} />
        </div>
      )}

      <div name={`postCardActions-${post.id}`} style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "#5f728f", fontSize: "0.9rem", alignItems: "center" }}>
        <button
          name={`postLikeButton-${post.id}`}
          onClick={() => onToggleLike(post)}
          disabled={!canInteract}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: canInteract ? "pointer" : "default",
            color: post.likedByMe ? "#e11d48" : "#5f728f",
            fontSize: "0.9rem",
            padding: 0,
          }}
        >
          <Heart size={15} fill={post.likedByMe ? "#e11d48" : "none"} /> {post.likesCount}
        </button>
        <span name={`postCommentCount-${post.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <MessageCircle size={15} /> 0
        </span>
        <span name={`postShareAction-${post.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <Share2 size={15} /> Share
        </span>
        <button
          name={`postSaveButton-${post.id}`}
          onClick={() => onToggleSave(post)}
          disabled={!canInteract}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            cursor: canInteract ? "pointer" : "default",
            color: post.savedByMe ? "#2563eb" : "#5f728f",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Bookmark name={`postSaveIcon-${post.id}`} size={16} fill={post.savedByMe ? "#2563eb" : "none"} />
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// New post composer — one modal, five modes (standard/photo/poll/event/report)
// ---------------------------------------------------------------------------

function ComposerModal({ mode, categories, currentUser, myDisplayName, myProfile, onClose, onCreated }) {
  const modeConfig = COMPOSER_MODES[mode] || COMPOSER_MODES.standard;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const fileInputRef = useRef(null);
  const categoryId = categories[0]?.id || null;

  // Jumping straight into "Photo / Video" opens the file picker right away.
  useEffect(() => {
    if (mode === "photo") fileInputRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function updatePollOption(index, value) {
    setPollOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  }

  function addPollOption() {
    setPollOptions((prev) => (prev.length >= 4 ? prev : [...prev, ""]));
  }

  function removePollOption(index) {
    setPollOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }

  function validate() {
    if (!title.trim()) return "Give your post a short title.";
    if (mode === "photo" && !imageFile) return "Please add a photo.";
    if (mode === "poll") {
      const filled = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (filled.length < 2) return "Add at least two poll options.";
    }
    if (mode === "event" && !eventDate) return "Please pick a date for the event.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    setSubmitting(true);

    try {
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const filePath = `community/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("images").upload(filePath, imageFile);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from("images").getPublicUrl(filePath);
        imageUrl = publicUrl;
      }

      // Poll/event/report pack their extra fields into `content` as JSON,
      // since the schema only has one free-text content column.
      let content = description.trim() || null;
      if (mode === "poll") {
        content = JSON.stringify({ options: pollOptions.map((o) => o.trim()).filter(Boolean) });
      } else if (mode === "event") {
        content = JSON.stringify({ description: description.trim() || null, date: eventDate, location: eventLocation.trim() || null });
      } else if (mode === "report") {
        content = JSON.stringify({ description: description.trim() || null, urgency });
      }

      const { data: newPost, error: insertError } = await supabase
        .from("community_posts")
        .insert({
          user_id: currentUser?.id,
          category_id: categoryId,
          title: title.trim(),
          content,
          image_url: imageUrl,
          post_type: modeConfig.postType,
          visibility: "public",
          status: "published",
        })
        .select()
        .single();
      if (insertError) throw insertError;

      onCreated(newPost);
    } catch (err) {
      setFormError(err.message || "Could not publish that post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      name="composerModalBackdrop"
      onClick={() => !submitting && onClose()}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(17,35,63,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
    >
      <div
        name="composerModal"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 24 }}
      >
        <style name="composerSpinKeyframes">{"@keyframes community-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>

        <div name="composerHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <p name="composerHeaderTitle" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#11233f" }}>{modeConfig.label}</p>
          <button
            name="composerCloseButton"
            onClick={onClose}
            disabled={submitting}
            style={{ background: "none", border: "none", cursor: submitting ? "not-allowed" : "pointer", color: "#5f728f", padding: 4 }}
          >
            <X name="composerCloseIcon" size={18} />
          </button>
        </div>

        <div name="composerAuthorRow" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Avatar name="composerAuthorAvatar" displayName={myDisplayName} src={myProfile?.profile_picture} size={36} />
          <span name="composerAuthorName" style={{ fontSize: 13, fontWeight: 600, color: "#11233f" }}>{myDisplayName}</span>
        </div>

        <form name="composerForm" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div name="composerTitleField">
            <label name="composerTitleLabel" style={fieldLabelStyle}>{mode === "poll" ? "Question" : "Title"}</label>
            <input
              name="composerTitleInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === "poll" ? "What should we ask?" : "What's happening in your community?"}
              style={fieldInputStyle}
            />
          </div>

          {mode !== "poll" && (
            <div name="composerDescriptionField">
              <label name="composerDescriptionLabel" style={fieldLabelStyle}>Details</label>
              <textarea
                name="composerDescriptionInput"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Share more detail with your neighbors…"
                style={textareaStyle}
              />
            </div>
          )}

          {mode === "poll" && (
            <div name="composerPollField">
              <label name="composerPollLabel" style={fieldLabelStyle}>Options</label>
              <div name="composerPollOptionsList" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pollOptions.map((opt, i) => (
                  <div key={i} name={`composerPollOptionRow-${i}`} style={{ display: "flex", gap: 8 }}>
                    <input
                      name={`composerPollOptionInput-${i}`}
                      value={opt}
                      onChange={(e) => updatePollOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      style={{ ...fieldInputStyle, flex: 1 }}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        name={`composerPollOptionRemove-${i}`}
                        type="button"
                        onClick={() => removePollOption(i)}
                        style={{ border: "1px solid #e7edf7", background: "#fff", borderRadius: 8, width: 36, cursor: "pointer", color: "#5f728f" }}
                      >
                        <X name={`composerPollOptionRemoveIcon-${i}`} size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {pollOptions.length < 4 && (
                <button
                  name="composerPollAddOption"
                  type="button"
                  onClick={addPollOption}
                  style={{ marginTop: 8, border: "none", background: "none", color: "#2563eb", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  + Add option
                </button>
              )}
            </div>
          )}

          {mode === "event" && (
            <div name="composerEventFields" style={{ display: "flex", gap: 12 }}>
              <div name="composerEventDateField" style={{ flex: 1 }}>
                <label name="composerEventDateLabel" style={fieldLabelStyle}>Date</label>
                <input
                  name="composerEventDateInput"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  style={fieldInputStyle}
                />
              </div>
              <div name="composerEventLocationField" style={{ flex: 1 }}>
                <label name="composerEventLocationLabel" style={fieldLabelStyle}>Location</label>
                <input
                  name="composerEventLocationInput"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="e.g. Green Park"
                  style={fieldInputStyle}
                />
              </div>
            </div>
          )}

          {mode === "report" && (
            <div name="composerUrgencyField">
              <label name="composerUrgencyLabel" style={fieldLabelStyle}>Urgency</label>
              <select name="composerUrgencyInput" value={urgency} onChange={(e) => setUrgency(e.target.value)} style={fieldInputStyle}>
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(mode === "standard" || mode === "photo") && (
            <div name="composerImageField">
              <label name="composerImageLabel" style={fieldLabelStyle}>{mode === "photo" ? "Photo" : "Photo (optional)"}</label>
              <input name="composerImageInput" ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              <div
                name="composerImageDropzone"
                onClick={() => fileInputRef.current?.click()}
                style={{ border: "1px dashed #d1d9e6", borderRadius: 12, padding: 16, textAlign: "center", cursor: "pointer", color: "#5f728f", fontSize: 12 }}
              >
                {imagePreview ? (
                  <img name="composerImagePreview" src={imagePreview} alt="Preview" style={{ maxHeight: 140, borderRadius: 8, margin: "0 auto" }} />
                ) : (
                  <div name="composerImagePlaceholder" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <ImageIcon name="composerImagePlaceholderIcon" size={18} color="#9ca3af" />
                    Click to add a photo
                  </div>
                )}
              </div>
            </div>
          )}

          {formError && <p name="composerFormError" style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{formError}</p>}

          <button
            name="composerSubmitButton"
            type="submit"
            disabled={submitting}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 4,
              padding: "11px 16px",
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.75 : 1,
            }}
          >
            {submitting ? (
              <>
                <Loader2 name="composerSubmitSpinner" size={15} style={{ animation: "community-spin 1s linear infinite" }} /> Posting…
              </>
            ) : (
              "Post"
            )}
          </button>
        </form>
      </div>
      <Footer />
    </div>
  );
}