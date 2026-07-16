import { useState, useRef, useCallback } from "react";
import Footer from "../Components/footer";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Camera,
  Send,
  Search,
  Crosshair,
  UploadCloud,
  X,
  SquarePen,
  Locate,
  Bell,
  ShieldCheck,
  Droplet,
  Zap,
  Trash2,
  TriangleAlert,
  Loader2,
  MoreHorizontal,
} from "lucide-react";

const CATEGORIES = [
  { value: "roads", label: "Roads & Infrastructure", icon: TriangleAlert, color: "#f59e0b" },
  { value: "water", label: "Water Leak", icon: Droplet, color: "#3b82f6" },
  { value: "electricity", label: "Electricity", icon: Zap, color: "#eab308" },
  { value: "garbage", label: "Garbage", icon: Trash2, color: "#059669" },
  { value: "other", label: "Other", icon: MoreHorizontal, color: "#059669" },
];

const DEFAULT_POSITION = [-25.7461, 28.1881]; // Tshwane / Pretoria, South Africa
const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 5;
const DESCRIPTION_LIMIT = 500;
const ADDITIONAL_INFO_LIMIT = 300;

function pinIcon(color = "#047857") {
  return L.divIcon({
    className: "map-pin-icon",
    html: `<div style="
      width: 30px;
      height: 30px;
      border-radius: 50% 50% 50% 0;
      background: ${color};
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      border: 2px solid #fff;
    "></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  });
}

// Lets the user fine-tune the pin by clicking anywhere on the map.
function ClickToSetLocation({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

async function reverseGeocode(lat, lng) {
  // Free, no-API-key reverse geocoding via OpenStreetMap's Nominatim.
  // Fine for light/dev use — swap for a paid geocoder (Google, Mapbox) in production
  // to respect Nominatim's usage policy and get faster, more reliable results.
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Reverse geocode failed");
  const data = await res.json();
  const a = data.address || {};
  const line1 =
    [a.road, a.house_number].filter(Boolean).join(" ") ||
    a.neighbourhood ||
    a.suburb ||
    "Selected location";
  const line2 = [a.suburb || a.neighbourhood, a.city || a.town || a.village, a.postcode]
    .filter(Boolean)
    .join(", ");
  return { line1, line2: line2 || "" };
}

async function searchLocation(queryText) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    queryText
  )}&limit=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Search failed");
  const results = await res.json();
  if (!results.length) return null;
  const r = results[0];
  return {
    position: [parseFloat(r.lat), parseFloat(r.lon)],
    line1: r.display_name.split(",")[0],
    line2: r.display_name.split(",").slice(1, 3).join(",").trim(),
  };
}

function TipCard({ icon: Icon, iconBg, iconColor, title, text }) {
  return (
    <div className="tip-card">
      <div
        className="tip-card-icon"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          backgroundColor: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={16} color={iconColor} />
      </div>
      <div className="tip-card-copy">
        <p className="tip-card-title" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{title}</p>
        <p className="tip-card-text" style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>{text}</p>
      </div>
    </div>
  );
}

export default function ReportIssues() {
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [description, setDescription] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState("");

  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [location, setLocation] = useState({
    line1: "Corner of 5th Ave & Main St",
    line2: "Newtown, Cityville, 0001",
  });
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  const fileInputRef = useRef(null);
  const selectedCategory = CATEGORIES.find((c) => c.value === category) || CATEGORIES[0];

  const applyResolvedLocation = (lat, lng, line1, line2) => {
    setPosition([lat, lng]);
    setLocation({ line1, line2 });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation isn't supported on this device.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const resolved = await reverseGeocode(latitude, longitude);
          applyResolvedLocation(latitude, longitude, resolved.line1, resolved.line2);
        } catch {
          applyResolvedLocation(latitude, longitude, "Current location", "");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocationError("Couldn't get your location. Check your browser permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    setSearching(true);
    setLocationError("");
    try {
      const result = await searchLocation(searchText.trim());
      if (!result) {
        setLocationError("No matching location found.");
      } else {
        applyResolvedLocation(result.position[0], result.position[1], result.line1, result.line2);
        setShowSearch(false);
        setSearchText("");
      }
    } catch {
      setLocationError("Location search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleMapClick = async ([lat, lng]) => {
    setPosition([lat, lng]);
    try {
      const resolved = await reverseGeocode(lat, lng);
      setLocation({ line1: resolved.line1, line2: resolved.line2 });
    } catch {
      setLocation({ line1: "Selected location", line2: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    }
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList);
    const valid = [];
    let error = "";

    for (const f of incoming) {
      if (!f.type.startsWith("image/")) {
        error = "Only image files are allowed.";
        continue;
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        error = `"${f.name}" is over ${MAX_FILE_SIZE_MB}MB.`;
        continue;
      }
      valid.push(f);
    }

    setFiles((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        error = `You can upload up to ${MAX_FILES} photos.`;
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
    setFileError(error);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setFormError("Please describe the issue before submitting.");
      return;
    }
    setFormError("");
    setSubmitting(true);

    // Replace with a real API call to your backend.
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setDescription("");
      setAdditionalInfo("");
      setFiles([]);
      setCategory(CATEGORIES[0].value);
    }, 900);
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    backgroundColor: "#fff",
    outline: "none",
    fontFamily: "inherit",
    color: "#111827",
    boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
  };

  return (
    <div className="report-issue-page" style={{ backgroundColor: "#f3f4f6", minHeight: "100vh", padding: 20 }}>
      <div className="report-issue-shell" style={{ maxWidth: 1300, margin: "0 10", display: "flex", flexDirection: "column", gap: 20  }}>
        {/* Banner */}
        <div
          className="report-banner"
          style={{
            position: "relative",
            borderRadius: 16,
            overflow: "hidden",
            background: "linear-gradient(135deg, #ecfdf5 0%, #dbeafe 100%)",
            padding: "28px 32px",
          }}
        >
          <div className="report-banner-content" style={{ position: "relative", zIndex: 2, maxWidth: 560 }}>
            <h1 className="report-banner-title" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#111827" }}>
              Report an Issue
            </h1>
            <p className="report-banner-description" style={{ margin: "8px 0 12px", fontSize: 14, color: "#4b5563" }}>
              Help improve our community by reporting issues you see around you.
            </p>
            <small className="report-banner-breadcrumb" style={{ fontSize: 12, color: "#6b7280" }}>Home &gt; Report an Issue</small>
          </div>
        </div>

        {submitted && (
          <div
            className="report-success-banner"
            style={{
              padding: "14px 18px",
              borderRadius: 10,
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#047857",
              fontSize: 14,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span className="report-success-text">
              Thanks — your report has been submitted and our team will review it shortly.
            </span>
            <button
              className="report-success-dismiss"
              onClick={() => setSubmitted(false)}
              style={{ background: "none", border: "none", color: "#047857", cursor: "pointer", fontSize: 13 }}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="report-content-grid" style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 20, alignItems: "start" }}>
          {/* LEFT: form */}
          <form
            className="report-form"
            onSubmit={handleSubmit}
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <h2 className="report-form-title" style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#111827" }}>Issue Details</h2>

            {/* 1. Category */}
            <div className="category-field">
              <label className="category-label" style={labelStyle}>1. Select Category *</label>
              <div className="category-select-wrapper" style={{ position: "relative" }}>
                <selectedCategory.icon
                  className="category-select-icon"
                  size={16}
                  color={selectedCategory.color}
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
                />
                <select
                  className="category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 36, appearance: "none", cursor: "pointer" }}
                >
                  {CATEGORIES.map((c) => (
                    <option className="category-option" key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Description */}
            <div className="description-field">
              <label className="description-label" style={labelStyle}>2. Describe the Issue *</label>
              <textarea
                className="description-textarea"
                rows={5}
                maxLength={DESCRIPTION_LIMIT}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a clear description of the issue..."
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
              <p className="description-counter" style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af", textAlign: "right" }}>
                {description.length}/{DESCRIPTION_LIMIT}
              </p>
            </div>

            {/* 3. Location */}
            <div className="location-field">
              <label className="location-label" style={labelStyle}>3. Location *</label>
              <div className="location-buttons" style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <button
                  type="button"
                  className="use-current-location-button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "9px 12px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#047857",
                    backgroundColor: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: 8,
                    cursor: locating ? "default" : "pointer",
                  }}
                >
                  {locating ? <Loader2 className="spin location-loading-icon" size={14} /> : <Crosshair className="location-icon" size={14} />}
                  {locating ? "Locating..." : "Use Current Location"}
                </button>
                <button
                  type="button"
                  className="search-location-button"
                  onClick={() => setShowSearch((v) => !v)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "9px 12px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  <Search className="search-location-icon" size={14} />
                  Search Location
                </button>
              </div>

              {showSearch && (
                <form
                  className="location-search-form"
                  onSubmit={handleSearchSubmit}
                  style={{ display: "flex", gap: 8, marginBottom: 10 }}
                >
                  <input
                    className="location-search-input"
                    type="text"
                    autoFocus
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Type an address or place..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="location-search-submit"
                    disabled={searching}
                    style={{
                      padding: "0 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#fff",
                      backgroundColor: "#047857",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    {searching ? "..." : "Go"}
                  </button>
                </form>
              )}

              {locationError && (
                <p className="location-error" style={{ margin: "0 0 8px", fontSize: 12, color: "#dc2626" }}>{locationError}</p>
              )}

              <div
                className="location-summary"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                }}
              >
                <div className="location-summary-details" style={{ display: "flex", gap: 8 }}>
                  <MapPin className="location-summary-icon" size={16} color="#047857" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div className="location-summary-text">
                    <p className="location-summary-line1" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {location.line1}
                    </p>
                    {location.line2 && (
                      <p className="location-summary-line2" style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{location.line2}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="edit-location-button"
                  onClick={() => setShowSearch(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    color: "#3b82f6",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <SquarePen className="edit-location-icon" size={12} /> Edit Location
                </button>
              </div>
            </div>

            {/* 4. Photos */}
            <div className="photos-field">
              <label className="photos-label" style={labelStyle}>4. Upload Photos (Optional)</label>
              <div
                className="photo-dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                style={{
                  border: `1.5px dashed ${isDragging ? "#059669" : "#d1d5db"}`,
                  borderRadius: 10,
                  padding: "22px 16px",
                  textAlign: "center",
                  backgroundColor: isDragging ? "#ecfdf5" : "#f9fafb",
                  transition: "background-color 0.15s, border-color 0.15s",
                }}
              >
                <UploadCloud className="photo-dropzone-icon" size={30} color="#9ca3af" style={{ margin: "0 auto 8px" }} />
                <p className="photo-dropzone-text" style={{ margin: 0, fontSize: 13, color: "#374151" }}>
                  Drag and drop images here or{" "}
                  <button
                    type="button"
                    className="choose-files-button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      color: "#047857",
                      fontWeight: 600,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 13,
                      textDecoration: "underline",
                    }}
                  >
                    Choose Files
                  </button>
                </p>
                <p className="photo-dropzone-hint" style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>
                  JPG, PNG up to {MAX_FILE_SIZE_MB}MB each (Max {MAX_FILES} files)
                </p>
                <input
                  ref={fileInputRef}
                  className="photo-file-input"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                  style={{ display: "none" }}
                />
              </div>

              {fileError && (
                <p className="photo-error" style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626" }}>{fileError}</p>
              )}

              {files.length > 0 && (
                <div className="photo-file-list" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="photo-file-item"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        backgroundColor: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <span className="photo-file-name" style={{ display: "flex", alignItems: "center", gap: 6, color: "#374151", minWidth: 0 }}>
                        <Camera className="photo-file-icon" size={13} color="#9ca3af" />
                        <span className="photo-file-name-text" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.name}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="photo-file-remove-button"
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${f.name}`}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex" }}
                      >
                        <X className="photo-file-remove-icon" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Additional info */}
            <div className="additional-info-field">
              <label className="additional-info-label" style={labelStyle}>5. Additional Information (Optional)</label>
              <textarea
                className="additional-info-textarea"
                rows={4}
                maxLength={ADDITIONAL_INFO_LIMIT}
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Anything else that might help..."
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
              <p className="additional-info-counter" style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af", textAlign: "right" }}>
                {additionalInfo.length}/{ADDITIONAL_INFO_LIMIT}
              </p>
            </div>

            {formError && <p className="form-error" style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>{formError}</p>}

            <button
              type="submit"
              className="submit-report-button"
              disabled={submitting}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 0",
                backgroundColor: "#047857",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.8 : 1,
              }}
            >
              {submitting ? <Loader2 className="spin submit-loading-icon" size={16} /> : <Send className="submit-icon" size={16} />}
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </form>

          {/* RIGHT: map + tips */}
          <div className="report-sidebar" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              className="map-card"
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <h2 className="map-card-title" style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "#111827" }}>
                Location on Map
              </h2>
              <div className="map-container-wrapper" style={{ borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                <MapContainer
                  className="report-map"
                  center={position}
                  zoom={15}
                  scrollWheelZoom={false}
                  style={{ width: "100%", height: 260 }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={position} icon={pinIcon()} />
                  <ClickToSetLocation onSelect={handleMapClick} />
                </MapContainer>
              </div>
              <p className="map-tip" style={{ margin: "0 0 12px", fontSize: 11, color: "#9ca3af" }}>
                Tip: click anywhere on the map to fine-tune the pin.
              </p>

              <div
                className="map-location-summary"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                }}
              >
                <div className="map-location-summary-details" style={{ display: "flex", gap: 8 }}>
                  <MapPin className="map-location-summary-icon" size={16} color="#047857" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div className="map-location-summary-text">
                    <p className="map-location-summary-line1" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {location.line1}
                    </p>
                    {location.line2 && (
                      <p className="map-location-summary-line2" style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{location.line2}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="change-location-button"
                  onClick={() => setShowSearch(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    color: "#3b82f6",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Change Location <SquarePen className="change-location-icon" size={12} />
                </button>
              </div>
            </div>

            <div
              className="tips-card"
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <h3 className="tips-card-title" style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "#111827" }}>
                Before You Submit
              </h3>
              <div className="tips-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 16 }}>
                <TipCard
                  icon={SquarePen}
                  iconBg="#d1fae5"
                  iconColor="#059669"
                  title="Be Specific"
                  text="Provide clear details about the issue for faster resolution."
                />
                <TipCard
                  icon={Camera}
                  iconBg="#f3e8ff"
                  iconColor="#a855f7"
                  title="Add Photos"
                  text="Photos help our team understand the issue better."
                />
                <TipCard
                  icon={Locate}
                  iconBg="#dbeafe"
                  iconColor="#3b82f6"
                  title="Accurate Location"
                  text="Ensure the location pin is correct for accurate tracking."
                />
                <TipCard
                  icon={Bell}
                  iconBg="#fef3c7"
                  iconColor="#f59e0b"
                  title="Stay Updated"
                  text="You'll receive updates as the issue is reviewed."
                />
              </div>
              <div
                className="privacy-note"
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "10px 12px",
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: 8,
                }}
              >
                <ShieldCheck className="privacy-note-icon" size={16} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />
                <p className="privacy-note-text" style={{ margin: 0, fontSize: 12, color: "#047857", lineHeight: 1.4 }}>
                  All reports are reviewed by our team. Your information is secure and will only be
                  used for issue resolution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style className="report-issue-inline-styles">{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <Footer/>
    </div>
  );
}