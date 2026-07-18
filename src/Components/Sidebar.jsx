import { useState, useEffect } from "react";
import {
  MapPin,
  Search,
  ChevronDown,
  User,
  Home,
  FolderOpen,
  Users,
  Info,
  TriangleAlert,
  Droplet,
  Zap,
  Leaf,
  Shield,
  Circle,
  HeadphonesIcon,
  Menu,
  X,
  Wrench,
} from "lucide-react";

const navItems = [
  { key: "profile", label: "My Profile", icon: User },
  { key: "home", label: "Home", icon: Home },
  { key: "about", label: "About", icon: Info },
  { key: "reports", label: "Reports", icon: FolderOpen },
  { key: "community", label: "Community", icon: Users },
  { key: "services", label: "Service Providers", icon: Wrench },
];

const categoryItems = [
  { key: "all", label: "All Issues", icon: Circle, color: "#111827" },
  { key: "roads", label: "Roads & Infrastructure", icon: TriangleAlert, color: "#f59e0b" },
  { key: "water", label: "Water & Sanitation", icon: Droplet, color: "#3b82f6" },
  { key: "utilities", label: "Public Utilities", icon: Zap, color: "#10b981" },
  { key: "environment", label: "Environment", icon: Leaf, color: "#16a34a" },
  { key: "safety", label: "Safety & Security", icon: Shield, color: "#a855f7" },
  { key: "other", label: "Other", icon: Circle, color: "#9ca3af" },
];

function NavRow({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        transition: "background-color 0.15s, color 0.15s",
        backgroundColor: active ? "#ecfdf5" : "transparent",
        color: active ? "#047857" : "#374151",
      }}
    >
      <Icon size={18} color={active ? "#059669" : "#6b7280"} />
      <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
      {item.badge ? (
        <span
          style={{
            minWidth: 20,
            height: 20,
            padding: "0 4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            backgroundColor: "#059669",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {item.badge}
        </span>
      ) : null}
    </button>
  );
}

export default function Sidebar({ children, activePage = "home", onPageChange, selectedCategory = "all", onCategoryChange }) {
  const contactHref = "tel:0664948899";
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileNavOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const closeMobileNav = () => {
    if (isMobile) setMobileNavOpen(false);
  };

  return (
    <div style={{ height: "100vh", backgroundColor: "#f3f4f6", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top bar */}
      <header
        style={{
          height: 64,
          backgroundColor: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 16,
          position: "relative",
        }}
      >
        <button
          onClick={() => setMobileNavOpen((open) => !open)}
          aria-label="Toggle navigation"
          style={{
            padding: 6,
            color: "#6b7280",
            background: "none",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          <Menu size={20} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MapPin size={16} color="#fff" />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#111827", fontSize: 16 }}>
              Track<span style={{ color: "#059669" }}>Serv</span>
            </p>
            <p style={{ margin: 0, marginTop: -2, fontSize: 11, color: "#6b7280" }}>
              Unified Citizen Hub
            </p>
          </div>
        </div>

        {/* Search */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(100%, 576px)",
            padding: "0 16px",
          }}
        >
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              color="#9ca3af"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search issues, reports, community..."
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                fontSize: 14,
                borderRadius: 9999,
                border: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1 }} />


        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingLeft: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
              overflow: "hidden",
            }}
          >
            <User size={16} />
          </div>
          <div style={{ textAlign: "left", lineHeight: 1.2 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>John Doe</p>
            <p style={{ margin: 0, marginTop: -2, fontSize: 11, color: "#6b7280" }}>Active Citizen</p>
          </div>
          <ChevronDown size={16} color="#9ca3af" />
        </button>
      </header>

      <div style={{ display: "flex", flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
        {/* Mobile overlay */}
        {isMobile && mobileNavOpen && (
          <div
            onClick={() => setMobileNavOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 30,
              backgroundColor: "rgba(0,0,0,0.3)",
            }}
          />
        )}

        {/* Sidebar */}
        <aside
          style={{
            width: 256,
            backgroundColor: "#fff",
            borderRight: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "transform 0.2s ease-in-out",
            height: "calc(100vh - 64px)",
            flexShrink: 0,
            ...(isMobile
              ? {
                  position: "fixed",
                  top: 64,
                  bottom: 0,
                  left: 0,
                  zIndex: 40,
                  transform: mobileNavOpen ? "translateX(0)" : "translateX(-100%)",
                }
              : { position: "static", transform: "none" }),
          }}
        >
          {isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
              }}
            >
              <span style={{ fontWeight: 600, color: "#111827" }}>Menu</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                style={{
                  padding: 4,
                  color: "#6b7280",
                  background: "none",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}

          <nav style={{ padding: "16px 8px 0", display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", minHeight: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {navItems.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  active={activePage === item.key}
                  onClick={() => {
                    onPageChange?.(item.key);
                    closeMobileNav();
                  }}
                />
              ))}
            </div>

            <div>
              <p
                style={{
                  margin: 0,
                  marginBottom: 4,
                  padding: "0 16px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  color: "#9ca3af",
                }}
              >
                CATEGORIES
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {categoryItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = selectedCategory === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        onCategoryChange?.(item.key);
                        closeMobileNav();
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 16px",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        backgroundColor: isActive ? "#ecfdf5" : "transparent",
                        color: isActive ? "#047857" : "#374151",
                      }}
                    >
                      <Icon size={18} color={item.color} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Help card */}
          <div
            style={{
              margin: 16,
              padding: 16,
              borderRadius: 12,
              backgroundColor: "#ecfdf5",
              border: "1px solid #d1fae5",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "#d1fae5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <HeadphonesIcon size={18} color="#059669" />
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>Need help?</p>
            <p style={{ margin: "2px 0 12px", fontSize: 12, color: "#6b7280" }}>
              Contact our support team, we're here to help.
            </p>
            <a
              href={contactHref}
              style={{
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#047857",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                padding: "8px 0",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              Contact Support
            </a>
          </div>
        </aside>

          <main style={{ flex: 1, minHeight: 0, overflowY: "auto", backgroundColor: "rgba(229,231,235,0.7)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}