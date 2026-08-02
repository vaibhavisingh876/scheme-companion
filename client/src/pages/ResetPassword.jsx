import { useState } from "react";
import { resetPassword } from "../services/api";

const ResetPassword = ({ onBack }) => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setStatus("error");
      setMessage("Missing reset token.");
      return;
    }
    if (newPassword !== confirm) {
      setStatus("error");
      setMessage("Passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    setStatus("loading");
    try {
      const data = await resetPassword(token, newPassword);
      if (data.success) {
        setStatus("success");
        setMessage(data.message || "Password reset successful. You can now log in.");
      } else {
        setStatus("error");
        setMessage(data.message || "Reset failed.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "Reset failed. The link may be expired.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
      <div className="max-w-md w-full p-8 rounded-2xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <h2 className="text-2xl font-black mb-2" style={{ color: "var(--ink)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Reset Password</h2>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Enter your new password.</p>
        {status === "success" ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>{message}</p>
            <a href="/?page=auth" className="inline-block px-6 py-2 rounded-xl text-sm font-bold" style={{ background: "var(--saffron)", color: "#fff" }}>Go to Login</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!token && <p className="text-xs" style={{ color: "var(--red)" }}>Missing reset token. Use the link from your email.</p>}
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-3 text-sm border"
              style={{ border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-3 text-sm border"
              style={{ border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            />
            {message && <p className="text-xs" style={{ color: status === "error" ? "var(--red)" : "var(--green)" }}>{message}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ border: "1px solid var(--border)", color: "var(--ink)" }}>Cancel</button>
              <button type="submit" disabled={status === "loading"} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: status === "loading" ? "#C5A88A" : "var(--saffron)" }}>
                {status === "loading" ? "Resetting…" : "Reset Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;