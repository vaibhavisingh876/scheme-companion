import React from "react";

const ProfileCard = ({ profile }) => {
  if (!profile) return null;

  const cap = (str) => {
    if (!str || str === "unknown") return null;
    return String(str).charAt(0).toUpperCase() + String(str).slice(1);
  };

  const fields = [
    { label: "Age",        value: profile.age ?? null,         icon: "👤" },
    { label: "Gender",     value: cap(profile.gender),          icon: "⚧"  },
    { label: "Occupation", value: cap(profile.occupation),      icon: "💼" },
    { label: "State",      value: cap(profile.state),           icon: "📍" },
    {
      label: "Income",
      value: profile.income
        ? `₹${Number(profile.income).toLocaleString("en-IN")}`
        : null,
      icon: "₹",
    },
    { label: "Education",  value: cap(profile.educationLevel),  icon: "🎓" },
    { label: "Category",   value: cap(profile.casteCategory),   icon: "🏷"  },
  ].filter((f) => f.value && f.value !== "Unknown");

  if (fields.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-5 mb-2 animate-fade-up"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--saffron)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: "var(--saffron)", boxShadow: "0 0 6px var(--saffron)" }}
        />
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Profile detected
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {fields.map(({ label, value, icon }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "var(--saffron-lt)",
              border: "1px solid #F5D4B8",
              color: "var(--saffron-dk)",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <span className="text-[11px]">{icon}</span>
            <span
              className="font-semibold"
              style={{
                color: "var(--muted)",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {label}
            </span>
            {/* FIX: was hardcoded #1A0F00 (near-black) — invisible in dark mode */}
            <span style={{ color: "var(--ink)" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileCard;