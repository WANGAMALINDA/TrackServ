import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../Components/supabaseClient"; 
import Footer from  "../Components/footer"
import {
  Search,
  Plus,
  Star,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Store,
  Eye,
  MessageSquare,
  Car,
  Monitor,
  Sprout,
  Home,
  HeartPulse,
  GraduationCap,
  Package,
  X,
  Upload,
  CreditCard,
  CheckCircle2,
  Loader2,
  ImageOff,
  Phone,
  Mail,
  Clock,
  User,
} from "lucide-react";

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const LISTING_FEE = 150; // flat listing fee in ZAR, charged by the mock gateway before an ad goes live
const LISTING_LIFETIME_DAYS = 30; // ads automatically expire this many days after they go live
const LISTING_LIFETIME_MS = LISTING_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

// Icon/color per category, matched by keyword since categories only store
// a name + description in the DB. Mirrors the pattern used on the Reports page.
const CATEGORY_VISUALS = [
  { test: (n) => n.includes("automotive") || n.includes("auto"), icon: Car, color: "#3b82f6", bg: "#dbeafe" },
  { test: (n) => n.includes("tech"), icon: Monitor, color: "#7c3aed", bg: "#f3e8ff" },
  { test: (n) => n.includes("farm") || n.includes("produce"), icon: Sprout, color: "#16a34a", bg: "#dcfce7" },
  { test: (n) => n.includes("home"), icon: Home, color: "#f59e0b", bg: "#fef3c7" },
  { test: (n) => n.includes("health") || n.includes("wellness"), icon: HeartPulse, color: "#e11d48", bg: "#ffe4e6" },
  { test: (n) => n.includes("education") || n.includes("training"), icon: GraduationCap, color: "#4f46e5", bg: "#e0e7ff" },
];
const OTHER_VISUAL = { icon: Package, color: "#6b7280", bg: "#f3f4f6" };

function getCategoryVisual(categoryName) {
  const name = (categoryName || "").toLowerCase();
  return CATEGORY_VISUALS.find((c) => c.test(name)) || OTHER_VISUAL;
}

function formatZAR(amount) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);
}

// An ad is considered live for LISTING_LIFETIME_DAYS after it was created.
// Once that window has passed we treat it as expired everywhere on this page,
// even if its `status` column in the DB still says "active".
function getExpiryDate(listing) {
  const createdAt = listing.created_at ? new Date(listing.created_at).getTime() : Date.now();
  return new Date(createdAt + LISTING_LIFETIME_MS);
}

function isExpired(listing) {
  return getExpiryDate(listing).getTime() <= Date.now();
}

function daysRemaining(listing) {
  const msLeft = getExpiryDate(listing).getTime() - Date.now();
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  outline: "none",
  color: "#111827",
  boxSizing: "border-box",
};

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 };

export default function AdvertisementsPage() {
  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
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

  async function loadData() {
    setLoading(true);
    setError(null);

    const [{ data: cats, error: catError }, { data: rows, error: listError }] = await Promise.all([
      supabase.from("service_categories").select("id, name, description").order("name"),
      supabase
        .from("service_listings")
        .select(
          "id, category_id, owner_id, business_name, description, location, image_url, contact_phone, contact_email, rating, reviews_count, views_count, inquiries_count, status, created_at"
        )
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

    if (catError || listError) {
      setError(catError?.message || listError?.message);
    } else {
      setCategories(cats || []);
      setListings(rows || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data?.user?.id || null));
  }, []);

  // Ads older than LISTING_LIFETIME_DAYS are treated as expired and dropped
  // from every view on this page, regardless of their DB status.
  const activeListings = useMemo(() => listings.filter((l) => !isExpired(l)), [listings]);

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeListings;
    return activeListings.filter((l) =>
      [l.business_name, l.description, l.location].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [activeListings, query]);

  const listingsByCategory = useMemo(() => {
    const map = new Map();
    for (const cat of categories) map.set(cat.id, []);
    for (const l of filteredListings) {
      if (!map.has(l.category_id)) map.set(l.category_id, []);
      map.get(l.category_id).push(l);
    }
    return map;
  }, [categories, filteredListings]);

  // A category can only be picked on the "Add New Listing" form while it has
  // no live ad. Once that ad expires (or is removed) the category opens back up.
  const availableCategories = useMemo(() => {
    const occupied = new Set(activeListings.map((l) => l.category_id));
    return categories.filter((cat) => !occupied.has(cat.id));
  }, [categories, activeListings]);

  const stats = useMemo(() => {
    const totalListings = activeListings.length;
    const totalViews = activeListings.reduce((sum, l) => sum + (l.views_count || 0), 0);
    const totalInquiries = activeListings.reduce((sum, l) => sum + (l.inquiries_count || 0), 0);
    const rated = activeListings.filter((l) => l.reviews_count > 0);
    const avgRating = rated.length ? rated.reduce((sum, l) => sum + (l.rating || 0), 0) / rated.length : 0;
    return { totalListings, totalViews, totalInquiries, avgRating };
  }, [activeListings]);

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredListings.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredListings.length);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setQuery(searchInput);
    setPage(1);
  }

  function handleListingCreated(newListing) {
    setListings((prev) => [newListing, ...prev]);
    setShowAddModal(false);
  }

  function handleListingUpdated(updatedListing) {
    setListings((prev) => prev.map((l) => (l.id === updatedListing.id ? { ...l, ...updatedListing } : l)));
    setSelectedListing((prev) => (prev && prev.id === updatedListing.id ? { ...prev, ...updatedListing } : prev));
  }

  return (
    <div name="advertisementsPageContainer" style={{ backgroundColor: "#f3f4f6", minHeight: "100%", padding: narrow768 ? 12 : 20 }}>
      <div
        name="advertisementsContentWrapper"
        style={{ maxWidth: 1300, margin: "0 auto", display: "flex", flexDirection: narrow1024 ? "column" : "row", alignItems: narrow1024 ? "stretch" : "flex-start", gap: 20 }}
      >
        {/* Main column */}
        <div name="advertisementsMainColumn" style={{ flex: "1 1 0%", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Heading */}
          <div name="advertisementsHeadingRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div name="advertisementsTitleBlock">
              <h1 name="advertisementsPageTitle" style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#111827" }}>
                Services Marketplace
              </h1>
              <p name="advertisementsPageSubtitle" style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                Find trusted local services and products from verified businesses in your community.
              </p>
            </div>
            <div name="advertisementsHeaderActions" style={{ display: "flex", gap: 10 }}>
              <button
                name="addNewListingButton"
                onClick={() => setShowAddModal(true)}
                disabled={availableCategories.length === 0}
                title={availableCategories.length === 0 ? "Every category currently has a live ad" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  backgroundColor: availableCategories.length === 0 ? "#9ca3af" : "#047857",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: availableCategories.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                <Plus size={15} /> Add New Listing
              </button>
            </div>
          </div>

          {error && (
            <div name="advertisementsErrorBanner" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Search */}
          <form name="advertisementsSearchForm" onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 10 }}>
            <div name="advertisementsSearchWrapper" style={{ position: "relative", flex: 1 }}>
              <Search size={15} color="#9ca3af" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input
                name="advertisementsSearchInput"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search services, businesses, or keywords..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px 12px 38px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#fff",
                  outline: "none",
                }}
              />
            </div>
            <button
              name="advertisementsSearchButton"
              type="submit"
              style={{
                padding: "0 24px",
                backgroundColor: "#047857",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Search
            </button>
          </form>

          {/* Category sections */}
          {loading ? (
            <div name="advertisementsLoadingState" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Loading marketplace…
            </div>
          ) : categories.length === 0 ? (
            <div name="advertisementsEmptyState" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              No categories have been set up yet.
            </div>
          ) : (
            categories.map((cat) => (
              <CategorySection
                key={cat.id}
                category={cat}
                listings={(listingsByCategory.get(cat.id) || []).slice(0, 4)}
                onViewDetails={setSelectedListing}
              />
            ))
          )}

          {/* Pagination */}
          {!loading && filteredListings.length > 0 && (
            <div name="advertisementsPaginationRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
              <p name="advertisementsPaginationSummary" style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                Showing {pageStart} to {pageEnd} of {filteredListings.length} services
              </p>
              <div name="advertisementsPaginationControls" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  name="advertisementsPrevPage"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={pagerButtonStyle(false, currentPage === 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button key={n} name={`advertisementsPage-${n}`} onClick={() => setPage(n)} style={pagerButtonStyle(n === currentPage, false)}>
                    {n}
                  </button>
                ))}
                <button
                  name="advertisementsNextPage"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={pagerButtonStyle(false, currentPage === totalPages)}
                >
                  <ChevronRight size={14} />
                </button>
                <select
                  name="advertisementsPageSize"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{ marginLeft: 8, padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb", backgroundColor: "#fff", color: "#374151", cursor: "pointer" }}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} name={`advertisementsPageSizeOption-${n}`} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar (right hand side) */}
        <div name="advertisementsSidebar" style={{ width: narrow1024 ? "100%" : 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <SidebarCard name="marketplaceOverviewCard" title="Marketplace Overview">
            <div name="marketplaceOverviewGrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <MiniStat icon={Store} iconBg="#dbeafe" iconFg="#3b82f6" value={stats.totalListings} label="Total Listings" />
              <MiniStat icon={Eye} iconBg="#dbeafe" iconFg="#3b82f6" value={stats.totalViews} label="Total Views" />
              <MiniStat icon={MessageSquare} iconBg="#fef3c7" iconFg="#f59e0b" value={stats.totalInquiries} label="Total Inquiries" />
              <MiniStat icon={Star} iconBg="#fef9c3" iconFg="#ca8a04" value={stats.avgRating.toFixed(1)} label="Avg Rating" />
            </div>
          </SidebarCard>

          <SidebarCard name="categoriesCard" title="Categories" actionLabel="View All">
            <div name="categoriesList" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <CategoryRow label="All Categories" icon={Package} count={activeListings.length} />
              {categories.map((cat) => {
                const visual = getCategoryVisual(cat.name);
                return (
                  <CategoryRow
                    key={cat.id}
                    label={cat.name}
                    icon={visual.icon}
                    count={(listingsByCategory.get(cat.id) || []).length}
                  />
                );
              })}
            </div>
          </SidebarCard>
        </div>
      </div>

      {showAddModal && (
        <AddListingModal
          categories={availableCategories}
          onClose={() => setShowAddModal(false)}
          onCreated={handleListingCreated}
        />
      )}

      {selectedListing && (
        <ListingDetailsModal
          listing={selectedListing}
          category={categories.find((c) => c.id === selectedListing.category_id)}
          currentUserId={currentUserId}
          onClose={() => setSelectedListing(null)}
          onListingUpdated={handleListingUpdated}
        />
      )}
    </div>
  );
}

function CategorySection({ category, listings, onViewDetails }) {
  const visual = getCategoryVisual(category.name);
  const Icon = visual.icon;

  // Responsive breakpoints — same resize-listener approach as Sidebar.jsx / Profile.jsx
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Nothing listed in this category right now — skip rendering the whole section.
  if (listings.length === 0) return null;

  return (
    <div name={`categorySection-${category.id}`}>
      <div name={`categorySectionHeader-${category.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div name={`categorySectionTitleGroup-${category.id}`} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            name={`categorySectionIcon-${category.id}`}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: visual.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={19} color={visual.color} />
          </div>
          <div name={`categorySectionText-${category.id}`}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>{category.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{category.description}</p>
          </div>
        </div>
        <button
          name={`categorySectionViewAll-${category.id}`}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#047857", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
        >
          View All <ChevronRight size={13} />
        </button>
      </div>

      <div
        name={`categorySectionGrid-${category.id}`}
        style={{
          display: "grid",
          gridTemplateColumns: width < 480 ? "1fr" : width < 768 ? "repeat(2, 1fr)" : width < 1100 ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
          gap: 16,
        }}
      >
        {listings.map((l) => (
          <ServiceCard key={l.id} listing={l} onViewDetails={onViewDetails} />
        ))}
      </div>
    </div>
  );
}

function ServiceCard({ listing, onViewDetails }) {
  const daysLeft = daysRemaining(listing);
  return (
    <div
      name={`serviceCard-${listing.id}`}
      style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div name={`serviceCardImageWrapper-${listing.id}`} style={{ width: "100%", height: 130, backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {listing.image_url ? (
          <img name={`serviceCardImage-${listing.id}`} src={listing.image_url} alt={listing.business_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <ImageOff size={22} color="#d1d5db" />
        )}
      </div>
      <div name={`serviceCardBody-${listing.id}`} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <p name={`serviceCardTitle-${listing.id}`} style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>{listing.business_name}</p>
        <p
          name={`serviceCardDescription-${listing.id}`}
          style={{ margin: 0, fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", flex: 1 }}
        >
          {listing.description}
        </p>
        <div name={`serviceCardRating-${listing.id}`} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#374151" }}>
          <Star size={13} color="#ca8a04" fill="#ca8a04" />
          <span style={{ fontWeight: 600 }}>{Number(listing.rating || 0).toFixed(1)}</span>
          <span style={{ color: "#9ca3af" }}>({listing.reviews_count || 0} reviews)</span>
        </div>
        <div name={`serviceCardLocation-${listing.id}`} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7280" }}>
          <MapPin size={13} color="#9ca3af" />
          {listing.location}
        </div>
        <div name={`serviceCardExpiry-${listing.id}`} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: daysLeft <= 5 ? "#b91c1c" : "#9ca3af" }}>
          <Clock size={12} color={daysLeft <= 5 ? "#b91c1c" : "#9ca3af"} />
          {daysLeft === 0 ? "Expires today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
        </div>
        <button
          name={`serviceCardViewDetails-${listing.id}`}
          onClick={() => onViewDetails?.(listing)}
          style={{
            marginTop: 6,
            padding: "8px 12px",
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
      </div>
    </div>
  );
}

function SidebarCard({ name, title, actionLabel, children }) {
  return (
    <div name={name} style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>{title}</p>
        {actionLabel && (
          <button style={{ background: "none", border: "none", color: "#047857", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{actionLabel}</button>
        )}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ icon: Icon, iconBg, iconFg, value, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={15} color={iconFg} />
      </div>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{label}</p>
    </div>
  );
}

function CategoryRow({ label, icon: Icon, count }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
        <Icon size={14} color="#9ca3af" />
        {label}
      </div>
      <span style={{ fontSize: 12, color: "#9ca3af" }}>{count}</span>
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

// ---------------------------------------------------------------------------
// Listing details modal: full read-only view + owner-only "add a review" form
// ---------------------------------------------------------------------------

function ListingDetailsModal({ listing, category, currentUserId, onClose, onListingUpdated }) {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFormError, setReviewFormError] = useState(null);
  const [modalWidth, setModalWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setModalWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const visual = getCategoryVisual(category?.name);
  const isOwner = Boolean(currentUserId) && listing.owner_id === currentUserId;
  const daysLeft = daysRemaining(listing);

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);

  async function loadReviews() {
    setLoadingReviews(true);
    setReviewsError(null);
    // Requires a `listing_reviews` table: id, listing_id, reviewer_id, rating, comment, created_at.
    const { data, error } = await supabase
      .from("listing_reviews")
      .select("id, rating, comment, created_at")
      .eq("listing_id", listing.id)
      .order("created_at", { ascending: false });
    if (error) {
      setReviewsError(error.message);
      setReviews([]);
    } else {
      setReviews(data || []);
    }
    setLoadingReviews(false);
  }

  async function handleAddReview(e) {
    e.preventDefault();
    if (!reviewForm.comment.trim()) {
      setReviewFormError("Please write a short comment for the review.");
      return;
    }
    setReviewFormError(null);
    setSubmittingReview(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: newReview, error } = await supabase
        .from("listing_reviews")
        .insert({
          listing_id: listing.id,
          reviewer_id: user?.id || null,
          rating: reviewForm.rating,
          comment: reviewForm.comment.trim(),
        })
        .select()
        .single();
      if (error) throw error;

      const updatedReviews = [newReview, ...reviews];
      setReviews(updatedReviews);
      setReviewForm({ rating: 5, comment: "" });

      // Keep the listing's aggregate rating/review count in sync.
      const newReviewsCount = updatedReviews.length;
      const newAvgRating = updatedReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / newReviewsCount;
      const { error: updateError } = await supabase
        .from("service_listings")
        .update({ rating: newAvgRating, reviews_count: newReviewsCount })
        .eq("id", listing.id);
      if (!updateError) {
        onListingUpdated?.({ id: listing.id, rating: newAvgRating, reviews_count: newReviewsCount });
      }
    } catch (err) {
      setReviewFormError(err.message || "Could not add that review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div
      name="listingDetailsModalBackdrop"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(17,24,39,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
    >
      <div
        name="listingDetailsModal"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div name="listingDetailsImageWrapper" style={{ width: "100%", height: 200, backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          {listing.image_url ? (
            <img src={listing.image_url} alt={listing.business_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <ImageOff size={28} color="#d1d5db" />
          )}
          <button
            name="listingDetailsCloseButton"
            onClick={onClose}
            style={{ position: "absolute", top: 12, right: 12, background: "rgba(17,24,39,0.6)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <X size={16} color="#fff" />
          </button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {category && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: 9999,
                    backgroundColor: visual.bg,
                    color: visual.color,
                  }}
                >
                  {category.name}
                </span>
              )}
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: daysLeft <= 5 ? "#b91c1c" : "#9ca3af" }}>
                <Clock size={12} /> {daysLeft === 0 ? "Expires today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>{listing.business_name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 13, color: "#374151" }}>
              <Star size={14} color="#ca8a04" fill="#ca8a04" />
              <span style={{ fontWeight: 600 }}>{Number(listing.rating || 0).toFixed(1)}</span>
              <span style={{ color: "#9ca3af" }}>({listing.reviews_count || 0} reviews)</span>
            </div>
          </div>

          <div>
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#374151" }}>Description</p>
            <p style={{ margin: 0, fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>{listing.description}</p>
          </div>

          <div name="listingDetailsInfoGrid" style={{ display: "grid", gridTemplateColumns: modalWidth < 480 ? "1fr" : "1fr 1fr", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <MapPin size={15} color="#9ca3af" style={{ marginTop: 1 }} />
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Location</p>
                <p style={{ margin: 0, fontSize: 13, color: "#111827", fontWeight: 600 }}>{listing.location || "—"}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Clock size={15} color="#9ca3af" style={{ marginTop: 1 }} />
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Listed on</p>
                <p style={{ margin: 0, fontSize: 13, color: "#111827", fontWeight: 600 }}>{formatDate(listing.created_at)}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Eye size={15} color="#9ca3af" style={{ marginTop: 1 }} />
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Views</p>
                <p style={{ margin: 0, fontSize: 13, color: "#111827", fontWeight: 600 }}>{listing.views_count || 0}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <MessageSquare size={15} color="#9ca3af" style={{ marginTop: 1 }} />
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Inquiries</p>
                <p style={{ margin: 0, fontSize: 13, color: "#111827", fontWeight: 600 }}>{listing.inquiries_count || 0}</p>
              </div>
            </div>
          </div>

          {/* Contact details */}
          <div name="listingDetailsContactSection" style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#374151" }}>Contact Details</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#111827" }}>
                <Phone size={14} color="#047857" />
                {listing.contact_phone || "Not provided"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#111827" }}>
                <Mail size={14} color="#047857" />
                {listing.contact_email || "Not provided"}
              </div>
            </div>
          </div>

          {/* Reviews */}
          <div name="listingDetailsReviewsSection">
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#374151" }}>Reviews</p>

            {loadingReviews ? (
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>Loading reviews…</p>
            ) : reviewsError ? (
              <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{reviewsError}</p>
            ) : reviews.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>No reviews yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 4 }}>
                {reviews.map((r) => (
                  <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Star size={13} color="#ca8a04" fill="#ca8a04" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{r.rating}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(r.created_at)}</span>
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#4b5563" }}>{r.comment}</p>
                  </div>
                ))}
              </div>
            )}

            {isOwner ? (
              <form name="listingAddReviewForm" onSubmit={handleAddReview} style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10, backgroundColor: "#f0fdf4", border: "1px solid #d1fae5", borderRadius: 10, padding: 14 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#047857" }}>Add a review for your listing</p>
                <div>
                  <label style={labelStyle}>Rating</label>
                  <select
                    name="listingReviewRating"
                    style={inputStyle}
                    value={reviewForm.rating}
                    onChange={(e) => setReviewForm((f) => ({ ...f, rating: Number(e.target.value) }))}
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} star{n === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Comment</label>
                  <textarea
                    name="listingReviewComment"
                    style={{ ...inputStyle, resize: "vertical", minHeight: 60, fontFamily: "inherit" }}
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                    placeholder="Share something about this listing…"
                  />
                </div>
                {reviewFormError && <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{reviewFormError}</p>}
                <button
                  name="listingReviewSubmit"
                  type="submit"
                  disabled={submittingReview}
                  style={{ padding: "9px 14px", backgroundColor: "#047857", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: submittingReview ? "not-allowed" : "pointer", opacity: submittingReview ? 0.7 : 1 }}
                >
                  {submittingReview ? "Posting…" : "Post Review"}
                </button>
              </form>
            ) : (
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 5 }}>
                <User size={12} /> Only the lister who posted this ad can add reviews to it.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Listing modal: business details -> mock ZAR payment -> post the ad
// ---------------------------------------------------------------------------

function AddListingModal({ categories, onClose, onCreated }) {
  const [step, setStep] = useState("details"); // details -> payment -> success
  const [form, setForm] = useState({
    business_name: "",
    category_id: categories[0]?.id || "",
    description: "",
    location: "",
    contact_phone: "",
    contact_email: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formError, setFormError] = useState(null);

  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [paymentError, setPaymentError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [createdListing, setCreatedListing] = useState(null);
  const fileInputRef = useRef(null);

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleDetailsSubmit(e) {
    e.preventDefault();
    if (!form.business_name.trim() || !form.category_id || !form.description.trim() || !form.location.trim()) {
      setFormError("Please fill in every field.");
      return;
    }
    if (!form.contact_phone.trim() && !form.contact_email.trim()) {
      setFormError("Please provide at least one contact detail (phone or email).");
      return;
    }
    if (!imageFile) {
      setFormError("Please add a photo for your listing.");
      return;
    }
    setFormError(null);
    setStep("payment");
  }

  function formatCardNumber(value) {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }

  function formatExpiry(value) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  async function handlePaySubmit(e) {
    e.preventDefault();
    setPaymentError(null);

    const digitsOnly = card.number.replace(/\s/g, "");
    if (!card.name.trim()) return setPaymentError("Enter the name on the card.");
    if (digitsOnly.length !== 16) return setPaymentError("Card number must be 16 digits.");
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) return setPaymentError("Expiry must be in MM/YY format.");
    if (!/^\d{3}$/.test(card.cvv)) return setPaymentError("CVV must be 3 digits.");

    setProcessing(true);
    try {
      // Mock payment gateway — simulates a network round trip to a card processor.
      // Swap this block for a real gateway integration (e.g. Paystack/Yoco/PayFast) when ready.
      await new Promise((resolve) => setTimeout(resolve, 1600));
      const paymentReference = `MOCK-${Date.now().toString(36).toUpperCase()}`;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Payment succeeded — now upload the photo and post the ad.
      const fileExt = imageFile.name.split(".").pop();
      const filePath = `listings/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("images").upload(filePath, imageFile);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("images").getPublicUrl(filePath);

      const { data: listingRow, error: insertError } = await supabase
        .from("service_listings")
        .insert({
          category_id: form.category_id,
          owner_id: user?.id || null,
          business_name: form.business_name.trim(),
          description: form.description.trim(),
          location: form.location.trim(),
          contact_phone: form.contact_phone.trim() || null,
          contact_email: form.contact_email.trim() || null,
          image_url: publicUrl,
          status: "active",
        })
        .select()
        .single();
      if (insertError) throw insertError;

      await supabase.from("ad_payments").insert({
        listing_id: listingRow.id,
        payer_id: user?.id || null,
        amount: LISTING_FEE,
        currency: "ZAR",
        status: "success",
        payment_reference: paymentReference,
      });

      setCreatedListing(listingRow);
      setStep("success");
    } catch (err) {
      setPaymentError(err.message || "Something went wrong posting your ad. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div
      name="addListingModalBackdrop"
      onClick={() => !processing && onClose()}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(17,24,39,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
    >
      <div
        name="addListingModal"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 24 }}
      >
        <style>{"@keyframes advertisements-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
        <div name="addListingModalHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
            {step === "details" && "Add New Listing"}
            {step === "payment" && "Listing Fee Payment"}
            {step === "success" && "Ad Posted"}
          </p>
          {step !== "success" && (
            <button
              name="addListingModalClose"
              onClick={onClose}
              disabled={processing}
              style={{ background: "none", border: "none", cursor: processing ? "not-allowed" : "pointer", color: "#9ca3af", padding: 4 }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {step === "details" && (
          <form name="addListingDetailsForm" onSubmit={handleDetailsSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>
              Your ad will stay live for {LISTING_LIFETIME_DAYS} days from the moment it's posted, then automatically expire.
            </p>
            <div>
              <label style={labelStyle}>Business name</label>
              <input name="listingBusinessName" style={inputStyle} value={form.business_name} onChange={(e) => updateForm("business_name", e.target.value)} placeholder="e.g. ProAuto Repairs" />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              {categories.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>
                  Every category currently has a live ad. You'll be able to post once one expires.
                </p>
              ) : (
                <select name="listingCategory" style={inputStyle} value={form.category_id} onChange={(e) => updateForm("category_id", e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} name={`listingCategoryOption-${c.id}`} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                name="listingDescription"
                style={{ ...inputStyle, resize: "vertical", minHeight: 80, fontFamily: "inherit" }}
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="What does your business offer?"
              />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input name="listingLocation" style={inputStyle} value={form.location} onChange={(e) => updateForm("location", e.target.value)} placeholder="e.g. Pretoria Central" />
            </div>

            {/* Contact details */}
            <div name="listingContactDetailsSection" style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#374151" }}>Contact Details</p>
              <div>
                <label style={labelStyle}>Phone number</label>
                <div style={{ position: "relative" }}>
                  <Phone size={14} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    name="listingContactPhone"
                    style={{ ...inputStyle, paddingLeft: 34 }}
                    value={form.contact_phone}
                    onChange={(e) => updateForm("contact_phone", e.target.value)}
                    placeholder="e.g. 071 234 5678"
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email address</label>
                <div style={{ position: "relative" }}>
                  <Mail size={14} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    name="listingContactEmail"
                    type="email"
                    style={{ ...inputStyle, paddingLeft: 34 }}
                    value={form.contact_email}
                    onChange={(e) => updateForm("contact_email", e.target.value)}
                    placeholder="e.g. info@business.co.za"
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Photo</label>
              <input name="listingImageInput" ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              <div
                name="listingImageDropzone"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "1px dashed #d1d5db",
                  borderRadius: 10,
                  padding: 16,
                  textAlign: "center",
                  cursor: "pointer",
                  color: "#6b7280",
                  fontSize: 12,
                }}
              >
                {imagePreview ? (
                  <img name="listingImagePreview" src={imagePreview} alt="Listing preview" style={{ maxHeight: 120, borderRadius: 8, margin: "0 auto" }} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <Upload size={18} color="#9ca3af" />
                    Click to upload a photo
                  </div>
                )}
              </div>
            </div>

            {formError && <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{formError}</p>}

            <button
              name="addListingContinueToPayment"
              type="submit"
              disabled={categories.length === 0}
              style={{
                marginTop: 4,
                padding: "11px 16px",
                backgroundColor: categories.length === 0 ? "#9ca3af" : "#047857",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: categories.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Continue to Payment — {formatZAR(LISTING_FEE)}
            </button>
          </form>
        )}

        {step === "payment" && (
          <form name="addListingPaymentForm" onSubmit={handlePaySubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div name="paymentSummaryBanner" style={{ backgroundColor: "#f0fdf4", border: "1px solid #d1fae5", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#374151" }}>Listing fee</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#047857" }}>{formatZAR(LISTING_FEE)}</span>
            </div>

            <div>
              <label style={labelStyle}>Name on card</label>
              <input name="paymentCardName" style={inputStyle} value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} placeholder="J Malinda" disabled={processing} />
            </div>
            <div>
              <label style={labelStyle}>Card number</label>
              <div style={{ position: "relative" }}>
                <CreditCard size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  name="paymentCardNumber"
                  style={{ ...inputStyle, paddingLeft: 36 }}
                  value={card.number}
                  onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
                  placeholder="4111 1111 1111 1111"
                  disabled={processing}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Expiry</label>
                <input
                  name="paymentCardExpiry"
                  style={inputStyle}
                  value={card.expiry}
                  onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                  placeholder="MM/YY"
                  disabled={processing}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>CVV</label>
                <input
                  name="paymentCardCvv"
                  style={inputStyle}
                  value={card.cvv}
                  onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                  placeholder="123"
                  disabled={processing}
                />
              </div>
            </div>

            {paymentError && <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{paymentError}</p>}

            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>
              This is a mock payment form for demo purposes — no real card details are sent or stored.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                name="paymentBackButton"
                type="button"
                onClick={() => setStep("details")}
                disabled={processing}
                style={{ flex: 1, padding: "11px 16px", backgroundColor: "#fff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: processing ? "not-allowed" : "pointer" }}
              >
                Back
              </button>
              <button
                name="paymentPayButton"
                type="submit"
                disabled={processing}
                style={{
                  flex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "11px 16px",
                  backgroundColor: "#047857",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: processing ? "not-allowed" : "pointer",
                  opacity: processing ? 0.75 : 1,
                }}
              >
                {processing ? (
                  <>
                    <Loader2 size={15} style={{ animation: "advertisements-spin 1s linear infinite" }} /> Processing payment…
                  </>
                ) : (
                  `Pay ${formatZAR(LISTING_FEE)}`
                )}
              </button>
            </div>
          </form>
        )}

        {step === "success" && (
          <div name="addListingSuccessPanel" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, padding: "12px 0" }}>
            <CheckCircle2 size={42} color="#047857" />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Payment successful</p>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
              {formatZAR(LISTING_FEE)} charged. "{createdListing?.business_name}" is now live on the marketplace for {LISTING_LIFETIME_DAYS} days.
            </p>
            <button
              name="addListingDoneButton"
              onClick={() => onCreated(createdListing)}
              style={{ marginTop: 8, padding: "10px 20px", backgroundColor: "#047857", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}