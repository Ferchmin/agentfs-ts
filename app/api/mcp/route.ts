/**
 * Hosted MCP endpoint — stateless Streamable HTTP.
 * Authenticates via ?key= query param or Authorization header.
 */

import { NextRequest } from "next/server";
import { validateApiKey, decodeToken, getUser } from "@/lib/auth";
import { handleMcpRequest } from "@/lib/mcp";

async function authenticate(request: NextRequest): Promise<{ userId: string; workspace: string } | null> {
  // Try ?key= query param first
  const key = request.nextUrl.searchParams.get("key");
  if (key) {
    const keyInfo = await validateApiKey(key);
    if (keyInfo) return { userId: keyInfo.user_id, workspace: keyInfo.workspace };
  }

  // Try Authorization header
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    if (token.startsWith("agentfs_")) {
      const keyInfo = await validateApiKey(token);
      if (keyInfo) return { userId: keyInfo.user_id, workspace: keyInfo.workspace };
    }

    const userId = await decodeToken(token);
    if (userId) {
      const user = await getUser(userId);
      if (user) return { userId, workspace: "default" };
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (!auth) {
      return Response.json(
        { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Authentication required" } },
        { status: 401 },
      );
    }

    const body = await request.json();
    const result = await handleMcpRequest(body, auth.userId, auth.workspace);

    return Response.json(result, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }
}

// GET for discovery / health check
export async function GET() {
  return Response.json({
    name: "AgentFS MCP",
    version: "1.0.0",
    description: "Cloud storage for AI agents with version history",
    protocol: "MCP Streamable HTTP",
  });
}
