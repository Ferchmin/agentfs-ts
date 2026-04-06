/**
 * Hosted MCP endpoint — stateless JSON-RPC over HTTP POST.
 * Port of mcp_endpoint.py.
 */

import { Storage, FileNotFoundError } from "./storage";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

const TOOLS = [
  {
    name: "write_file",
    description: "Write or overwrite a file. Creates parent directories automatically.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path (e.g. 'src/main.py')" },
        content: { type: "string", description: "File content" },
        message: { type: "string", description: "Commit message (optional)" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "read_file",
    description: "Read a file's content. Optionally read a specific version.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
        version: { type: "string", description: "Commit ID to read from (optional)" },
      },
      required: ["path"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
        message: { type: "string", description: "Commit message (optional)" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_files",
    description: "List files and directories at a given path.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (default: root)" },
      },
    },
  },
  {
    name: "search_files",
    description: "Search for files by name pattern.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "move_file",
    description: "Move/rename a file.",
    inputSchema: {
      type: "object",
      properties: {
        src: { type: "string", description: "Source path" },
        dst: { type: "string", description: "Destination path" },
        message: { type: "string", description: "Commit message (optional)" },
      },
      required: ["src", "dst"],
    },
  },
  {
    name: "history",
    description: "View commit history, optionally filtered to a specific file.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path (optional, show all if omitted)" },
        limit: { type: "number", description: "Max entries (default 20)" },
      },
    },
  },
  {
    name: "revert",
    description: "Revert a specific commit, undoing its changes.",
    inputSchema: {
      type: "object",
      properties: {
        commit_id: { type: "string", description: "Commit ID to revert" },
      },
      required: ["commit_id"],
    },
  },
];

export async function handleMcpRequest(
  body: JsonRpcRequest,
  userId: string,
  workspace: string,
): Promise<JsonRpcResponse> {
  const id = body.id ?? null;
  const method = body.method;
  const params = body.params || {};

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "AgentFS", version: "1.0.0" },
          },
        };

      case "notifications/initialized":
        return { jsonrpc: "2.0", id, result: {} };

      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: TOOLS } };

      case "tools/call":
        return await handleToolCall(id, params, userId, workspace);

      case "ping":
        return { jsonrpc: "2.0", id, result: {} };

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: err instanceof Error ? err.message : "Internal error" },
    };
  }
}

async function handleToolCall(
  id: string | number | null,
  params: Record<string, unknown>,
  userId: string,
  workspace: string,
): Promise<JsonRpcResponse> {
  const toolName = params.name as string;
  const args = (params.arguments || {}) as Record<string, unknown>;
  const storage = new Storage(userId, workspace);

  try {
    let result: unknown;

    switch (toolName) {
      case "write_file": {
        const content = Buffer.from(args.content as string, "utf-8");
        result = await storage.write(args.path as string, content, {
          message: args.message as string | undefined,
          agent: "MCP",
        });
        break;
      }
      case "read_file": {
        const data = await storage.read(
          args.path as string,
          args.version as string | undefined,
        );
        result = { content: data.toString("utf-8"), size: data.length };
        break;
      }
      case "delete_file": {
        result = await storage.delete(args.path as string, {
          message: args.message as string | undefined,
          agent: "MCP",
        });
        break;
      }
      case "list_files": {
        result = await storage.list((args.path as string) || "/");
        break;
      }
      case "search_files": {
        result = await storage.search(args.query as string);
        break;
      }
      case "move_file": {
        result = await storage.move(args.src as string, args.dst as string, {
          message: args.message as string | undefined,
          agent: "MCP",
        });
        break;
      }
      case "history": {
        result = await storage.log(
          args.path as string | undefined,
          (args.limit as number) || 20,
        );
        break;
      }
      case "revert": {
        result = await storage.revert(args.commit_id as string);
        break;
      }
      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `Unknown tool: ${toolName}` },
        };
    }

    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      },
    };
  } catch (err) {
    const isNotFound = err instanceof FileNotFoundError;
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
          },
        ],
        isError: true,
      },
    };
  }
}
