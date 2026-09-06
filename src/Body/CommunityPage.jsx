import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "../Components/supabaseClient"; 
import {
  Plus,
  Image as ImageIcon,
  Calendar,
  Flag,
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Globe2,
  X,
  Loader2,
  MapPin,
  AlertTriangle,
  Trash2,
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

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogg", "ogv"];
function isVideoUrl(url) {
  if (!url) return false;
  const clean = url.split("?")[0];
  const ext = clean.split(".").pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

function localISODate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

// Event/report post types still keep their extra data as JSON inside
// `content`, since the schema only has a single text column for it. 
function parseStructuredContent(post) {
  if (post.post_type !== "event" && post.post_type !== "report") return null;
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
  const [commentsByPost, setCommentsByPost] = useState({}); // post_id -> array of comment rows

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

    const [
      { data: postRows, error: postsError },
      { data: categoryRows, error: catError },
      { data: likeRows, error: likesError },
      { data: savedRows, error: savedError },
      { data: commentRows, error: commentsError },
    ] = await Promise.all([
      supabase
        .from("community_posts")
        .select("id, created_at, user_id, category_id, title, content, image_url, post_type, visibility, status")
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("id, category_name"),
      supabase.from("likes").select("id, post_id, user_id"),
      supabase.from("saved_posts").select("id, post_id, user_id"),
      supabase.from("comments").select("id, post_id, user_id, content, created_at").order("created_at", { ascending: true }),
    ]);

    if (postsError || catError || likesError || savedError || commentsError) {
      setError(
        postsError?.message ||
          catError?.message ||
          likesError?.message ||
          savedError?.message ||
          commentsError?.message 
      );
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

    const commentMap = {};
    for (const c of commentRows || []) {
      if (!commentMap[c.post_id]) commentMap[c.post_id] = [];
      commentMap[c.post_id].push(c);
    }
    setCommentsByPost(commentMap);

    const userIds = [
      ...new Set([
        ...(postRows || []).map((p) => p.user_id).filter(Boolean),
        ...(commentRows || []).map((c) => c.user_id).filter(Boolean),
      ]),
    ];
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
      const comments = (commentsByPost[post.id] || []).map((c) => ({ ...c, author: profilesById[c.user_id] }));

      return {
        ...post,
        author: profile,
        likesCount: likeSet.size,
        likedByMe: currentUser ? likeSet.has(currentUser.id) : false,
        savedByMe: currentUser ? savedSet.has(currentUser.id) : false,
        comments,
        commentsCount: comments.length,
      };
    });
  }, [posts, profilesById, likesByPost, savedByPost, commentsByPost, currentUser]);

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

  async function deletePost(post) {
    if (!currentUser || post.user_id !== currentUser.id) return;
    if (!window.confirm("Delete this post? This can't be undone.")) return;

    const prevPosts = posts;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));

    const { error: deleteError } = await supabase
      .from("community_posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", currentUser.id);

    if (deleteError) {
      setPosts(prevPosts); // roll back on failure
      setError(deleteError.message);
    }
  }

  async function addComment(post, text) {
    if (!currentUser || !text.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticComment = {
      id: tempId,
      post_id: post.id,
      user_id: currentUser.id,
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setCommentsByPost((prev) => ({
      ...prev,
      [post.id]: [...(prev[post.id] || []), optimisticComment],
    }));

    const { data: inserted, error: insError } = await supabase
      .from("comments")
      .insert({ post_id: post.id, user_id: currentUser.id, content: text.trim() })
      .select()
      .single();

    if (insError || !inserted) {
      // roll back the optimistic comment on failure
      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || []).filter((c) => c.id !== tempId),
      }));
      setError(insError?.message || "Could not post your comment. Please try again.");
      return;
    }

    setCommentsByPost((prev) => ({
      ...prev,
      [post.id]: (prev[post.id] || []).map((c) => (c.id === tempId ? inserted : c)),
    }));
  }

  async function deleteComment(post, comment) {
    if (!currentUser || comment.user_id !== currentUser.id) return;

    const prevComments = commentsByPost[post.id] || [];
    setCommentsByPost((prev) => ({
      ...prev,
      [post.id]: prevComments.filter((c) => c.id !== comment.id),
    }));

    const { error: delError } = await supabase
      .from("comments")
      .delete()
      .eq("id", comment.id)
      .eq("user_id", currentUser.id);

    if (delError) {
      setCommentsByPost((prev) => ({ ...prev, [post.id]: prevComments })); // roll back on failure
      setError(delError.message);
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
                  onDelete={deletePost}
                  onAddComment={addComment}
                  onDeleteComment={deleteComment}
                  canInteract={Boolean(currentUser)}
                  isOwner={Boolean(currentUser) && post.user_id === currentUser?.id}
                  currentUser={currentUser}
                  myDisplayName={myDisplayName}
                  myProfile={myProfile}
                />
              ))
            )}
          </section>
        </main>

        {/* Right rail */}
        {!narrow900 && (
        <aside name="communitySidebar" style={{ width: narrow1200 ? 260 : 300, flexShrink: 0, position: "sticky", top: 76, display: "flex", flexDirection: "column", gap: 16 }}>
          

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

function PostCard({
  post,
  onToggleLike,
  onToggleSave,
  onDelete,
  onAddComment,
  onDeleteComment,
  canInteract,
  isOwner,
  currentUser,
  myDisplayName,
  myProfile,
}) {
  const author = post.author;
  const structured = parseStructuredContent(post);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFeedback, setMenuFeedback] = useState("");
  const menuRef = useRef(null);

  // Close the three-dot menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function handleEscape(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  function buildShareUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}?post=${post.id}`;
  }

  async function handleCopyLink() {
    setMenuOpen(false);
    const url = buildShareUrl();
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      setMenuFeedback("Link copied!");
    } catch {
      setMenuFeedback("Couldn't copy link.");
    } finally {
      setTimeout(() => setMenuFeedback(""), 2200);
    }
  }

  function handleReportPost() {
    setMenuOpen(false);
    setMenuFeedback("Post reported. Thanks for letting us know.");
    setTimeout(() => setMenuFeedback(""), 2600);
  }

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
        <div name={`postCardHeaderActions-${post.id}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isOwner && (
            <button
              name={`postDeleteButton-${post.id}`}
              onClick={() => onDelete(post)}
              aria-label="Delete post"
              title="Delete post"
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#9ca3af",
                padding: 0,
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
          <div name={`postCardMoreWrapper-${post.id}`} ref={menuRef} style={{ position: "relative" }}>
            <button
              name={`postCardMoreButton-${post.id}`}
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="More options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              style={{ display: "inline-flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <MoreHorizontal name={`postCardMoreIcon-${post.id}`} size={18} color="#6b7f9e" />
            </button>
            {menuOpen && (
              <div
                name={`postCardMoreMenu-${post.id}`}
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  minWidth: 160,
                  background: "#fff",
                  border: "1px solid #e7edf7",
                  borderRadius: 12,
                  boxShadow: "0 12px 28px rgba(15,35,63,0.14)",
                  zIndex: 10,
                  overflow: "hidden",
                }}
              >
                <button
                  name={`postCardMenuCopyLink-${post.id}`}
                  type="button"
                  onClick={handleCopyLink}
                  style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#11233f" }}
                >
                  Copy link
                </button>
                <button
                  name={`postCardMenuReport-${post.id}`}
                  type="button"
                  onClick={handleReportPost}
                  style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#b91c1c", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Flag size={13} /> Report post
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {post.title && <p name={`postCardTitle-${post.id}`} style={{ fontWeight: 700, color: "#11233f", marginBottom: 6, fontSize: 14 }}>{post.title}</p>}

      {/* Standard / photo / fallback text content */}
      {!structured && post.content && (
        <p name={`postCardContent-${post.id}`} style={{ lineHeight: 1.55, color: "#23374e", marginBottom: 12, fontSize: 14 }}>
          {post.content}
        </p>
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
          {isVideoUrl(post.image_url) ? (
            <video
              name={`postCardVideo-${post.id}`}
              src={post.image_url}
              controls
              style={{ width: "100%", maxHeight: 360, display: "block" }}
            />
          ) : (
            <img name={`postCardImage-${post.id}`} src={post.image_url} alt={post.title || "Post image"} style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} />
          )}
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
        <button
          name={`postCommentCount-${post.id}`}
          onClick={() => setCommentsOpen((prev) => !prev)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: commentsOpen ? "#2563eb" : "#5f728f",
            fontSize: "0.9rem",
            padding: 0,
          }}
        >
          <MessageCircle size={15} /> {post.commentsCount}
        </button>
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

      {menuFeedback && (
        <p name={`postCardMenuFeedback-${post.id}`} style={{ margin: "8px 0 0", fontSize: 12, color: "#059669" }}>
          {menuFeedback}
        </p>
      )}

      {commentsOpen && (
        <CommentSection
          post={post}
          currentUser={currentUser}
          myDisplayName={myDisplayName}
          myProfile={myProfile}
          canInteract={canInteract}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
        />
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Comment section — shown inline under a post once expanded
// ---------------------------------------------------------------------------

function CommentSection({ post, currentUser, myDisplayName, myProfile, canInteract, onAddComment, onDeleteComment }) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAddComment(post, draft);
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      name={`postCommentSection-${post.id}`}
      style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e7edf7", display: "flex", flexDirection: "column", gap: 10 }}
    >
      {post.comments.length === 0 ? (
        <p name={`postCommentsEmpty-${post.id}`} style={{ margin: 0, fontSize: 12.5, color: "#5f728f" }}>
          No comments yet. Be the first to share your thoughts.
        </p>
      ) : (
        <div name={`postCommentsList-${post.id}`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {post.comments.map((comment) => {
            const commentAuthor = comment.author;
            const isMine = currentUser && comment.user_id === currentUser.id;
            return (
              <div key={comment.id} name={`postComment-${comment.id}`} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <Avatar
                  name={`postCommentAvatar-${comment.id}`}
                  displayName={commentAuthor?.full_name || commentAuthor?.username}
                  src={commentAuthor?.profile_picture}
                  size={28}
                />
                <div name={`postCommentBubble-${comment.id}`} style={{ flex: 1, background: "#f0f2f5", borderRadius: 14, padding: "8px 12px" }}>
                  <div name={`postCommentBubbleHeader-${comment.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span name={`postCommentAuthorName-${comment.id}`} style={{ fontSize: 12.5, fontWeight: 700, color: "#11233f" }}>
                      {commentAuthor?.full_name || commentAuthor?.username || "Unknown"}
                    </span>
                    {isMine && (
                      <button
                        name={`postCommentDeleteButton-${comment.id}`}
                        onClick={() => onDeleteComment(post, comment)}
                        aria-label="Delete comment"
                        title="Delete comment"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0, display: "inline-flex" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p name={`postCommentContent-${comment.id}`} style={{ margin: "2px 0 0", fontSize: 13.5, color: "#23374e", lineHeight: 1.45 }}>
                    {comment.content}
                  </p>
                </div>
                <span name={`postCommentTime-${comment.id}`} style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", marginTop: 8 }}>
                  {timeAgo(comment.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {canInteract ? (
        <form name={`postCommentForm-${post.id}`} onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={`postCommentComposerAvatar-${post.id}`} displayName={myDisplayName} src={myProfile?.profile_picture} size={28} />
          <input
            name={`postCommentInput-${post.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment…"
            disabled={submitting}
            style={{
              flex: 1,
              border: "1px solid #e7edf7",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 13,
              fontFamily: "inherit",
              color: "#11233f",
              outline: "none",
            }}
          />
          <button
            name={`postCommentSubmitButton-${post.id}`}
            type="submit"
            disabled={submitting || !draft.trim()}
            style={{
              border: "none",
              background: "none",
              color: submitting || !draft.trim() ? "#9ca3af" : "#2563eb",
              fontWeight: 700,
              fontSize: 13,
              cursor: submitting || !draft.trim() ? "not-allowed" : "pointer",
              padding: "6px 4px",
              flexShrink: 0,
            }}
          >
            Post
          </button>
        </form>
      ) : (
        <p name={`postCommentSignInPrompt-${post.id}`} style={{ margin: 0, fontSize: 12, color: "#5f728f" }}>
          Sign in to join the conversation.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New post composer — one modal, standard/photo/event/report
// ---------------------------------------------------------------------------

function ComposerModal({ mode, categories, currentUser, myDisplayName, myProfile, onClose, onCreated }) {
  const modeConfig = COMPOSER_MODES[mode] || COMPOSER_MODES.standard;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isVideoFile, setIsVideoFile] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const fileInputRef = useRef(null);
  const categoryId = categories[0]?.id || null;
  const todayISODate = localISODate();

  // Jumping straight into "Photo / Video" opens the file picker right away.
  useEffect(() => {
    if (mode === "photo") fileInputRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setIsVideoFile(file.type.startsWith("video/"));
    setImagePreview(URL.createObjectURL(file));
  }

  function validate() {
    if (!currentUser?.id) return "Please sign in to post to the community.";
    if (!title.trim()) return "Give your post a short title.";
    if (mode === "photo" && !imageFile) return "Please add a photo or video.";
    if (mode === "event") {
      if (!eventDate) return "Please pick a date for the event.";
      if (eventDate < localISODate()) return "Event date can't be in the past. Please choose a future date.";
    }
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

      // Event/report still pack their extra fields into `content` as JSON,
      // since the schema only has one free-text content column for those.
      let content = description.trim() || null;
      if (mode === "event") {
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
      setFormError(err.message || "Failed to create post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      name="composerModalBackdrop"
      onClick={() => !submitting && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(17,35,63,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 50,
      }}
    >
      <div
        name="composerModalDialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 500,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div
          name="composerModalHeader"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #e7edf7",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#11233f" }}>{modeConfig.label}</h2>
          <button
            name="composerModalCloseButton"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: "#f0f2f5",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: submitting ? "not-allowed" : "pointer",
              color: "#5f728f",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form name="composerModalForm" onSubmit={handleSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div name="composerModalUserRow" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name="composerModalUserAvatar" displayName={myDisplayName} src={myProfile?.profile_picture} />
            <div name="composerModalUserDetails">
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#11233f" }}>{myDisplayName}</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f0f2f5", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, color: "#5f728f", marginTop: 4 }}>
                <Globe2 size={11} /> Public
              </div>
            </div>
          </div>

          <div>
            <label style={fieldLabelStyle}>Title</label>
            <input
              name="composerModalTitleInput"
              style={fieldInputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's this about?"
            />
          </div>

          {mode === "event" && (
            <div name="composerModalEventFields" style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>Date</label>
                <input
                  name="composerModalEventDateInput"
                  type="date"
                  min={todayISODate}
                  style={fieldInputStyle}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>Location</label>
                <input
                  name="composerModalEventLocationInput"
                  style={fieldInputStyle}
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Where is it?"
                />
              </div>
            </div>
          )}

          {mode === "report" && (
            <div name="composerModalReportFields">
              <label style={fieldLabelStyle}>Urgency</label>
              <select name="composerModalReportUrgencySelect" style={fieldInputStyle} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={fieldLabelStyle}>{mode === "standard" ? "What's on your mind?" : "Description (optional)"}</label>
            <textarea
              name="composerModalDescriptionInput"
              style={textareaStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
            />
          </div>

          <div name="composerModalMediaSection">
            <input name="composerModalMediaInput" ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} style={{ display: "none" }} />
            {imagePreview ? (
              <div name="composerModalMediaPreview" style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #e7edf7" }}>
                {isVideoFile ? (
                  <video src={imagePreview} controls style={{ width: "100%", maxHeight: 200, display: "block" }} />
                ) : (
                  <img src={imagePreview} alt="Preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
                )}
                <button
                  name="composerModalRemoveMediaButton"
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setIsVideoFile(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "rgba(17,35,63,0.7)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                name="composerModalAddMediaButton"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: "100%",
                  padding: 14,
                  background: "#f8fbff",
                  border: "1px dashed #c3d4ee",
                  borderRadius: 12,
                  color: "#2563eb",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <ImageIcon size={18} /> Add Photo / Video
              </button>
            )}
          </div>

          {formError && (
            <div name="composerModalError" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", padding: "10px 14px", borderRadius: 10, border: "1px solid #fecaca" }}>
              {formError}
            </div>
          )}

          <button
            name="composerModalSubmitButton"
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "12px",
              background: submitting ? "#93c5fd" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                Posting...
              </>
            ) : (
              "Post"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}