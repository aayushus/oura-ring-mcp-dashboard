import React, { useState } from "react";

interface AuthScreenProps {
  isFirstRun: boolean;
  signupsEnabled: boolean;
  onSuccess: (user: any) => void;
}

export function AuthScreen({ isFirstRun, signupsEnabled, onSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(!isFirstRun);
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Account Creation, Step 2: Oura Credentials
  const [createdUser, setCreatedUser] = useState<any>(null);

  // Step 1 Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 Form fields
  const [ouraToken, setOuraToken] = useState("");
  const [connectingOauth, setConnectingOauth] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = isLogin ? "/api/auth/login" : "/api/auth/signup";
    const body = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch"
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      if (isLogin) {
        // Login directly enters dashboard
        onSuccess(data.user);
      } else {
        // Signup transitions to Step 2 to configure Oura credentials
        setCreatedUser(data.user);
        setStep(2);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2TokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ouraToken.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/auth/oura/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch"
        },
        body: JSON.stringify({ token: ouraToken.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to link Oura Personal Access Token");
      }

      setSuccessMsg("Oura token verified and linked successfully!");
      setTimeout(() => {
        onSuccess(createdUser);
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Invalid Oura Access Token. Please check your token.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2OAuth = async () => {
    try {
      setError(null);
      setConnectingOauth(true);
      const res = await fetch("/api/auth/oura/connect");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Oura OAuth is not configured on this instance.");
      }

      const width = 600, height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      window.open(json.url, "Connect Oura", `width=${width},height=${height},left=${left},top=${top}`);

      const listener = (event: MessageEvent) => {
        if (event.data?.type === "oura_connected") {
          setSuccessMsg("Oura Ring connected via OAuth!");
          window.removeEventListener("message", listener);
          setTimeout(() => {
            onSuccess(createdUser);
          }, 1000);
        }
      };
      window.addEventListener("message", listener);
    } catch (err: any) {
      setError(err.message || "Failed to start OAuth flow");
    } finally {
      setConnectingOauth(false);
    }
  };

  return (
    <div className="auth-container">
      <style>{`
        .auth-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-app);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", -apple-system, sans-serif;
          color: var(--text-default);
          padding: 24px;
          box-sizing: border-box;
        }
        .auth-card {
          width: 100%;
          max-width: ${isFirstRun || step === 2 ? "480px" : "440px"};
          background: var(--bg-card);
          backdrop-filter: blur(24px);
          border: 1px solid var(--divider);
          border-radius: 24px;
          padding: 36px;
          box-shadow: var(--shadow-float, 0 24px 48px rgba(0,0,0,0.2));
        }
        .auth-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .step-progress {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 18px;
        }
        .step-pill {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 100px;
          background: var(--bg-hover);
          color: var(--text-3);
          border: 1px solid var(--divider);
        }
        .step-pill.active {
          background: var(--accent-bg, rgba(181, 95, 230, 0.15));
          color: var(--accent, #b55fe6);
          border-color: var(--accent, #b55fe6);
        }
        .auth-title {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.5px;
          text-align: center;
          margin: 0 0 8px 0;
          color: var(--text-default);
        }
        .auth-subtitle {
          font-size: 13.5px;
          line-height: 1.5;
          color: var(--text-2);
          text-align: center;
          margin: 0 0 22px 0;
        }
        .wizard-callout {
          background: var(--bg-hover);
          border: 1px solid var(--divider);
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .wizard-feature {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12.5px;
          color: var(--text-2);
        }
        .wizard-feature-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 6px;
          background: var(--accent-bg, rgba(181, 95, 230, 0.15));
          color: var(--accent, #b55fe6);
          font-size: 11px;
          flex-shrink: 0;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .auth-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .auth-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-2);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .auth-input {
          background: var(--bg-hover);
          border: 1px solid var(--divider);
          border-radius: 12px;
          padding: 12px 14px;
          color: var(--text-default);
          font-size: 14px;
          transition: all 0.2s ease;
          outline: none;
        }
        .auth-input:focus {
          border-color: var(--accent, #b55fe6);
          box-shadow: 0 0 12px var(--accent-bg, rgba(181, 95, 230, 0.2));
          background: var(--bg-hover-2);
        }
        .auth-error {
          background: rgba(235, 87, 87, 0.1);
          border: 1px solid rgba(235, 87, 87, 0.25);
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 13px;
          color: #eb5757;
          line-height: 1.4;
        }
        .auth-success {
          background: rgba(46, 204, 113, 0.1);
          border: 1px solid rgba(46, 204, 113, 0.25);
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 13px;
          color: #2ecc71;
          line-height: 1.4;
          text-align: center;
        }
        .auth-btn {
          background: var(--accent, #3B6FE0);
          border: none;
          color: #ffffff;
          font-size: 14.5px;
          font-weight: 600;
          border-radius: 12px;
          padding: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .auth-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
        }
        .auth-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .auth-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .auth-btn-secondary {
          background: var(--bg-hover);
          border: 1px solid var(--divider);
          color: var(--text-default);
          font-size: 13.5px;
          font-weight: 500;
          border-radius: 12px;
          padding: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
        }
        .auth-btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.09);
        }
        .auth-link {
          color: #b55fe6;
          text-decoration: none;
          font-size: 11px;
          font-weight: 500;
          text-transform: none;
          letter-spacing: 0;
        }
        .auth-link:hover {
          text-decoration: underline;
        }
        .auth-switch {
          margin-top: 20px;
          text-align: center;
          font-size: 13.5px;
          color: rgba(235, 240, 248, 0.5);
        }
        .auth-switch-link {
          color: #b55fe6;
          font-weight: 600;
          cursor: pointer;
          margin-left: 6px;
          text-decoration: none;
        }
        .auth-switch-link:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="auth-card">
        <div className="auth-logo">
          <img src="/dashboard/favicon.svg" alt="Oura Ring MCP Logo" style={{ width: "32px", height: "32px" }} />
          <span style={{ fontSize: "19px", fontWeight: 700, letterSpacing: "-0.5px" }}>Oura MCP Server</span>
        </div>

        {/* Step Indicator */}
        {(!isLogin || isFirstRun) && (
          <div className="step-progress">
            <span className={`step-pill ${step === 1 ? "active" : ""}`}>
              Step 1: Account
            </span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>→</span>
            <span className={`step-pill ${step === 2 ? "active" : ""}`}>
              Step 2: Oura Link
            </span>
          </div>
        )}

        {/* STEP 1: Account Setup / Sign In */}
        {step === 1 && (
          <>
            <h1 className="auth-title">
              {isFirstRun
                ? "Create Administrator Account"
                : isLogin
                ? "Sign in to Dashboard"
                : "Create your account"}
            </h1>
            <p className="auth-subtitle">
              {isFirstRun
                ? "Set up your master administrator profile to secure this instance."
                : isLogin
                ? "Enter your credentials to access your biometric health dashboard."
                : "Create your profile to start tracking your health metrics."}
            </p>

            {isFirstRun && (
              <div className="wizard-callout">
                <div className="wizard-feature">
                  <span className="wizard-feature-icon">🛡️</span>
                  <span><strong>Admin Privileges</strong> — Manage server configuration, users & keys</span>
                </div>
                <div className="wizard-feature">
                  <span className="wizard-feature-icon">📊</span>
                  <span><strong>Per-User Data Scoping</strong> — Personal health metrics isolated strictly to your account</span>
                </div>
              </div>
            )}

            <form className="auth-form" onSubmit={handleStep1Submit}>
              {error && <div className="auth-error">{error}</div>}

              {!isLogin && (
                <div className="auth-group">
                  <label className="auth-label">Full Name</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="e.g. Aayush"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="auth-group">
                <label className="auth-label">Email Address</label>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="e.g. aayush@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="auth-group">
                <label className="auth-label">Password</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Minimum 10 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
              </div>

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading
                  ? "Authenticating..."
                  : isLogin
                  ? "Sign In"
                  : "Next: Connect Oura Ring →"}
              </button>
            </form>

            {!isFirstRun && signupsEnabled && (
              <div className="auth-switch">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <span
                  className="auth-switch-link"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                  }}
                >
                  {isLogin ? "Sign Up" : "Sign In"}
                </span>
              </div>
            )}
          </>
        )}

        {/* STEP 2: Oura Credentials Setup */}
        {step === 2 && (
          <>
            <h1 className="auth-title">Link Your Oura Ring</h1>
            <p className="auth-subtitle">
              Connect your personal Oura credentials so your dashboard can sync sleep, readiness, and activity data.
            </p>

            {error && <div className="auth-error" style={{ marginBottom: "16px" }}>{error}</div>}
            {successMsg && <div className="auth-success" style={{ marginBottom: "16px" }}>{successMsg}</div>}

            <form className="auth-form" onSubmit={handleStep2TokenSubmit}>
              <div className="auth-group">
                <label className="auth-label">
                  <span>Personal Access Token</span>
                  <a
                    href="https://cloud.ouraring.com/personal-access-tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="auth-link"
                  >
                    Generate Token ↗
                  </a>
                </label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Paste Oura Personal Access Token"
                  value={ouraToken}
                  onChange={(e) => setOuraToken(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                className="auth-btn"
                disabled={loading || !ouraToken.trim()}
              >
                {loading ? "Validating & Linking..." : "Save Token & Open Dashboard →"}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
                <span style={{ fontSize: "11px", color: "rgba(235, 240, 248, 0.4)", textTransform: "uppercase" }}>OR</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              </div>

              <button
                type="button"
                className="auth-btn-secondary"
                onClick={handleStep2OAuth}
                disabled={connectingOauth}
              >
                {connectingOauth ? "Opening OAuth Window..." : "🔗 Connect via Oura OAuth Popup"}
              </button>

              <button
                type="button"
                className="auth-btn-secondary"
                style={{ background: "transparent", border: "none", color: "rgba(235, 240, 248, 0.5)", marginTop: "4px", fontSize: "12.5px" }}
                onClick={() => onSuccess(createdUser)}
              >
                Skip for now (configure later in Settings)
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
