"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/auth-context";

type ApiKey = {
  id: string;
  name: string;
  workspace: string;
  prefix: string;
  created_at: string;
};

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

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

function McpCommand({ apiKey }: { apiKey: string }) {
  const cmd = `claude mcp add --transport http agentfs "${BASE_URL}/api/mcp?key=${apiKey}"`;
  return (
    <div className="code-block" style={{ fontSize: 12 }}>
      <CopyButton text={cmd} />
      <code>{cmd}</code>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { token, user, isLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const newKey = searchParams.get("newKey");

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const fetchKeys = useCallback(async () => {
    if (!token) return;
    const res = await fetch("/api/keys", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys || []);
    }
  }, [token]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim() || !token) return;
    setCreating(true);

    const res = await fetch("/api/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      setJustCreatedKey(data.key);
      setNewKeyName("");
      fetchKeys();
    }
    setCreating(false);
  }

  async function deleteKey(id: string) {
    if (!token) return;
    await fetch(`/api/keys?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchKeys();
  }

  if (isLoading || !user) return null;

  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <svg width={28} height={28} viewBox="0 0 32 32" fill="none">
            <path d="M16 2L30 28H2L16 2Z" fill="#0a0a0a" />
          </svg>
          AgentFS
        </Link>
        <div className="nav-links">
          <span style={{ fontSize: 14, color: "#666" }}>{user.email}</span>
          <button
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="btn btn-secondary btn-small"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        {/* New key banner (from signup) */}
        {newKey && (
          <div className="key-banner" style={{ marginBottom: 32 }}>
            <h3>Your API key is ready!</h3>
            <p>
              Copy this key now — it won&apos;t be shown again.
            </p>
            <div
              className="code-block"
              style={{ background: "#166534", marginBottom: 12 }}
            >
              <CopyButton text={newKey} />
              <code>{newKey}</code>
            </div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>
              Connect to Claude Code:
            </p>
            <McpCommand apiKey={newKey} />
          </div>
        )}

        {/* Just-created key banner */}
        {justCreatedKey && !newKey && (
          <div className="key-banner" style={{ marginBottom: 32 }}>
            <h3>Key created!</h3>
            <p>
              Copy this key now — it won&apos;t be shown again.
            </p>
            <div
              className="code-block"
              style={{ background: "#166534", marginBottom: 12 }}
            >
              <CopyButton text={justCreatedKey} />
              <code>{justCreatedKey}</code>
            </div>
            <McpCommand apiKey={justCreatedKey} />
          </div>
        )}

        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: 32,
          }}
        >
          Dashboard
        </h1>

        {/* API Keys */}
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            API Keys
          </h2>

          {/* Create key form */}
          <form
            onSubmit={createKey}
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. my-agent)"
              style={{
                flex: 1,
                padding: "10px 14px",
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "var(--font-sans)",
                outline: "none",
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating || !newKeyName.trim()}
            >
              {creating ? "Creating..." : "Create Key"}
            </button>
          </form>

          {/* Keys list */}
          {keys.length === 0 ? (
            <p style={{ color: "#666", fontSize: 14 }}>
              No API keys yet. Create one above.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 20px",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>
                      {k.name}
                    </span>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 13,
                        color: "#999",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {k.prefix}...
                    </span>
                    <span className="badge" style={{ marginLeft: 8 }}>
                      {k.workspace}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteKey(k.id)}
                    className="btn btn-secondary btn-small btn-danger"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick reference */}
        <section>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            Quick Reference
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "#666",
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                Write a file
              </p>
              <div className="code-block">
                <code>
                  {`curl -X PUT "${BASE_URL}/api/files?path=hello.txt" \\`}
                  <br />
                  {`  -H "Authorization: Bearer YOUR_KEY" \\`}
                  <br />
                  {`  -H "Content-Type: application/json" \\`}
                  <br />
                  {`  -d '{"content":"Hello World!"}'`}
                </code>
              </div>
            </div>
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "#666",
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                Read a file
              </p>
              <div className="code-block">
                <code>
                  {`curl "${BASE_URL}/api/files?path=hello.txt&format=text" \\`}
                  <br />
                  {`  -H "Authorization: Bearer YOUR_KEY"`}
                </code>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
