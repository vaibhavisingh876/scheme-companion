import { useState, useContext } from "react";
import { loginUser, registerUser } from "../services/api";
import { AuthContext } from "../context/AuthContext";

const Field = ({ label, type, value, onChange, placeholder, autoComplete }) => (
  <div className="field">
    <div className="field__label">
      <label>{label}</label>
    </div>
    <div className="control">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
    </div>
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
    <div className="auth">
      {/* ASIDE */}
      <aside className="auth__aside">
        <div className="lattice" aria-hidden="true" />

        <div className="auth__brand">
          <span className="brand__mark">
            <img src="/logo.png" alt="" />
          </span>
          <span className="brand__word">
            Scheme<b style={{ color: "var(--amber)" }}>Companion</b>
          </span>
        </div>

        <div className="auth__statement">
          <span className="kicker">Welfare, made discoverable</span>
          <h2 className="display">
            Every citizen deserves to know <em>what they're owed.</em>
          </h2>
          <p>
            Scholarships, subsidies, loans and pensions — thousands of government
            schemes, narrowed down to the ones that are actually relevant to you.
          </p>
        </div>

        <div className="auth__foot">
          <i /> Sourced from official government listings
        </div>
      </aside>

      {/* PANEL */}
      <div className="auth__panel">
        <div className="auth__form">
          <div className="auth__mobile-brand">
            <span className="brand__mark">
              <img src="/logo.png" alt="" />
            </span>
            <span className="brand__word">
              Scheme<b>Companion</b>
            </span>
          </div>

          <div className="head">
            <span className="kicker">{isLogin ? "Welcome back" : "Get started"}</span>
            <h1 className="display">{isLogin ? "Sign in" : "Create your account"}</h1>
            <p>
              {isLogin
                ? "Access your saved schemes and personalized discovery."
                : "Save schemes and discover benefits relevant to you."}
            </p>
          </div>

          {error && (
            <div
              className={`alert ${isSuccess ? "alert--success" : "alert--error"}`}
              role={isSuccess ? "status" : "alert"}
            >
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth__fields">
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
              placeholder="Enter your password"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
            {!isLogin && (
              <Field
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
            )}

            <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={loading}>
              {loading
                ? isLogin
                  ? "Signing in…"
                  : "Creating account…"
                : isLogin
                ? "Sign in"
                : "Create account"}{" "}
              <span className="arw">→</span>
            </button>
          </form>

          <p className="auth__switch">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button type="button" onClick={switchMode}>
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
