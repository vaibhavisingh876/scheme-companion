import { useEffect, useState } from "react";
import { verifyEmail } from "../services/api";

const VerifyEmail = () => {
  const [status, setStatus] = useState("loading"); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    verifyEmail(token)
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully! You can now log in.");
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed.");
        }
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || "Verification failed. The link may be expired.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
      <div
        className="max-w-md w-full p-8 rounded-2xl text-center"
        style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
      >
        {status === "loading" && (
          <>
            <div className="w-8 h-8 rounded-full mb-4 mx-auto animate-spin"
              style={{ border: "2.5px solid var(--border)", borderTopColor: "var(--saffron)" }}
            />
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Verifying your email…</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-black mb-2" style={{ color: "var(--ink)" }}>Email Verified</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>{message}</p>
            <a href="/?page=auth"
              className="inline-block mt-6 px-6 py-2 rounded-xl text-sm font-bold"
              style={{ background: "var(--saffron)", color: "#fff" }}
            >
              Go to Login
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-black mb-2" style={{ color: "var(--red)" }}>Verification Failed</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>{message}</p>
            <a href="/?page=auth"
              className="inline-block mt-6 px-6 py-2 rounded-xl text-sm font-bold"
              style={{ background: "var(--saffron)", color: "#fff" }}
            >
              Back to Login
            </a>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;