import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        boxSizing: "border-box",
        padding: 24,
        background: "#f4faf7",
        color: "#16352d",
        textAlign: "center",
      }}
    >
      <section>
        <p style={{ margin: "0 0 8px", color: "#16866d", fontWeight: 700 }}>404 · Page not found</p>
        <h1 style={{ margin: "0 0 12px", fontSize: "clamp(2rem, 6vw, 3.5rem)" }}>We can’t find that page</h1>
        <p style={{ margin: "0 auto 24px", maxWidth: 480, lineHeight: 1.6 }}>
          The link may be incorrect, or the page may have moved.
        </p>
        <Link
          to="/"
          style={{
            display: "inline-block",
            padding: "11px 18px",
            borderRadius: 9,
            background: "#16866d",
            color: "#fff",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Return to TrackServ
        </Link>
      </section>
    </main>
  );
}
