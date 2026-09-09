import React, { useState, useContext } from "react";
import { loginUser, registerUser } from "../services/api";
import { AuthContext } from "../context/AuthContext";

const Field = ({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}) => (
  <div className="space-y-1.5">
    <label
      className="text-[10px] font-bold uppercase tracking-[0.14em]"
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
      className="w-full text-sm rounded-xl px-4 py-3.5 outline-none transition-all"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--ink)",
        fontFamily: "'Inter', sans-serif",
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--saffron)";
        e.currentTarget.style.boxShadow =
          "0 0 0 3px rgba(224,123,57,0.08)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  </div>
);

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
          setToken(data.accessToken, email);
          onAuthSuccess();
        } else {
          setError(data.message || "Login failed.");
        }
      } else {
        const data = await registerUser(email, password);

        if (data.success) {
          setIsLogin(true);
          setEmail("");
          setPassword("");
          setConfirmPassword("");

          setError("__success__Account created! Please sign in.");
        } else {
          setError(data.message || "Registration failed.");
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = error.startsWith("__success__");

  const displayError = isSuccess
    ? error.replace("__success__", "")
    : error;

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5 py-10"
      style={{
        background: "var(--surface)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className="w-full max-w-5xl grid lg:grid-cols-[0.9fr_1.1fr] rounded-3xl overflow-hidden shadow-2xl">

        {/* LEFT PANEL */}

        <div
          className="hidden lg:flex relative overflow-hidden p-10 xl:p-12 flex-col justify-between min-h-[650px]"
          style={{
            background: "#1A0F00",
          }}
        >
          {/* Decorative geometry */}

          <div
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full"
            style={{
              border: "1px solid rgba(224,123,57,0.18)",
            }}
          />

          <div
            className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full"
            style={{
              border: "1px solid rgba(224,123,57,0.12)",
            }}
          />

          <div
            className="absolute top-1/2 left-1/2 w-72 h-72 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{
              border: "1px solid rgba(224,123,57,0.10)",
              boxShadow:
                "0 0 100px rgba(224,123,57,0.06)",
            }}
          />

          {/* Brand */}

          <div className="relative z-10">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[11px] font-black"
              style={{
                background: "var(--saffron)",
              }}
            >
              SC
            </div>
          </div>

          {/* Main copy */}

          <div className="relative z-10 animate-fade-up">
            <p
              className="text-[10px] uppercase tracking-[0.2em] font-bold mb-5"
              style={{
                color: "var(--saffron)",
              }}
            >
              AI welfare discovery
            </p>

            <h2
              className="text-4xl xl:text-5xl font-black leading-[1.08] text-white"
              style={{
                fontFamily:
                  "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Every citizen
              <br />
              deserves to know
              <br />
              <span
                style={{
                  color: "var(--saffron)",
                }}
              >
                what they're owed.
              </span>
            </h2>

            <p
              className="text-sm leading-7 mt-6 max-w-md"
              style={{
                color: "#A89080",
              }}
            >
              Thousands of government welfare schemes —
              scholarships, subsidies, loans and pensions —
              made easier to discover and understand.
            </p>

            <div className="flex items-center gap-8 mt-8">
              {[
                ["4,700+", "Schemes"],
                ["28+", "States covered"],
                ["AI", "Powered match"],
              ].map(([num, label]) => (
                <div key={label}>
                  <p
                    className="text-xl font-black text-white"
                    style={{
                      fontFamily:
                        "'JetBrains Mono', monospace",
                    }}
                  >
                    {num}
                  </p>

                  <p
                    className="text-[9px] uppercase tracking-wider mt-1"
                    style={{
                      color: "#7A6050",
                    }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}

          <div className="relative z-10 flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: "var(--green)",
                boxShadow:
                  "0 0 6px var(--green)",
              }}
            />

            <span
              className="text-[10px]"
              style={{
                color: "#7A6050",
              }}
            >
              Connected to MyScheme portal
            </span>
          </div>
        </div>

        {/* RIGHT PANEL */}

        <div
          className="flex items-center justify-center px-6 sm:px-10 py-10 sm:py-14"
          style={{
            background: "var(--panel)",
          }}
        >
          <div className="w-full max-w-md animate-fade-up">

            {/* Mobile logo */}

            <div className="lg:hidden flex items-center gap-2 mb-10">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-black"
                style={{
                  background: "var(--saffron)",
                }}
              >
                SC
              </div>

              <span
                className="text-sm font-black"
                style={{
                  fontFamily:
                    "'Plus Jakarta Sans', sans-serif",
                  color: "var(--ink)",
                }}
              >
                Scheme
                <span
                  style={{
                    color: "var(--saffron)",
                  }}
                >
                  Companion
                </span>
              </span>
            </div>

            {/* Heading */}

            <div className="mb-8">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
                style={{
                  color: "var(--saffron)",
                }}
              >
                {isLogin
                  ? "Welcome back"
                  : "Get started"}
              </p>

              <h1
                className="text-3xl font-black tracking-tight"
                style={{
                  fontFamily:
                    "'Plus Jakarta Sans', sans-serif",
                  color: "var(--ink)",
                }}
              >
                {isLogin
                  ? "Sign in to continue"
                  : "Create your account"}
              </h1>

              <p
                className="text-sm mt-2 leading-6"
                style={{
                  color: "var(--muted)",
                }}
              >
                {isLogin
                  ? "Access your bookmarks and personalized scheme discovery."
                  : "Save schemes and discover welfare benefits relevant to you."}
              </p>
            </div>

            {/* Message */}

            {error && (
              <div
                className="mb-5 px-4 py-3 rounded-xl text-sm animate-fade-up"
                style={{
                  background: isSuccess
                    ? "var(--green-lt)"
                    : "var(--red-lt)",
                  color: isSuccess
                    ? "var(--green)"
                    : "var(--red)",
                  border: `1px solid ${
                    isSuccess
                      ? "#C3E6D0"
                      : "#F5C6C2"
                  }`,
                }}
              >
                {displayError}
              </div>
            )}

            {/* Form */}

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <Field
                label="Email address"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="you@example.com"
                autoComplete="email"
              />

              <Field
                label="Password"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
                autoComplete={
                  isLogin
                    ? "current-password"
                    : "new-password"
                }
              />

              {!isLogin && (
                <Field
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                />
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                style={{
                  background:
                    "var(--saffron)",
                  fontFamily:
                    "'Plus Jakarta Sans', sans-serif",
                  boxShadow:
                    "0 8px 22px rgba(224,123,57,0.18)",
                }}
              >
                {loading
                  ? isLogin
                    ? "Signing in..."
                    : "Creating account..."
                  : isLogin
                  ? "Sign in →"
                  : "Create account →"}
              </button>
            </form>

            {/* Switch */}

            <div
              className="text-center mt-7 text-sm"
              style={{
                color: "var(--muted)",
              }}
            >
              {isLogin
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                onClick={switchMode}
                className="font-bold"
                style={{
                  color: "var(--saffron)",
                }}
              >
                {isLogin
                  ? "Sign up"
                  : "Sign in"}
              </button>
            </div>

            <div
              className="mt-8 pt-5 text-center"
              style={{
                borderTop:
                  "1px solid var(--border)",
              }}
            >
              <p
                className="text-[10px] leading-5"
                style={{
                  color: "var(--muted)",
                }}
              >
                Discover government benefits
                without digging through thousands
                of pages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

