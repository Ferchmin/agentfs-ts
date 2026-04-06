"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectContent />
    </Suspense>
  );
}

function ConnectContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callback");

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [manualKey, setManualKey] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      // 1. Auth
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup"
          ? { email, password, name }
          : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication failed");
        return;
      }

      // 2. Create API key
      const keyRes = await fetch("/api/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({ name: "claude-code" }),
      });

      const keyData = await keyRes.json();
      if (!keyRes.ok) {
        setError("Failed to create API key");
        return;
      }

      // 3. Redirect back to callback with the key
      if (callbackUrl) {
        const separator = callbackUrl.includes("?") ? "&" : "?";
        window.location.href = `${callbackUrl}${separator}key=${encodeURIComponent(keyData.key)}`;
        setDone(true);
      } else {
        // No callback — show the key manually
        setManualKey(keyData.key);
        setDone(true);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done && manualKey) {
    const mcpCmd = `claude mcp add --transport http agentfs "${window.location.origin}/api/mcp?key=${manualKey}"`;
    return (
      <Shell>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Connected!
          </h1>
          <p style={{ color: "#666", fontSize: 15, marginBottom: 24 }}>
            Copy this command into your terminal:
          </p>
          <div
            className="code-block"
            style={{ textAlign: "left", fontSize: 12, marginBottom: 16 }}
          >
            <button
              className="copy-btn"
              onClick={() => navigator.clipboard.writeText(mcpCmd)}
            >
              Copy
            </button>
            <code>{mcpCmd}</code>
          </div>
          <p style={{ color: "#999", fontSize: 13 }}>
            Your API key: <code style={{ fontFamily: "var(--font-mono)" }}>{manualKey}</code>
          </p>
        </div>
      </Shell>
    );
  }

  if (done && callbackUrl) {
    return (
      <Shell>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Connected!
          </h1>
          <p style={{ color: "#666", fontSize: 15 }}>
            You can close this tab and return to Claude Code.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          Connect to AgentFS
        </h1>
        <p style={{ fontSize: 15, color: "#666" }}>
          {mode === "login"
            ? "Sign in to connect your account"
            : "Create an account to get started"}
        </p>
      </div>

      {error && (
        <div className="form-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        {mode === "signup" && (
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Choose a password" : "Your password"}
            required
            minLength={mode === "signup" ? 8 : undefined}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ marginTop: 8 }}
        >
          {submitting
            ? "Connecting..."
            : mode === "signup"
              ? "Create Account & Connect"
              : "Sign In & Connect"}
        </button>
      </form>

      <p
        style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: 14,
          color: "#666",
        }}
      >
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              onClick={() => { setMode("signup"); setError(""); }}
              style={{
                background: "none",
                border: "none",
                color: "#0a0a0a",
                fontWeight: 500,
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "inherit",
              }}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              onClick={() => { setMode("login"); setError(""); }}
              style={{
                background: "none",
                border: "none",
                color: "#0a0a0a",
                fontWeight: 500,
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "inherit",
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <svg width={28} height={28} viewBox="0 0 32 32" fill="none">
            <path d="M16 2L30 28H2L16 2Z" fill="#0a0a0a" />
          </svg>
          AgentFS
        </Link>
      </nav>
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 380 }}>{children}</div>
      </main>
    </>
  );
}
