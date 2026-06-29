import React, { useState, useContext } from "react";
import { loginUser, registerUser } from "../services/api";
import { AuthContext } from "../context/AuthContext";

/* ── Geometric SVG panel ─────────────────────────────────────────── */
const GeometricPanel = () => (
  <div
    className="hidden lg:flex relative flex-col justify-between p-12 overflow-hidden"
    style={{ background: "#1A0F00", minHeight: "100%" }}
  >
    <svg
      className="absolute inset-0 w-full h-full opacity-20 animate-spin-slow"
      viewBox="0 0 600 600"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 360) / 24;
        const rad = (angle * Math.PI) / 180;
        const x2 = 300 + 280 * Math.cos(rad);
        const y2 = 300 + 280 * Math.sin(rad);
        return (
          <line
            key={i}
            x1="300" y1="300"
            x2={x2} y2={y2}
            stroke="#E07B39"
            strokeWidth={i % 3 === 0 ? 1.5 : 0.5}
          />
        );
      })}
      <circle cx="300" cy="300" r="60" fill="none" stroke="#E07B39" strokeWidth="1.5" />
      <circle cx="300" cy="300" r="140" fill="none" stroke="#E07B39" strokeWidth="0.5" />
      <circle cx="300" cy="300" r="220" fill="none" stroke="#E07B39" strokeWidth="0.5" />
    </svg>

    <div
      className="absolute top-8 right-8 w-16 h-16 rounded-xl opacity-30"
      style={{ background: "var(--saffron)", transform: "rotate(15deg)" }}
    />
    <div
      className="absolute bottom-24 left-8 w-10 h-10 rounded-lg opacity-20"
      style={{ background: "var(--saffron)", transform: "rotate(-10deg)" }}
    />

    <div className="relative z-10">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black mb-10"
        style={{ background: "var(--saffron)" }}
      >
        SC
      </div>
    </div>

    <div className="relative z-10 space-y-6">
      <h2
        className="text-4xl font-black leading-tight text-white"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        Every citizen<br />
        deserves to know<br />
        <span style={{ color: "var(--saffron)" }}>what they're owed.</span>
      </h2>
      <p className="text-sm leading-relaxed" style={{ color: "#A89080" }}>
        Thousands of government welfare schemes — scholarships,
        subsidies, loans, pensions — matched to you in seconds.
      </p>
      <div className="flex items-center gap-6 pt-2">
        {[["3,700+", "Schemes"], ["28", "States covered"], ["AI", "Powered match"]].map(
          ([num, label]) => (
            <div key={label}>
              <p
                className="text-xl font-black text-white"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {num}
              </p>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "#7A6050" }}>
                {label}
              </p>
            </div>
          )
        )}
      </div>
    </div>

    <div className="relative z-10 flex items-center gap-2">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: "var(--green)", boxShadow: "0 0 6px var(--green)" }}
      />
      <span className="text-[11px]" style={{ color: "#7A6050" }}>
        Live · Connected to MyScheme portal
      </span>
    </div>
  </div>
);

/* ── Input field ─────────────────────────────────────────────────── */
const Field = ({ label, type, value, onChange, placeholder, autoComplete }) => (
  <div className="space-y-1.5">
    <label
      className="text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: "var(--muted)" }}
    >
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required
      className="w-full text-sm rounded-xl px-4 py-3 transition-all outline-none"
      style={{
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        color: "var(--ink)",
        fontFamily: "'Inter', sans-serif",
      }}
      onFocus={(e) => (e.target.style.borderColor = "var(--saffron)")}
      onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
    />
  </div>
);

/* ── Main component ──────────────────────────────────────────────── */
const AuthPage = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setToken } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isLogin && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const data = await loginUser(email, password);
        if (data.success) {
          localStorage.setItem("userEmail", email);
          setToken(data.token);
          onAuthSuccess();
        }
      } else {
        const data = await registerUser(email, password);
        if (data.success) {
          setIsLogin(true);
          setEmail("");
          setPassword("");
          setConfirmPassword("");
          setError("__success__Account created! Please sign in.");
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = error.startsWith("__success__");
  const displayError = isSuccess ? error.replace("__success__", "") : error;

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen flex items-stretch" style={{ background: "var(--surface)" }}>
      {/* Left panel */}
      <div className="lg:w-1/2 xl:w-2/5">
        <GeometricPanel />
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md animate-fade-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black"
              style={{ background: "var(--saffron)" }}
            >
              SC
            </div>
            <span
              className="text-sm font-black"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
            >
              Scheme<span style={{ color: "var(--saffron)" }}>Companion</span>
            </span>
          </div>

          <div className="mb-8">
            <h1
              className="text-3xl font-black tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
            >
              {isLogin ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "var(--muted)" }}>
              {isLogin
                ? "Sign in to access your bookmarks and scheme matches."
                : "Join to find welfare schemes tailored to your profile."}
            </p>
          </div>

          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
              style={{
                background: isSuccess ? "var(--green-lt)" : "var(--red-lt)",
                color: isSuccess ? "var(--green)" : "var(--red)",
                border: `1px solid ${isSuccess ? "#C3E6D0" : "#F5C6C2"}`,
              }}
            >
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
            {!isLogin && (
              <Field
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all mt-2"
              style={{
                background: loading ? "#C5A88A" : "var(--saffron)",
                color: "#fff",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => { if (!loading) e.target.style.background = "var(--saffron-dk)"; }}
              onMouseLeave={(e) => { if (!loading) e.target.style.background = "var(--saffron)"; }}
            >
              {loading
                ? (isLogin ? "Signing in…" : "Creating account…")
                : (isLogin ? "Sign in" : "Create account")}
            </button>
          </form>

          <p className="text-sm text-center mt-6" style={{ color: "var(--muted)" }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={switchMode}
              className="font-semibold underline underline-offset-2"
              style={{ color: "var(--saffron)" }}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>

          <p className="text-[11px] text-center mt-8" style={{ color: "#BBAE9F" }}>
            By signing in you agree to use this service to discover public welfare schemes only.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;