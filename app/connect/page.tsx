"use client";

import { useState } from "react";
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

// --- Tabs for connection snippets ---

type Tab = "claude-code" | "claude-desktop" | "cursor" | "mcp-json";

const TABS: { id: Tab; label: string }[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "cursor", label: "Cursor" },
  { id: "mcp-json", label: ".mcp.json" },
];

function getSnippet(tab: Tab, endpointUrl: string, apiKey: string): string {
  switch (tab) {
    case "claude-code":
      return `claude mcp add --transport http agentfs \\\n  "${endpointUrl}?key=${apiKey}"`;

    case "claude-desktop":
      return JSON.stringify({
        mcpServers: {
          agentfs: {
            type: "http",
            url: `${endpointUrl}?key=${apiKey}`,
          },
        },
      }, null, 2);

    case "cursor":
      return JSON.stringify({
        mcpServers: {
          agentfs: {
            url: `${endpointUrl}?key=${apiKey}`,
          },
        },
      }, null, 2);

    case "mcp-json":
      return JSON.stringify({
        mcpServers: {
          agentfs: {
            type: "http",
            url: `${endpointUrl}?key=${apiKey}`,
          },
        },
      }, null, 2);

  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-btn"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ConnectionSnippets({ apiKey }: { apiKey: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("claude-code");
  const endpointUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/mcp`
      : "https://agentfs-ts.vercel.app/api/mcp";

  const snippet = getSnippet(activeTab, endpointUrl, apiKey);

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginBottom: 12,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid",
              borderColor: activeTab === tab.id ? "#0a0a0a" : "#e5e5e5",
              background: activeTab === tab.id ? "#0a0a0a" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#666",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Snippet */}
      <div className="code-block" style={{ fontSize: 12, padding: "16px 70px 16px 20px" }}>
        <CopyButton text={snippet} />
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {snippet}
        </pre>
      </div>

      {/* Hint for JSON tabs */}
      {(activeTab === "claude-desktop") && (
        <p style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
          Add to ~/Library/Application Support/Claude/claude_desktop_config.json
        </p>
      )}
      {activeTab === "mcp-json" && (
        <p style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
          Add to .mcp.json in your project root
        </p>
      )}
      {activeTab === "cursor" && (
        <p style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
          Add to .cursor/mcp.json in your project
        </p>
      )}
    </div>
  );
}

// --- Main flow ---

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

      // Create API key
      const keyRes = await fetch("/api/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({ name: "default" }),
      });

      const keyData = await keyRes.json();
      if (!keyRes.ok) {
        setError("Failed to create API key");
        return;
      }

      if (callbackUrl) {
        const separator = callbackUrl.includes("?") ? "&" : "?";
        window.location.href = `${callbackUrl}${separator}key=${encodeURIComponent(keyData.key)}`;
        setDone(true);
      } else {
        setManualKey(keyData.key);
        setDone(true);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Success screen ---
  if (done && manualKey) {
    const endpointUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/mcp`
        : "https://agentfs-ts.vercel.app/api/mcp";

    return (
      <Shell wide>
        <div>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              You&apos;re in!
            </h1>
            <p style={{ color: "#666", fontSize: 14 }}>
              Use the credentials below to connect.
            </p>
          </div>

          {/* Credentials */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginBottom: 28,
            }}
          >
            <div>
              <p style={{ fontSize: 12, color: "#666", marginBottom: 6, fontWeight: 500 }}>
                API Key
              </p>
              <div className="code-block" style={{ fontSize: 13, padding: "14px 70px 14px 16px" }}>
                <CopyButton text={manualKey} />
                <code style={{ wordBreak: "break-all" }}>{manualKey}</code>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#666", marginBottom: 6, fontWeight: 500 }}>
                MCP Endpoint
              </p>
              <div className="code-block" style={{ fontSize: 13, padding: "14px 70px 14px 16px" }}>
                <CopyButton text={`${endpointUrl}?key=${manualKey}`} />
                <code style={{ wordBreak: "break-all" }}>
                  {endpointUrl}?key={manualKey}
                </code>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 12, color: "#999", marginBottom: 20, textAlign: "center" }}>
            Save your API key — it won&apos;t be shown again.
          </p>

          {/* Tabbed snippets */}
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              Connect your client
            </p>
            <ConnectionSnippets apiKey={manualKey} />
          </div>
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
            You can close this tab and return to your app.
          </p>
        </div>
      </Shell>
    );
  }

  // --- Auth form ---
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

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
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
        <div style={{ width: "100%", maxWidth: wide ? 580 : 380 }}>{children}</div>
      </main>
    </>
  );
}
