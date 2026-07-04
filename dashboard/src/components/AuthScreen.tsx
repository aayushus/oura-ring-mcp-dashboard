import React, { useState } from "react";

interface AuthScreenProps {
  isFirstRun: boolean;
  signupsEnabled: boolean;
  onSuccess: (user: any) => void;
}

export function AuthScreen({ isFirstRun, signupsEnabled, onSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(!isFirstRun);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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

      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <style>{`
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: radial-gradient(circle at top, #141722 0%, #0b0c10 100%);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
          color: #f2f4f8;
          padding: 20px;
        }
        .auth-card {
          width: 100%;
          max-width: 440px;
          background: rgba(20, 22, 29, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .auth-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 28px;
        }
        .auth-logo-ring {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid #b55fe6;
          box-shadow: 0 0 15px rgba(181, 95, 230, 0.6);
          position: relative;
        }
        .auth-logo-ring::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          right: 3px;
          bottom: 3px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .auth-title {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.5px;
          text-align: center;
          margin-bottom: 8px;
          background: linear-gradient(135deg, #ffffff 0%, #aeb3b7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .auth-subtitle {
          font-size: 14px;
          color: rgba(235, 240, 248, 0.5);
          text-align: center;
          margin-bottom: 32px;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .auth-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .auth-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(235, 240, 248, 0.7);
        }
        .auth-input {
          background: rgba(11, 12, 16, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 14px 16px;
          color: #ffffff;
          font-size: 15px;
          transition: all 0.2s ease;
          outline: none;
        }
        .auth-input:focus {
          border-color: #b55fe6;
          box-shadow: 0 0 10px rgba(181, 95, 230, 0.15);
          background: rgba(11, 12, 16, 0.8);
        }
        .auth-error {
          background: rgba(235, 87, 87, 0.1);
          border: 1px solid rgba(235, 87, 87, 0.2);
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 14px;
          color: #eb5757;
          line-height: 1.4;
        }
        .auth-btn {
          background: linear-gradient(135deg, #b55fe6 0%, #e65fa8 100%);
          border: none;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          border-radius: 12px;
          padding: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 10px;
          box-shadow: 0 8px 24px rgba(181, 95, 230, 0.2);
        }
        .auth-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 28px rgba(181, 95, 230, 0.35);
        }
        .auth-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .auth-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .auth-switch {
          margin-top: 24px;
          text-align: center;
          font-size: 14px;
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
          <span style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px" }}>Oura MCP Server</span>
        </div>

        <h1 className="auth-title">
          {isFirstRun
            ? "Create Admin Account"
            : isLogin
            ? "Sign in to Dashboard"
            : "Create your account"}
        </h1>
        <p className="auth-subtitle">
          {isFirstRun
            ? "Set up the administrator credentials to secure your Oura Ring dashboard."
            : isLogin
            ? "Enter your credentials to access your biometric history."
            : "Connect your Oura Ring biometrics."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
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
            {loading ? "Authenticating..." : isFirstRun ? "Initialize & Continue" : isLogin ? "Sign In" : "Sign Up"}
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
      </div>
    </div>
  );
}
