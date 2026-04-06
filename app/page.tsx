export default function Home() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "80px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 8 }}>AgentFS</h1>
      <p style={{ fontSize: 20, color: "#666", marginBottom: 40 }}>
        Cloud storage for AI agents with full version history.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>REST API</h2>
          <code style={{ display: "block", background: "#f5f5f5", padding: 12, borderRadius: 8, fontSize: 14 }}>
            curl -X PUT /api/files?path=hello.txt \<br />
            &nbsp;&nbsp;-H &quot;Authorization: Bearer agentfs_...&quot; \<br />
            &nbsp;&nbsp;-d &apos;{`{"content":"Hello, World!"}`}&apos;
          </code>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>MCP Endpoint</h2>
          <code style={{ display: "block", background: "#f5f5f5", padding: 12, borderRadius: 8, fontSize: 14 }}>
            claude mcp add --transport http agentfs \<br />
            &nbsp;&nbsp;https://your-app.vercel.app/api/mcp?key=agentfs_...
          </code>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Endpoints</h2>
          <ul style={{ lineHeight: 1.8, fontSize: 14 }}>
            <li><code>POST /api/auth/signup</code> — Create account</li>
            <li><code>POST /api/auth/login</code> — Sign in</li>
            <li><code>GET /api/auth/me</code> — Current user</li>
            <li><code>PUT /api/files?path=...</code> — Write file</li>
            <li><code>GET /api/files?path=...</code> — Read file</li>
            <li><code>DELETE /api/files?path=...</code> — Delete file</li>
            <li><code>POST /api/files/move</code> — Move/rename</li>
            <li><code>GET /api/list?path=...</code> — List directory</li>
            <li><code>GET /api/search?q=...</code> — Search files</li>
            <li><code>GET /api/history</code> — Commit log</li>
            <li><code>GET /api/diff?commit=...</code> — View diff</li>
            <li><code>POST /api/revert</code> — Revert commit</li>
            <li><code>POST /api/keys</code> — Create API key</li>
            <li><code>GET /api/keys</code> — List API keys</li>
            <li><code>POST /api/mcp</code> — MCP JSON-RPC</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
