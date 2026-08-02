import { useState } from "react";
import { forgotPassword } from "../services/api";

const ForgotPassword = ({ onBack }) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | sent
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setError("");
    try {
      const data = await forgotPassword(email);
      if (data.success) {
        setStatus("sent");
      } else {
        setError(data.message || "Something went wrong.");
        setStatus("idle");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Network error.");
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
      <div className="max-w-md w-full p-8 rounded-2xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <h2 className="text-2xl font-black mb-2" style={{ color: "var(--ink)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Forgot Password</h2>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Enter your email and we'll send a reset link.</p>
        {status === "sent" ? (
          <div className="text-center">
            <div className="text-4xl mb-4">📧</div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>If an account exists, a reset link has been sent.</p>
            <button onClick={onBack} className="mt-6 px-6 py-2 rounded-xl text-sm font-bold" style={{ background: "var(--saffron)", color: "#fff" }}>Back to Login</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl px-4 py-3 text-sm border"
              style={{ border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            />
            {error && <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ border: "1px solid var(--border)", color: "var(--ink)" }}>Cancel</button>
              <button type="submit" disabled={status === "loading"} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: status === "loading" ? "#C5A88A" : "var(--saffron)" }}>
                {status === "loading" ? "Sending…" : "Send link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;