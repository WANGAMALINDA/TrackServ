import { useState, useRef, useCallback, useEffect } from "react";
import Footer from "../Components/footer";
import { supabase } from "../Components/supabaseClient";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Camera,
  Send,
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
  CheckCircle2,
  Star,
} from "lucide-react";

const CATEGORIES = [
  { value: "roads", label: "Roads & Infrastructure", icon: TriangleAlert, color: "#f59e0b" },
  { value: "water", label: "Water Leak", icon: Droplet, color: "#3b82f6" },
  { value: "electricity", label: "Electricity", icon: Zap, color: "#eab308" },
  { value: "garbage", label: "Garbage", icon: Trash2, color: "#059669" },
  { value: "other", label: "Other", icon: MoreHorizontal, color: "#059669" },
];

const DEFAULT_POSITION = [-25.7461, 28.1881];
const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 5;
const DESCRIPTION_LIMIT = 500;
const ADDITIONAL_INFO_LIMIT = 300;

const TSHWANE_BBOX = { minLat: -26.2, maxLat: -25.2, minLng: 27.8, maxLng: 28.5 };

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
    iconSize: [20, 20],
    iconAnchor: [15, 28],
  });
}

function MapResizeHandler({ width }) {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(id);
  }, [width, map]);
  return null;
}

function ClickToSetLocation({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

async function reverseGeocode(lat, lng) {
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

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygonCoords(point, polygonCoords) {
  if (!polygonCoords?.length) return false;
  if (!pointInRing(point, polygonCoords[0])) return false;
  for (let i = 1; i < polygonCoords.length; i++) {
    if (pointInRing(point, polygonCoords[i])) return false;
  }
  return true;
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return pointInPolygonCoords(point, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((poly) => pointInPolygonCoords(point, poly));
  }
  return false;
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
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const narrow1024 = width < 1024;
  const narrow640 = width < 640;

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
  const [locationOutsideTshwane, setLocationOutsideTshwane] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [showFirstReportFeedback, setShowFirstReportFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackUserId, setFeedbackUserId] = useState("");
  const [feedbackReportId, setFeedbackReportId] = useState("");

  const [tshwaneGeometry, setTshwaneGeometry] = useState(null);
  const [boundaryLoadError, setBoundaryLoadError] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const selectedCategory = CATEGORIES.find((c) => c.value === category) || CATEGORIES[0];

  useEffect(() => {
    let cancelled = false;
    async function loadTshwaneBoundary() {
      try {
        const url =
          "https://nominatim.openstreetmap.org/search?q=City+of+Tshwane+Metropolitan+Municipality&polygon_geojson=1&format=json&limit=1";
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("Boundary fetch failed");
        const data = await res.json();
        if (!cancelled && data[0]?.geojson) {
          setTshwaneGeometry(data[0].geojson);
        } else if (!cancelled) {
          setBoundaryLoadError(true);
        }
      } catch {
        if (!cancelled) setBoundaryLoadError(true);
      }
    }
    loadTshwaneBoundary();
    return () => {
      cancelled = true;
    };
  }, []);

  const isInsideTshwane = (lat, lng) => {
    if (tshwaneGeometry) {
      return pointInGeometry([lng, lat], tshwaneGeometry);
    }
    const { minLat, maxLat, minLng, maxLng } = TSHWANE_BBOX;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  };

  const applyResolvedLocation = (lat, lng, line1, line2) => {
    setPosition([lat, lng]);
    setLocation({ line1, line2 });
    setLocationOutsideTshwane(!isInsideTshwane(lat, lng));
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
    e?.preventDefault();
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
    setLocationOutsideTshwane(!isInsideTshwane(lat, lng));
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

  const closeFirstReportFeedback = () => {
    if (savingFeedback) return;
    setSubmitted(true);
    setShowFirstReportFeedback(false);
    setFeedbackError("");
    setFeedbackRating(0);
    setFeedbackComment("");
    setFeedbackUserId("");
    setFeedbackReportId("");
  };

  const submitFirstReportFeedback = async () => {
    if (!feedbackUserId) {
      setFeedbackError("Could not identify your account for saving feedback.");
      return;
    }
    if (feedbackRating < 1 || feedbackRating > 5) {
      setFeedbackError("Please choose a rating before submitting.");
      return;
    }

    setFeedbackError("");
    setSavingFeedback(true);

    const payload = {
      first_report_feedback_rating: feedbackRating,
      first_report_feedback_comment: feedbackComment.trim() || null,
      first_report_feedback_submitted_at: new Date().toISOString(),
      first_report_feedback_prompted_once: true,
      first_report_feedback_prompted_at: new Date().toISOString(),
      first_report_feedback_report_id: feedbackReportId || null,
    };

    const { error } = await supabase.from("profiles").update(payload).eq("id", feedbackUserId);

    setSavingFeedback(false);

    if (error) {
      setFeedbackError(`Could not save feedback: ${error.message}`);
      return;
    }

    closeFirstReportFeedback();
    setSubmitted(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setFormError("Please describe the issue before submitting.");
      return;
    }
    if (locationOutsideTshwane) {
      setFormError(
        "This location is outside the Tshwane Municipality. Reports are only accepted for locations within Tshwane."
      );
      return;
    }
    setFormError("");
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFormError("You need to be logged in to submit a report.");
      setSubmitting(false);
      return;
    }

    const { data: categoryRow, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("category_name", selectedCategory.label)
      .maybeSingle();

    if (categoryError) {
      setFormError(categoryError.message);
      setSubmitting(false);
      return;
    }

    if (!categoryRow) {
      setFormError(`Category "${selectedCategory.label}" isn't set up yet — contact support.`);
      setSubmitting(false);
      return;
    }

    const { data: reportRow, error: reportError } = await supabase
      .from("reports")
      .insert({
        user_id: user.id,
        category_id: categoryRow.id,
        description: description.trim(),
        location: [location.line1, location.line2].filter(Boolean).join(", "),
        latitude: position[0],
        longitude: position[1],
        additional_information: additionalInfo.trim() || null,
      })
      .select("id")
      .single();

    if (reportError) {
      setFormError(reportError.message);
      setSubmitting(false);
      return;
    }

    if (files.length) {
      const uploads = await Promise.allSettled(
        files.map(async (file, index) => {
          const ext = file.name.split(".").pop();
          const path = `${reportRow.id}/${index}-${Date.now()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("images")
            .upload(path, file);
          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from("images")
            .getPublicUrl(path);

          const { error: imageRowError } = await supabase
            .from("report_images")
            .insert({ report_id: reportRow.id, image_url: publicUrlData.publicUrl });
          if (imageRowError) throw imageRowError;
        })
      );

      const failed = uploads.filter((r) => r.status === "rejected");
      if (failed.length) {
        const reasons = [...new Set(failed.map((r) => r.reason?.message || "Unknown error"))].join("; ");
        setFormError(
          `Report submitted, but ${failed.length} photo${failed.length === 1 ? "" : "s"} failed to upload (${reasons}).`
        );
      }
    }

    let isFirstReport = false;
    const { count, error: countError } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      setFormError(
        `Report submitted, but we couldn't check first-report feedback eligibility (${countError.message}).`
      );
    } else {
      isFirstReport = count === 1;
    }

    if (isFirstReport) {
      const promptedPayload = {
        first_report_feedback_prompted_once: true,
        first_report_feedback_prompted_at: new Date().toISOString(),
        first_report_feedback_report_id: reportRow.id,
      };
      const { error: promptError } = await supabase
        .from("profiles")
        .update(promptedPayload)
        .eq("id", user.id);
      if (promptError) {
        setFormError(
          `Report submitted, but feedback prompt state couldn't be saved (${promptError.message}).`
        );
      }
    }

    setSubmitting(false);
    setSubmitted(!isFirstReport);
    setShowFirstReportFeedback(isFirstReport);
    setFeedbackUserId(isFirstReport ? user.id : "");
    setFeedbackReportId(isFirstReport ? reportRow.id : "");
    setFeedbackError("");
    setFeedbackRating(0);
    setFeedbackComment("");
    setDescription("");
    setAdditionalInfo("");
    setFiles([]);
    setCategory(CATEGORIES[0].value);
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

  const submitDisabled = submitting || locationOutsideTshwane;

  return (
    <div className="report-issue-page" style={{ backgroundColor: "#f3f4f6", minHeight: "100vh", padding: 20 }}>
      <div className="report-issue-shell" style={{ maxWidth: 1300, margin: "0 10", display: "flex", flexDirection: "column", gap: 20 }}>
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
            className="report-success-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-success-title"
            onClick={() => setSubmitted(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1200,
              backgroundColor: "rgba(17, 24, 39, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              className="report-success-popup"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 380,
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: "32px 28px 24px",
                textAlign: "center",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
                animation: "reportSuccessPop 0.25s ease-out",
              }}
            >
              <div
                className="report-success-icon"
                style={{
                  width: 56,
                  height: 56,
                  margin: "0 auto 16px",
                  borderRadius: "50%",
                  backgroundColor: "#ecfdf5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 size={30} color="#047857" />
              </div>
              <h2
                id="report-success-title"
                className="report-success-title"
                style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}
              >
                Report Submitted
              </h2>
              <p
                className="report-success-text"
                style={{ margin: "0 0 20px", fontSize: 13.5, color: "#6b7280", lineHeight: 1.5 }}
              >
                Thanks — your report has been submitted and our team will review it shortly.
              </p>
              <button
                type="button"
                className="report-success-dismiss"
                onClick={() => setSubmitted(false)}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  border: "none",
                  borderRadius: 8,
                  backgroundColor: "#047857",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Got It
              </button>
            </div>
          </div>
        )}

        {showFirstReportFeedback && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-report-feedback-title"
            onClick={closeFirstReportFeedback}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1300,
              backgroundColor: "rgba(17, 24, 39, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 520,
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: "22px 20px 18px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <h2 id="first-report-feedback-title" style={{ margin: 0, fontSize: 26, color: "#111827", fontWeight: 800 }}>
                    Thank you for your first report!
                  </h2>
                  <p style={{ margin: "8px 0 0", fontSize: 14, color: "#4b5563" }}>
                    Your issue has been logged. Please share quick feedback about your reporting experience.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeFirstReportFeedback}
                  disabled={savingFeedback}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#6b7280",
                    cursor: savingFeedback ? "not-allowed" : "pointer",
                    padding: 0,
                  }}
                  aria-label="Close feedback"
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#166534", fontWeight: 600 }}>
                  Report ID: #{String(feedbackReportId || "").slice(0, 8).toUpperCase() || "N/A"}
                </p>
              </div>

              <div style={{ marginTop: 16 }}>
                <p style={{ margin: "0 0 8px", fontSize: 14, color: "#111827", fontWeight: 700 }}>Rating</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFeedbackRating(value)}
                      disabled={savingFeedback}
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: savingFeedback ? "not-allowed" : "pointer",
                        color: value <= feedbackRating ? "#f59e0b" : "#d1d5db",
                      }}
                      aria-label={`Set rating to ${value}`}
                    >
                      <Star size={24} fill={value <= feedbackRating ? "#f59e0b" : "none"} />
                    </button>
                  ))}
                  <span style={{ marginLeft: 8, fontSize: 13, color: "#374151", fontWeight: 600 }}>
                    {feedbackRating ? `${feedbackRating}/5` : "Select rating"}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <p style={{ margin: "0 0 8px", fontSize: 14, color: "#111827", fontWeight: 700 }}>Feedback Comment (optional)</p>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  rows={4}
                  maxLength={500}
                  disabled={savingFeedback}
                  placeholder="Tell us about your experience using the report form."
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    resize: "vertical",
                    fontFamily: "inherit",
                    color: "#111827",
                  }}
                />
              </div>

              {feedbackError && (
                <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#b91c1c" }}>
                  {feedbackError}
                </p>
              )}

              <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={closeFirstReportFeedback}
                  disabled={savingFeedback}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    color: "#374151",
                    fontWeight: 600,
                    cursor: savingFeedback ? "not-allowed" : "pointer",
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={submitFirstReportFeedback}
                  disabled={savingFeedback}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    border: "none",
                    backgroundColor: "#047857",
                    borderRadius: 10,
                    color: "#fff",
                    fontWeight: 700,
                    cursor: savingFeedback ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {savingFeedback ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
                  Submit Feedback
                </button>
              </div>
            </div>
          </div>
        )}

        {showSearch && narrow1024 && (
          <div
            className="mobile-location-picker-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-location-picker-title"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1100,
              backgroundColor: "rgba(17, 24, 39, 0.55)",
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div
              className="mobile-location-picker"
              style={{
                width: "100%",
                backgroundColor: "#fff",
                borderRadius: "16px 16px 0 0",
                padding: 16,
                boxShadow: "0 -12px 30px rgba(0, 0, 0, 0.18)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div>
                  <h2 id="mobile-location-picker-title" style={{ margin: 0, fontSize: 17, color: "#111827" }}>
                    Edit Location
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
                    Tap the map to move the pin.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close location picker"
                  onClick={() => setShowSearch(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    padding: 0,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    backgroundColor: "#fff",
                    color: "#6b7280",
                    cursor: "pointer",
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ overflow: "hidden", borderRadius: 10, border: "1px solid #e5e7eb" }}>
                <MapContainer
                  className="mobile-location-picker-map"
                  center={position}
                  zoom={15}
                  scrollWheelZoom
                  style={{ width: "100%", height: 320 }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={position} icon={pinIcon(locationOutsideTshwane ? "#dc2626" : "#047857")} />
                  <ClickToSetLocation onSelect={handleMapClick} />
                  <MapResizeHandler width={width} />
                </MapContainer>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12 }}>
                <MapPin size={16} color={locationOutsideTshwane ? "#dc2626" : "#047857"} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{location.line1}</p>
                  {location.line2 && <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{location.line2}</p>}
                </div>
              </div>

              {locationOutsideTshwane && (
                <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "#b91c1c" }}>
                  This location is outside the Tshwane Municipality.
                </p>
              )}

              <button
                type="button"
                onClick={() => setShowSearch(false)}
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: "11px 14px",
                  border: "none",
                  borderRadius: 8,
                  backgroundColor: "#047857",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Use This Location
              </button>
            </div>
          </div>
        )}

        <div className="report-content-grid" style={{ display: "grid", gridTemplateColumns: narrow1024 ? "1fr" : "1.15fr 1fr", gap: 20, alignItems: "start" }}>
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
              </div>

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
                  backgroundColor: locationOutsideTshwane ? "#fef2f2" : "#f9fafb",
                  border: locationOutsideTshwane ? "1px solid #fca5a5" : "1px solid #e5e7eb",
                  borderRadius: 8,
                }}
              >
                {locationOutsideTshwane && (
                  <div className="location-outside-warning" style={{ width: "100%", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <TriangleAlert size={13} color="#b91c1c" />
                    <p className="location-outside-warning-text" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                      Warning: this location is outside the Tshwane Municipality.
                    </p>
                  </div>
                )}

                <div className="location-summary-details" style={{ display: "flex", gap: 8 }}>
                  <MapPin
                    className="location-summary-icon"
                    size={16}
                    color={locationOutsideTshwane ? "#dc2626" : "#047857"}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
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

              {boundaryLoadError && !tshwaneGeometry && (
                <p className="boundary-fallback-note" style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>
                  Using an approximate boundary check — the precise municipal boundary couldn't be loaded.
                </p>
              )}
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
                  Drag and drop images here, or choose an option below
                </p>
                <div
                  className="photo-dropzone-actions"
                  style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}
                >
                  <button
                    type="button"
                    className="choose-files-button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "#047857",
                      fontWeight: 600,
                      background: "#fff",
                      border: "1px solid #a7f3d0",
                      borderRadius: 8,
                      cursor: "pointer",
                      padding: "7px 14px",
                      fontSize: 13,
                    }}
                  >
                    <UploadCloud size={14} />
                    Choose from Gallery
                  </button>
                  <button
                    type="button"
                    className="take-photo-button"
                    onClick={() => cameraInputRef.current?.click()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "#047857",
                      fontWeight: 600,
                      background: "#fff",
                      border: "1px solid #a7f3d0",
                      borderRadius: 8,
                      cursor: "pointer",
                      padding: "7px 14px",
                      fontSize: 13,
                    }}
                  >
                    <Camera size={14} />
                    Take Photo
                  </button>
                </div>
                <p className="photo-dropzone-hint" style={{ margin: "10px 0 0", fontSize: 11, color: "#9ca3af" }}>
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
                <input
                  ref={cameraInputRef}
                  className="photo-camera-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </div>

              {fileError && (
                <p className="photo-error" style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626" }}>{fileError}</p>
              )}

              {files.length > 0 && (
                <div className="photo-file-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10, marginTop: 12 }}>
                  {files.map((f, i) => {
                    const previewUrl = URL.createObjectURL(f);
                    return (
                      <div
                        key={`${f.name}-${i}`}
                        className="photo-preview-item"
                        style={{
                          position: "relative",
                          aspectRatio: "1",
                          borderRadius: 8,
                          overflow: "hidden",
                          border: "1px solid #e5e7eb",
                          backgroundColor: "#f9fafb",
                        }}
                      >
                        <img
                          src={previewUrl}
                          alt={f.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onLoad={() => URL.revokeObjectURL(previewUrl)}
                        />
                        <button
                          type="button"
                          className="photo-file-remove-button"
                          onClick={() => removeFile(i)}
                          aria-label={`Remove ${f.name}`}
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            background: "rgba(0, 0, 0, 0.6)",
                            border: "none",
                            borderRadius: "50%",
                            width: 20,
                            height: 20,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            color: "#fff",
                          }}
                        >
                          <X className="photo-file-remove-icon" size={12} />
                        </button>
                      </div>
                    );
                  })}
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
              disabled={submitDisabled}
              title={locationOutsideTshwane ? "This location is outside the Tshwane Municipality." : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 0",
                backgroundColor: locationOutsideTshwane ? "#9ca3af" : "#047857",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: submitDisabled ? "not-allowed" : "pointer",
                opacity: submitting ? 0.8 : 1,
              }}
            >
              {submitting ? <Loader2 className="spin submit-loading-icon" size={16} /> : <Send className="submit-icon" size={16} />}
              {submitting
                ? "Submitting..."
                : locationOutsideTshwane
                ? "Location outside Tshwane"
                : "Submit Report"}
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
              <div
                className="map-container-wrapper"
                style={{
                  borderRadius: 10,
                  overflow: "hidden",
                  marginBottom: 12,
                  position: "relative",
                  zIndex: 0,
                  isolation: "isolate",
                }}
              >
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
                  <Marker position={position} icon={pinIcon(locationOutsideTshwane ? "#dc2626" : "#047857")} />
                  <ClickToSetLocation onSelect={handleMapClick} />
                  <MapResizeHandler width={width} />
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
                  backgroundColor: locationOutsideTshwane ? "#fef2f2" : "#f9fafb",
                  border: locationOutsideTshwane ? "1px solid #fca5a5" : "1px solid #e5e7eb",
                  borderRadius: 8,
                }}
              >
                {locationOutsideTshwane && (
                  <div className="map-location-outside-warning" style={{ width: "100%", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <TriangleAlert size={13} color="#b91c1c" />
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                      Outside Tshwane Municipality
                    </p>
                  </div>
                )}
                <div className="map-location-summary-details" style={{ display: "flex", gap: 8 }}>
                  <MapPin
                    className="map-location-summary-icon"
                    size={16}
                    color={locationOutsideTshwane ? "#dc2626" : "#047857"}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
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
              <div className="tips-grid" style={{ display: "grid", gridTemplateColumns: narrow640 ? "1fr" : "1fr 1fr", gap: 18, marginBottom: 16 }}>
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
                  text="Ensure the location pin is correct and within Tshwane for accurate tracking."
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
        @keyframes reportSuccessPop {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .map-container-wrapper .leaflet-container { z-index: 0; }
        .map-container-wrapper .leaflet-pane,
        .map-container-wrapper .leaflet-top,
        .map-container-wrapper .leaflet-bottom,
        .map-container-wrapper .leaflet-control { z-index: 1; }
      `}</style>
      <Footer />
    </div>
  );
}