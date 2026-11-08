import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function DropdownSelect({ value, onChange, options, style }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", minWidth: style?.minWidth || 160, ...style }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "8px 12px",
          fontSize: 13,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#fff",
          color: "#374151",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span>{selected?.label}</span>
        <ChevronDown size={14} color="#6B7280" />
      </button>
      {open && (
        <div role="listbox" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, padding: 4, border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", boxShadow: "0 10px 24px rgba(17, 24, 39, .12)" }}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{ width: "100%", padding: "8px 9px", border: "none", borderRadius: 7, background: option.value === value ? "#ecfdf5" : "#fff", color: option.value === value ? "#047857" : "#374151", fontSize: 13, fontWeight: option.value === value ? 700 : 500, cursor: "pointer", textAlign: "left" }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
