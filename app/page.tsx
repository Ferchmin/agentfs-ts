import Link from "next/link";

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 2L30 28H2L16 2Z" fill="#0a0a0a" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      {/* Nav */}
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <Logo />
          AgentFS
        </Link>
        <div className="nav-links">
          <Link href="/login">Login</Link>
          <Link href="/signup" className="btn btn-primary btn-small">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ flex: 1 }}>
        <section
          style={{
            textAlign: "center",
            padding: "100px 24px 80px",
            maxWidth: 640,
            margin: "0 auto",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <Logo size={56} />
          </div>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              marginBottom: 16,
            }}
          >
            Cloud storage
            <br />
            for AI agents
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "#666",
              maxWidth: 440,
              margin: "0 auto 40px",
              lineHeight: 1.6,
            }}
          >
            Every file change is a versioned commit. Read, write, and revert
            from any agent via REST API or MCP.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href="/signup" className="btn btn-primary">
              Get Started Free
            </Link>
            <Link href="#how-it-works" className="btn btn-secondary">
              How It Works
            </Link>
          </div>
        </section>

        {/* Features */}
        <section
          id="how-it-works"
          className="container-wide"
          style={{ paddingBottom: 80 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 20,
            }}
          >
            <div className="card">
              <div style={{ fontSize: 24, marginBottom: 12 }}>&#9650;</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Version History
              </h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
                Every write is a commit. Browse history, view diffs, and revert
                any change. Agents can experiment safely.
              </p>
            </div>
            <div className="card">
              <div style={{ fontSize: 24, marginBottom: 12 }}>&#9670;</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                MCP Integration
              </h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
                Plug into Claude, Cursor, or any MCP-compatible client with one
                command. No local server needed.
              </p>
            </div>
            <div className="card">
              <div style={{ fontSize: 24, marginBottom: 12 }}>&#9724;</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                REST API
              </h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
                Simple PUT/GET/DELETE for files. Search, list directories, and
                manage API keys programmatically.
              </p>
            </div>
          </div>
        </section>

        {/* Code example */}
        <section className="container" style={{ paddingBottom: 100 }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            Connect in seconds
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "#666",
                  marginBottom: 8,
                  fontWeight: 500,
                }}
              >
                Add to Claude Code
              </p>
              <div className="code-block">
                <code>
                  claude mcp add agentfs \<br />
                  &nbsp;&nbsp;--transport http \<br />
                  &nbsp;&nbsp;https://agentfs-ts.vercel.app/api/mcp?key=YOUR_KEY
                </code>
              </div>
            </div>

            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "#666",
                  marginBottom: 8,
                  fontWeight: 500,
                }}
              >
                Or use the REST API
              </p>
              <div className="code-block">
                <code>
                  {`curl -X PUT /api/files?path=notes.md \\`}
                  <br />
                  {`  -H "Authorization: Bearer agentfs_..." \\`}
                  <br />
                  {`  -d '{"content":"Hello from my agent!"}'`}
                </code>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #e5e5e5",
          padding: "24px",
          textAlign: "center",
          fontSize: 13,
          color: "#999",
        }}
      >
        AgentFS
      </footer>
    </>
  );
}
